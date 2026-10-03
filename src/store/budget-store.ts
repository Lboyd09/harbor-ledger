import { create } from "zustand";
import { persist } from "zustand/middleware";
import { linkCategoryState, migrateGoals, withMonthlyChange, withPaused } from "@/lib/budget/buckets";
import { parseBackup } from "@/lib/budget/backup";
import { replaceMerchantRule, suggestCategory } from "@/lib/budget/categorize";
import { parseCsvText, applyAmountFlip } from "@/lib/budget/csv";
import { fingerprint } from "@/lib/budget/fingerprint";
import { newId } from "@/lib/budget/ids";
import { DEFAULT_IRA } from "@/lib/budget/ira";
import { merchantKey } from "@/lib/budget/merchant";
import { roundMoney } from "@/lib/budget/money";
import { emptySnapshot, normalizeSnapshot } from "@/lib/budget/normalize";
import { currentMonthKey, currentWeekKey } from "@/lib/budget/parse-date";
import { clearLedger, loadLedger, saveLedger } from "@/lib/budget/persist";
import { paybackNotes, paybackPartnerId } from "@/lib/budget/payback";
import { buildPresetCategories } from "@/lib/budget/presets";
import { recommendedPlans } from "@/lib/budget/year";
import { SAMPLE_CSV, SAMPLE_PROFILE } from "@/lib/budget/sample";
import type {
  BucketMove,
  BudgetPeriod,
  Category,
  CsvPreview,
  DebtItem,
  ImportBatch,
  IraRules,
  LedgerSnapshot,
  MerchantRule,
  MoneyBucket,
  MonthBudget,
  NetWorthPoint,
  Profile,
  SavingsGoal,
  Transaction,
  TxSplit,
  TxStatus,
} from "@/lib/budget/types";

type ImportResult = { added: number; skipped: number; categorized: number; uncategorized: number };
type SaveState = "idle" | "saving" | "saved" | "error";

const LOCAL_KEY = "harbor-ledger-v3";
const LEGACY_KEY = "harbor-ledger-v2";

type State = LedgerSnapshot & {
  hydrated: boolean;
  saveState: SaveState;
  saveError: string | null;
  setHydrated: () => void;
  hydrateLocal: () => void;
  loadRemote: () => Promise<void>;
  completeSetup: (profile: Profile, categories: Category[]) => void;
  reopenSetup: () => void;
  resetAll: () => Promise<void>;
  setActiveMonth: (ym: string) => void;
  setActiveWeek: (wk: string) => void;
  setBudgetPeriod: (period: BudgetPeriod) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  addCategory: (cat: Omit<Category, "id">) => void;
  removeCategory: (id: string) => void;
  setMonthPlan: (categoryId: string, ym: string, amount: number | null) => void;
  setTransactionCategory: (id: string, categoryId: string | null, applyToMerchant: boolean) => void;
  setMerchantCategory: (merchantKey: string, categoryId: string | null, side?: "in" | "out") => void;
  applyRecommendedPlans: (year: string) => number;
  patchTransaction: (id: string, patch: Partial<Pick<Transaction, "excluded" | "status" | "notes">>) => void;
  setSplits: (id: string, splits: TxSplit[] | null) => void;
  addGoal: (goal: Omit<SavingsGoal, "id">) => void;
  updateGoal: (id: string, patch: Partial<Omit<SavingsGoal, "id">>) => void;
  removeGoal: (id: string) => void;
  addBucket: (bucket: Omit<MoneyBucket, "id">) => void;
  updateBucket: (id: string, patch: Partial<Omit<MoneyBucket, "id">>) => void;
  removeBucket: (id: string) => void;
  linkBucketCategory: (bucketId: string, categoryId: string) => string;
  unlinkBucketCategory: (bucketId: string, categoryId: string) => void;
  /** On: leftovers stay in this category. Off: it starts over each month. */
  setKeepsLeftovers: (categoryId: string, on: boolean) => void;
  moveBucketMoney: (move: Omit<BucketMove, "id">) => void;
  addNetWorth: (point: Omit<NetWorthPoint, "id">) => void;
  removeNetWorth: (id: string) => void;
  addDebt: (debt: Omit<DebtItem, "id">) => void;
  updateDebt: (id: string, patch: Partial<Omit<DebtItem, "id">>) => void;
  removeDebt: (id: string) => void;
  patchIra: (patch: Partial<IraRules>) => void;
  markPaidBack: (expenseId: string, depositId: string | null, label?: string) => void;
  undoPaidBack: (id: string) => void;
  countAsIncome: (id: string) => void;
  countHiddenDeposits: () => number;
  cancelSetup: () => void;
  patchProfile: (patch: Partial<Profile>) => void;
  importPreview: (preview: CsvPreview, flipSign: boolean) => ImportResult;
  loadSample: () => void;
  deleteTransaction: (id: string) => void;
  restoreBackup: (raw: unknown) => { ok: true; count: number } | { ok: false; error: string };
};

function openToday() {
  return { activeMonth: currentMonthKey(), activeWeek: currentWeekKey() };
}

function snapshotOf(s: LedgerSnapshot): LedgerSnapshot {
  return {
    profile: s.profile,
    categories: s.categories,
    transactions: s.transactions,
    merchantRules: s.merchantRules,
    imports: s.imports,
    monthBudgets: s.monthBudgets ?? [],
    savingsGoals: s.savingsGoals ?? [],
    moneyBuckets: s.moneyBuckets ?? [],
    bucketMoves: s.bucketMoves ?? [],
    netWorth: s.netWorth ?? [],
    debts: s.debts ?? [],
    ira: s.ira ?? DEFAULT_IRA,
    activeMonth: s.activeMonth,
    activeWeek: s.activeWeek,
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistChain: Promise<void> = Promise.resolve();
/** Bumps when the person edits. An in-flight load must not paint over that. */
let mutationEpoch = 0;
/** Bumps on reset so an older save cannot write the ledger back. */
let saveEpoch = 0;
/** True while applying server or storage data, which is not a local edit. */
let silenceEpoch = false;

function quiet(run: () => void) {
  silenceEpoch = true;
  try {
    run();
  } finally {
    silenceEpoch = false;
  }
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushPersist();
  }, 450);
}

async function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const epoch = saveEpoch;
  persistChain = persistChain.then(async () => {
    if (epoch !== saveEpoch) return;
    const s = useBudgetStore.getState();
    if (!s.hydrated || !s.profile.completedOnboarding) return;
    useBudgetStore.setState({ saveState: "saving", saveError: null });
    try {
      const payload = snapshotOf(useBudgetStore.getState());
      if (epoch !== saveEpoch) return;
      await saveLedger({ data: payload });
      if (epoch !== saveEpoch) return;
      useBudgetStore.setState({ saveState: "saved" });
    } catch (err) {
      if (epoch !== saveEpoch) return;
      const message = err instanceof Error ? err.message : "Could not save";
      if (message === "Unauthorized") {
        useBudgetStore.setState({ saveState: "idle", saveError: null });
        return;
      }
      useBudgetStore.setState({ saveState: "error", saveError: message });
    }
  });
  return persistChain;
}

function remapIds(oldCats: Category[], nextCats: Category[]) {
  const map = new Map<string, string>();
  for (const old of oldCats) {
    const match = nextCats.find((c) => c.slug === old.slug) ?? nextCats.find((c) => c.name === old.name);
    if (match) map.set(old.id, match.id);
  }
  return map;
}

function applyImportRows(
  rows: { date: string | null; description: string; amount: number | null }[],
  sourceLabel: string,
  existing: Transaction[],
  categories: Category[],
  rules: MerchantRule[],
): { added: Transaction[]; skipped: number } {
  const seen = new Set(existing.map((t) => t.fingerprint));
  const added: Transaction[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (!row.date || row.amount == null || !row.description) {
      skipped += 1;
      continue;
    }
    const fp = fingerprint(row.date, row.amount, row.description);
    if (seen.has(fp)) {
      skipped += 1;
      continue;
    }
    seen.add(fp);
    const key = merchantKey(row.description);
    const suggestion = suggestCategory(row.description, row.amount, categories, rules, key, existing);
    const cat = suggestion.categoryId ? categories.find((c) => c.id === suggestion.categoryId) : undefined;
    let status: TxStatus = "posted";
    if (suggestion.reason === "refund") status = "refund";
    if (cat?.slug === "transfers-out") status = "transfer";
    added.push({
      id: newId("tx"),
      date: row.date,
      description: row.description,
      merchantKey: key,
      amount: row.amount,
      sourceLabel,
      fingerprint: fp,
      categoryId: suggestion.categoryId,
      userSet: false,
      notes: "",
      excluded: false,
      status,
    });
  }
  return { added, skipped };
}

function readLegacy(): LedgerSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const nested = parsed && typeof parsed === "object" && "state" in parsed ? (parsed as { state: unknown }).state : parsed;
    return normalizeSnapshot(nested);
  } catch {
    return null;
  }
}

function dropLegacy() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export const useBudgetStore = create<State>()(
  persist(
    (set, get) => ({
      ...emptySnapshot(),
      hydrated: false,
      saveState: "idle",
      saveError: null,
      setHydrated: () => {
        const s = get();
        const month = currentMonthKey();
        quiet(() =>
          set({
            hydrated: true,
            ...openToday(),
            monthBudgets: s.monthBudgets ?? [],
            savingsGoals: s.savingsGoals ?? [],
            moneyBuckets: migrateGoals(s.savingsGoals ?? [], s.moneyBuckets ?? [], month),
            bucketMoves: s.bucketMoves ?? [],
            netWorth: s.netWorth ?? [],
            debts: s.debts ?? [],
            ira: s.ira ?? DEFAULT_IRA,
            profile: { ...s.profile, detail: s.profile.detail === "nerd" ? "nerd" : "simple" },
          }),
        );
      },
      hydrateLocal: () => {
        const persistApi = useBudgetStore.persist;
        const mark = () => get().setHydrated();
        persistApi?.onFinishHydration?.(mark);
        if (persistApi?.hasHydrated?.()) mark();
        window.setTimeout(mark, 200);
        const legacy = readLegacy();
        if (legacy && (legacy.profile.completedOnboarding || legacy.transactions.length) && !get().profile.completedOnboarding) {
          quiet(() => set({ ...legacy, hydrated: true, ...openToday() }));
          dropLegacy();
        }
      },
      loadRemote: async () => {
        const seen = mutationEpoch;
        const local = snapshotOf(get());
        try {
          const remote = await loadLedger();
          if (seen !== mutationEpoch) {
            quiet(() => set({ hydrated: true }));
            if (get().profile.completedOnboarding) void flushPersist();
            return;
          }
          const editing =
            !get().profile.completedOnboarding && (get().transactions.length > 0 || get().categories.length > 0);
          if (remote?.profile.completedOnboarding && !editing) {
            quiet(() => set({ ...remote, hydrated: true, saveState: "saved", saveError: null, ...openToday() }));
            dropLegacy();
            return;
          }
          if (local.profile.completedOnboarding) {
            quiet(() => set({ hydrated: true, saveState: "saving" }));
            await flushPersist();
            return;
          }
          const legacy = readLegacy();
          if (legacy?.profile.completedOnboarding) {
            quiet(() => set({ ...legacy, hydrated: true, saveState: "saving", ...openToday() }));
            dropLegacy();
            await flushPersist();
            return;
          }
          quiet(() => set({ hydrated: true, saveState: "idle" }));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not load";
          if (message === "Unauthorized") {
            quiet(() => set({ hydrated: true, saveState: "idle" }));
            return;
          }
          quiet(() => set({ hydrated: true, saveState: "error", saveError: message }));
        }
      },
      completeSetup: (profile, categories) => {
        const idMap = remapIds(get().categories, categories);
        set({
          profile: {
            ...get().profile,
            ...profile,
            completedOnboarding: true,
            detail: profile.detail ?? get().profile.detail ?? "simple",
            detailChosen: true,
          },
          categories,
          transactions: get().transactions.map((t) => ({
            ...t,
            categoryId: t.categoryId ? (idMap.get(t.categoryId) ?? null) : null,
            splits: t.splits?.map((p) => ({ ...p, categoryId: idMap.get(p.categoryId) ?? p.categoryId })) ?? null,
          })),
          merchantRules: get()
            .merchantRules.map((r) => ({ ...r, categoryId: idMap.get(r.categoryId) ?? "" }))
            .filter((r) => r.categoryId),
          moneyBuckets: (get().moneyBuckets ?? []).map((b) => ({
            ...b,
            categoryIds: b.categoryIds.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id)),
          })),
        });
        void flushPersist();
      },
      reopenSetup: () => {
        set({ profile: { ...get().profile, completedOnboarding: false } });
        schedulePersist();
      },
      cancelSetup: () => {
        if (!get().categories.length && !get().transactions.length) return;
        set({ profile: { ...get().profile, completedOnboarding: true } });
        schedulePersist();
      },
      patchProfile: (patch) => {
        set({ profile: { ...get().profile, ...patch, completedOnboarding: get().profile.completedOnboarding } });
        schedulePersist();
      },
      resetAll: async () => {
        saveEpoch += 1;
        if (persistTimer) {
          clearTimeout(persistTimer);
          persistTimer = null;
        }
        const epoch = saveEpoch;
        persistChain = persistChain.then(async () => {
          if (epoch !== saveEpoch) return;
          try {
            await clearLedger();
          } catch (err) {
            const message = err instanceof Error ? err.message : "Could not reset";
            if (message !== "Unauthorized") throw err;
          }
        });
        try {
          await persistChain;
        } catch (err) {
          if (epoch !== saveEpoch) return;
          const message = err instanceof Error ? err.message : "Could not reset";
          useBudgetStore.setState({ saveState: "error", saveError: message });
          throw err;
        }
        if (epoch !== saveEpoch) return;
        set({ ...emptySnapshot(), hydrated: true, saveState: "idle", saveError: null });
        try {
          useBudgetStore.persist.clearStorage();
        } catch {
          /* storage can be blocked; the in-memory ledger is already empty */
        }
      },
      setActiveMonth: (ym) => {
        set({ activeMonth: ym });
        schedulePersist();
      },
      setActiveWeek: (wk) => {
        set({ activeWeek: wk });
        schedulePersist();
      },
      setBudgetPeriod: (period) => {
        set({ profile: { ...get().profile, budgetPeriod: period } });
        schedulePersist();
      },
      updateCategory: (id, patch) => {
        const linked = (get().moneyBuckets ?? []).some((b) => b.categoryIds.includes(id));
        const safe = linked && patch.plannedMonthly ? { ...patch, plannedMonthly: 0 } : patch;
        set({
          categories: get().categories.map((c) => (c.id === id ? { ...c, ...safe } : c)),
        });
        schedulePersist();
      },
      addCategory: (cat) => {
        const parent = cat.parentId ? get().categories.find((c) => c.id === cat.parentId) : undefined;
        if (parent?.parentId) return;
        set({
          categories: [...get().categories, { ...cat, parentId: parent ? parent.id : null, id: newId("cat") }],
        });
        schedulePersist();
      },
      removeCategory: (id) => {
        const parentId = get().categories.find((c) => c.id === id)?.parentId ?? null;
        set({
          categories: get()
            .categories.filter((c) => c.id !== id)
            .map((c) => (c.parentId === id ? { ...c, parentId: null } : c)),
          transactions: get().transactions.map((t) =>
            t.categoryId === id ? { ...t, categoryId: parentId, userSet: false } : t,
          ),
          merchantRules: get().merchantRules.filter((r) => r.categoryId !== id),
          monthBudgets: (get().monthBudgets ?? []).filter((b) => b.categoryId !== id),
        });
        schedulePersist();
      },
      setMonthPlan: (categoryId, ym, amount) => {
        if ((get().moneyBuckets ?? []).some((b) => b.categoryIds.includes(categoryId))) return;
        const rest = (get().monthBudgets ?? []).filter((b) => !(b.categoryId === categoryId && b.ym === ym));
        const monthBudgets: MonthBudget[] =
          amount == null || !Number.isFinite(amount) ? rest : [...rest, { categoryId, ym, amount: Math.max(0, amount) }];
        set({ monthBudgets });
        schedulePersist();
      },
      setTransactionCategory: (id, categoryId, applyToMerchant) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx) return;
        if (applyToMerchant) {
          const side = tx.amount < 0 || tx.status === "refund" ? "out" : "in";
          get().setMerchantCategory(tx.merchantKey, categoryId, side);
          return;
        }
        set({
          transactions: get().transactions.map((t) => (t.id === id ? { ...t, categoryId, userSet: true } : t)),
        });
        schedulePersist();
      },
      setMerchantCategory: (key, categoryId, side) => {
        const match = (t: { merchantKey: string; amount: number; status: string }) => {
          if (t.merchantKey !== key) return false;
          if (!side) return true;
          if (side === "out") return t.amount < 0 || t.status === "refund";
          return t.amount > 0 && t.status !== "refund";
        };
        set({
          merchantRules: replaceMerchantRule(get().merchantRules, key, categoryId, side),
          transactions: get().transactions.map((t) =>
            match(t) ? { ...t, categoryId, userSet: true, splits: null } : t,
          ),
        });
        schedulePersist();
      },
      applyRecommendedPlans: (year) => {
        const linked = new Set((get().moneyBuckets ?? []).flatMap((b) => b.categoryIds));
        const recs = recommendedPlans(get().transactions, get().categories, year).filter((r) => !linked.has(r.id));
        if (!recs.length) return 0;
        const map = new Map(recs.map((r) => [r.id, r.plannedMonthly]));
        set({
          categories: get().categories.map((c) =>
            map.has(c.id) ? { ...c, plannedMonthly: map.get(c.id) as number } : c,
          ),
        });
        schedulePersist();
        return recs.length;
      },
      patchTransaction: (id, patch) => {
        set({
          transactions: get().transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        });
        schedulePersist();
      },
      setSplits: (id, splits) => {
        set({
          transactions: get().transactions.map((t) => {
            if (t.id !== id) return t;
            const next = splits && splits.length >= 2 ? splits : null;
            const bigger = next ? [...next].sort((a, b) => b.amount - a.amount)[0] : null;
            return {
              ...t,
              splits: next,
              categoryId: t.categoryId ?? bigger?.categoryId ?? null,
              userSet: true,
            };
          }),
        });
        schedulePersist();
      },
      addGoal: (goal) => {
        const next: SavingsGoal = {
          id: newId("goal"),
          name: goal.name.trim() || "Savings",
          target: Math.max(0, goal.target),
          saved: Math.max(0, goal.saved),
          by: goal.by,
        };
        if (!next.name || next.target <= 0) return;
        set({ savingsGoals: [...(get().savingsGoals ?? []), next] });
        schedulePersist();
      },
      updateGoal: (id, patch) => {
        set({
          savingsGoals: (get().savingsGoals ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g)),
        });
        schedulePersist();
      },
      removeGoal: (id) => {
        set({
          savingsGoals: (get().savingsGoals ?? []).filter((g) => g.id !== id),
          moneyBuckets: (get().moneyBuckets ?? []).filter((b) => b.fromGoalId !== id),
        });
        schedulePersist();
      },
      addBucket: (bucket) => {
        const name = bucket.name.trim();
        if (!name) return;
        const yearly = bucket.yearly && bucket.yearly > 0 ? bucket.yearly : null;
        const monthly = yearly ? roundMoney(yearly / 12) : Math.max(0, bucket.monthly);
        const next: MoneyBucket = {
          id: newId("bucket"),
          name,
          monthly,
          yearly,
          categoryIds: bucket.categoryIds ?? [],
          target: bucket.target && bucket.target > 0 ? bucket.target : null,
          by: bucket.by && /^\d{4}-\d{2}$/.test(bucket.by) ? bucket.by : null,
          startMonth: /^\d{4}-\d{2}$/.test(bucket.startMonth) ? bucket.startMonth : get().activeMonth,
          opening: Math.max(0, bucket.opening || 0),
          fromGoalId: null,
          monthlyFrom: /^\d{4}-\d{2}$/.test(bucket.startMonth) ? bucket.startMonth : get().activeMonth,
          pastRates: [],
          paused: false,
          pausedFrom: null,
          fullLine: bucket.fullLine && bucket.fullLine > 0 ? bucket.fullLine : null,
          nudgeDismissedYm: null,
        };
        set({ moneyBuckets: [...(get().moneyBuckets ?? []), next] });
        schedulePersist();
      },
      updateBucket: (id, patch) => {
        const asOf = get().activeMonth;
        set({
          moneyBuckets: (get().moneyBuckets ?? []).map((b) => {
            if (b.id !== id) return b;
            let next = { ...b };
            if (patch.name != null) next.name = patch.name.trim() || b.name;
            if (patch.target !== undefined) next.target = patch.target && patch.target > 0 ? patch.target : null;
            if (patch.by !== undefined) next.by = patch.by && /^\d{4}-\d{2}$/.test(patch.by) ? patch.by : null;
            if (patch.fullLine !== undefined) next.fullLine = patch.fullLine && patch.fullLine > 0 ? patch.fullLine : null;
            if (patch.nudgeDismissedYm !== undefined) next.nudgeDismissedYm = patch.nudgeDismissedYm;
            if (patch.categoryIds) next.categoryIds = patch.categoryIds;
            if (patch.opening != null) next.opening = Math.max(0, patch.opening);
            const yearly = patch.yearly && patch.yearly > 0 ? patch.yearly : null;
            if (patch.yearly && patch.yearly > 0) {
              next = withMonthlyChange(next, roundMoney(patch.yearly / 12), asOf);
              next.yearly = yearly;
            } else if (patch.monthly != null && patch.monthly !== b.monthly) {
              next = withMonthlyChange(next, patch.monthly, asOf);
              if (patch.yearly === null) next.yearly = null;
            }
            if (patch.paused != null && patch.paused !== Boolean(b.paused)) next = withPaused(next, patch.paused, asOf);
            return next;
          }),
        });
        schedulePersist();
      },
      removeBucket: (id) => {
        const bucket = (get().moneyBuckets ?? []).find((b) => b.id === id);
        set({
          moneyBuckets: (get().moneyBuckets ?? []).filter((b) => b.id !== id),
          bucketMoves: (get().bucketMoves ?? []).filter((m) => m.toId !== id && m.fromId !== id),
          savingsGoals: bucket?.fromGoalId
            ? (get().savingsGoals ?? []).filter((g) => g.id !== bucket.fromGoalId)
            : get().savingsGoals,
        });
        schedulePersist();
      },
      linkBucketCategory: (bucketId, categoryId) => {
        const linked = linkCategoryState({
          categories: get().categories,
          monthBudgets: get().monthBudgets ?? [],
          buckets: get().moneyBuckets ?? [],
          categoryId,
          bucketId,
        });
        if (!linked) return "That category is not in this ledger.";
        const name = get().categories.find((c) => c.id === categoryId)?.name ?? "That category";
        const bucket = (get().moneyBuckets ?? []).find((b) => b.id === bucketId)?.name ?? "that savings";
        set({
          categories: linked.categories,
          monthBudgets: linked.monthBudgets,
          moneyBuckets: linked.buckets,
        });
        schedulePersist();
        return `${name} now comes out of ${bucket}. The monthly amount was cleared so it is not counted twice.`;
      },
      unlinkBucketCategory: (bucketId, categoryId) => {
        set({
          moneyBuckets: (get().moneyBuckets ?? []).map((b) =>
            b.id === bucketId ? { ...b, categoryIds: b.categoryIds.filter((id) => id !== categoryId) } : b,
          ),
        });
        schedulePersist();
      },
      setKeepsLeftovers: (categoryId, on) => {
        const cat = get().categories.find((c) => c.id === categoryId);
        if (!cat || cat.kind !== "expense") return;
        const buckets = get().moneyBuckets ?? [];
        if (!on) {
          const host = buckets.find((b) => b.categoryIds.includes(categoryId));
          const monthly = host?.monthly ?? cat.plannedMonthly;
          const moneyBuckets = buckets.flatMap((b) => {
            if (!b.categoryIds.includes(categoryId)) return [b];
            const categoryIds = b.categoryIds.filter((id) => id !== categoryId);
            const onlyThis =
              categoryIds.length === 0 &&
              !b.target &&
              !b.fromGoalId &&
              b.opening === 0 &&
              !(b.pastRates && b.pastRates.length) &&
              !b.paused;
            if (onlyThis) return [];
            return [{ ...b, categoryIds }];
          });
          set({
            moneyBuckets,
            categories: get().categories.map((c) => (c.id === categoryId ? { ...c, plannedMonthly: monthly } : c)),
          });
          schedulePersist();
          return;
        }
        if (buckets.some((b) => b.categoryIds.includes(categoryId))) return;
        const id = newId("bucket");
        const linked = linkCategoryState({
          categories: get().categories,
          monthBudgets: get().monthBudgets ?? [],
          buckets: [
            ...buckets,
            {
              id,
              name: cat.name,
              monthly: cat.plannedMonthly,
              yearly: null,
              categoryIds: [],
              target: null,
              by: null,
              startMonth: get().activeMonth,
              opening: 0,
              fromGoalId: null,
              monthlyFrom: get().activeMonth,
              pastRates: [],
              paused: false,
              pausedFrom: null,
              fullLine: null,
              nudgeDismissedYm: null,
            },
          ],
          categoryId,
          bucketId: id,
        });
        if (!linked) return;
        set({
          categories: linked.categories,
          monthBudgets: linked.monthBudgets,
          moneyBuckets: linked.buckets,
        });
        schedulePersist();
      },
      moveBucketMoney: (move) => {
        const amount = Math.abs(Number(move.amount) || 0);
        if (!move.toId || amount <= 0 || !/^\d{4}-\d{2}$/.test(move.ym)) return;
        if (move.fromId && move.fromId === move.toId) return;
        const next: BucketMove = {
          id: newId("move"),
          ym: move.ym,
          amount: roundMoney(amount),
          fromId: move.fromId,
          toId: move.toId,
        };
        set({ bucketMoves: [...(get().bucketMoves ?? []), next] });
        schedulePersist();
      },
      addNetWorth: (point) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date)) return;
        set({
          netWorth: [...(get().netWorth ?? []), { ...point, id: newId("nw"), note: point.note.trim() }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        });
        schedulePersist();
      },
      removeNetWorth: (id) => {
        set({ netWorth: (get().netWorth ?? []).filter((p) => p.id !== id) });
        schedulePersist();
      },
      addDebt: (debt) => {
        const name = debt.name.trim();
        if (!name || debt.balance <= 0) return;
        set({
          debts: [
            ...(get().debts ?? []),
            {
              id: newId("debt"),
              name,
              balance: roundMoney(debt.balance),
              apr: Math.max(0, debt.apr || 0),
              minimum: Math.max(0, debt.minimum || 0),
            },
          ],
        });
        schedulePersist();
      },
      updateDebt: (id, patch) => {
        set({ debts: (get().debts ?? []).map((d) => (d.id === id ? { ...d, ...patch } : d)) });
        schedulePersist();
      },
      removeDebt: (id) => {
        set({ debts: (get().debts ?? []).filter((d) => d.id !== id) });
        schedulePersist();
      },
      patchIra: (patch) => {
        set({ ira: { ...(get().ira ?? DEFAULT_IRA), ...patch } });
        schedulePersist();
      },
      markPaidBack: (expenseId, depositId, label = "") => {
        set({
          transactions: get().transactions.map((t) => {
            if (t.id === expenseId) {
              return {
                ...t,
                status: "reimbursement",
                excluded: false,
                notes: paybackNotes(depositId, label),
                userSet: true,
              };
            }
            if (depositId && t.id === depositId) {
              return {
                ...t,
                status: "reimbursement",
                excluded: false,
                notes: paybackNotes(expenseId, label),
                userSet: true,
              };
            }
            return t;
          }),
        });
        schedulePersist();
      },
      undoPaidBack: (id) => {
        const tx = get().transactions.find((t) => t.id === id);
        const other = paybackPartnerId(tx?.notes ?? "");
        set({
          transactions: get().transactions.map((t) => {
            if (t.id !== id && t.id !== other) return t;
            return {
              ...t,
              status: "posted",
              notes: t.notes.startsWith("payback") ? "" : t.notes,
            };
          }),
        });
        schedulePersist();
      },
      countAsIncome: (id) => {
        const cats = get().categories;
        const fallback = cats.find((c) => c.slug === "other-income") ?? cats.find((c) => c.kind === "income" && c.slug !== "transfers-in");
        set({
          transactions: get().transactions.map((t) => {
            if (t.id !== id) return t;
            const cat = t.categoryId ? cats.find((c) => c.id === t.categoryId) : undefined;
            const hidden = !cat || cat.slug === "transfers-in" || cat.slug === "transfers-out";
            return {
              ...t,
              status: "posted",
              excluded: false,
              categoryId: hidden ? (fallback?.id ?? t.categoryId) : t.categoryId,
              userSet: true,
              notes: t.notes.startsWith("payback") ? "" : t.notes,
            };
          }),
        });
        schedulePersist();
      },
      countHiddenDeposits: () => {
        const cats = get().categories;
        const fallback =
          cats.find((c) => c.slug === "other-income") ??
          cats.find((c) => c.kind === "income" && c.slug !== "transfers-in");
        let n = 0;
        set({
          transactions: get().transactions.map((t) => {
            if (t.excluded || t.status !== "transfer" || t.amount <= 0) return t;
            n += 1;
            const cat = t.categoryId ? cats.find((c) => c.id === t.categoryId) : undefined;
            const hidden = !cat || cat.kind !== "income" || cat.slug === "transfers-in" || cat.slug === "transfers-out";
            return {
              ...t,
              status: "posted" as const,
              excluded: false,
              categoryId: hidden ? (fallback?.id ?? t.categoryId) : t.categoryId,
              userSet: true,
              notes: t.notes.startsWith("payback") ? "" : t.notes,
            };
          }),
        });
        if (n) schedulePersist();
        return n;
      },
      importPreview: (preview, flipSign) => {
        const rows = applyAmountFlip(preview, flipSign);
        const { added, skipped } = applyImportRows(
          rows,
          preview.guessedSource,
          get().transactions,
          get().categories,
          get().merchantRules,
        );
        const batch: ImportBatch = {
          id: newId("imp"),
          fileName: preview.fileName,
          importedAt: new Date().toISOString(),
          added: added.length,
          skippedDuplicates: skipped,
          sourceLabel: preview.guessedSource,
        };
        const next = [...added, ...get().transactions].sort(
          (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
        );
        set({
          transactions: next,
          imports: [batch, ...get().imports].slice(0, 40),
          ...openToday(),
        });
        void flushPersist();
        return {
          added: added.length,
          skipped,
          categorized: added.filter((t) => t.categoryId).length,
          uncategorized: added.filter((t) => !t.categoryId).length,
        };
      },
      loadSample: () => {
        const detail = get().profile.detail === "nerd" ? "nerd" : "simple";
        const profile: Profile = { ...SAMPLE_PROFILE, completedOnboarding: true, detail, detailChosen: true };
        const categories = buildPresetCategories(profile).map((c) =>
          c.slug === "food" ? { ...c, plannedMonthly: 0 } : c,
        );
        const preview = parseCsvText(SAMPLE_CSV, "sample-chase.csv");
        const { added } = applyImportRows(preview.rows, "Demo bank file", [], categories, []);
        const food = categories.find((c) => c.slug === "food");
        const pay = categories.find((c) => c.slug === "paycheck");
        const side = categories.find((c) => c.slug === "side-work");
        const dressed = added.map((t) => ({ ...t }));
        const split = [...dressed].reverse().find((t) => t.description.includes("NORTHWIND PAYROLL") && t.amount > 2000);
        if (split && pay && side) {
          const sideAmt = 480;
          const payAmt = roundMoney(split.amount - sideAmt);
          split.splits = [
            { categoryId: pay.id, amount: payAmt },
            { categoryId: side.id, amount: sideAmt },
          ];
          split.categoryId = pay.id;
          split.userSet = true;
        }
        const cafe = dressed.find((t) => t.description.includes("CORNER CAFE") && t.amount === -22.4);
        const friend = dressed.find((t) => t.description.includes("ZELLE PAYMENT FROM A FRIEND"));
        if (cafe && friend) {
          cafe.status = "reimbursement";
          cafe.notes = paybackNotes(friend.id, "A friend");
          cafe.userSet = true;
          friend.status = "reimbursement";
          friend.notes = paybackNotes(cafe.id, "A friend");
          friend.userSet = true;
        }
        const goalId = "goal_demo_car";
        set({
          profile,
          categories,
          transactions: dressed.sort((a, b) => b.date.localeCompare(a.date)),
          merchantRules: [],
          monthBudgets: [],
          savingsGoals: [{ id: goalId, name: "Used car", target: 6000, saved: 900, by: "2027-06" }],
          moneyBuckets: [
            {
              id: "bucket_demo_groceries",
              name: "Groceries",
              monthly: 220,
              yearly: null,
              categoryIds: food ? [food.id] : [],
              target: null,
              by: null,
              startMonth: "2026-06",
              opening: 40,
              fromGoalId: null,
            },
            {
              id: `bucket_goal_${goalId}`,
              name: "Used car",
              monthly: 150,
              yearly: null,
              categoryIds: [],
              target: 6000,
              by: "2027-06",
              startMonth: "2026-06",
              opening: 900,
              fromGoalId: goalId,
            },
          ],
          bucketMoves: [],
          netWorth: [
            { id: "nw_demo_1", date: "2026-06-30", amount: 4200, note: "Checking and savings" },
            { id: "nw_demo_2", date: "2026-09-30", amount: 5100, note: "After the car fund" },
          ],
          debts: [{ id: "debt_demo_card", name: "Store card", balance: 640, apr: 19.9, minimum: 25 }],
          ira: { ...DEFAULT_IRA },
          imports: [
            {
              id: newId("imp"),
              fileName: "sample-demo.csv",
              importedAt: new Date().toISOString(),
              added: dressed.length,
              skippedDuplicates: 0,
              sourceLabel: "Demo bank file",
            },
          ],
          ...openToday(),
        });
        void flushPersist();
      },
      deleteTransaction: (id) => {
        set({ transactions: get().transactions.filter((t) => t.id !== id) });
        schedulePersist();
      },
      restoreBackup: (raw) => {
        const parsed = parseBackup(raw);
        if (!parsed.ok) return parsed;
        set({
          profile: parsed.data.profile,
          categories: parsed.data.categories,
          transactions: [...parsed.data.transactions].sort((a, b) => b.date.localeCompare(a.date)),
          merchantRules: parsed.data.merchantRules,
          monthBudgets: parsed.data.monthBudgets,
          savingsGoals: parsed.data.savingsGoals ?? [],
          moneyBuckets: parsed.data.moneyBuckets ?? [],
          bucketMoves: parsed.data.bucketMoves ?? [],
          netWorth: parsed.data.netWorth ?? [],
          debts: parsed.data.debts ?? [],
          ira: parsed.data.ira,
          imports: [
            {
              id: newId("imp"),
              fileName: "harbor-ledger-backup.json",
              importedAt: new Date().toISOString(),
              added: parsed.data.transactions.length,
              skippedDuplicates: 0,
              sourceLabel: "Restored backup",
            },
          ],
          ...openToday(),
        });
        void flushPersist();
        return { ok: true, count: parsed.data.transactions.length };
      },
    }),
    {
      name: LOCAL_KEY,
      partialize: (s) => snapshotOf(s),
      onRehydrateStorage: () => {
        silenceEpoch = true;
        return (state) => {
          silenceEpoch = false;
          state?.setHydrated();
        };
      },
    },
  ),
);

export { flushPersist };

useBudgetStore.subscribe((state, prev) => {
  if (silenceEpoch) return;
  if (
    state.profile !== prev.profile ||
    state.categories !== prev.categories ||
    state.transactions !== prev.transactions ||
    state.merchantRules !== prev.merchantRules ||
    state.imports !== prev.imports ||
    state.monthBudgets !== prev.monthBudgets ||
    state.savingsGoals !== prev.savingsGoals ||
    state.moneyBuckets !== prev.moneyBuckets ||
    state.bucketMoves !== prev.bucketMoves ||
    state.netWorth !== prev.netWorth ||
    state.debts !== prev.debts ||
    state.ira !== prev.ira ||
    state.activeMonth !== prev.activeMonth ||
    state.activeWeek !== prev.activeWeek
  ) {
    mutationEpoch += 1;
  }
});

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void flushPersist();
  });
}
