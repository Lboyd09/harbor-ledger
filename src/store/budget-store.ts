import { create } from "zustand";
import { persist } from "zustand/middleware";
import { linkCategoryState, migrateGoals, withMonthlyChange, withPaused } from "@/lib/budget/buckets";
import { parseBackup } from "@/lib/budget/backup";
import { replaceMerchantRule } from "@/lib/budget/categorize";
import {
  applyChange,
  captureRow,
  resetToDefault,
  restoreChanges,
  sideOf,
  type CategoryUndo,
  type ChangeScope,
} from "@/lib/budget/sorting";
import { parseCsvText, applyAmountFlip } from "@/lib/budget/csv";
import { importNewRows, applyConfirmAuto, rememberBankLabel } from "@/lib/budget/auto-sort";
import { applyAdoptedIncome, monthEndBalances, type IncomeSuggestion } from "@/lib/budget/file-inference";
import { newId } from "@/lib/budget/ids";
import { DEFAULT_IRA } from "@/lib/budget/ira";
import { roundMoney } from "@/lib/budget/money";
import { emptySnapshot, normalizeProfile, normalizeSnapshot } from "@/lib/budget/normalize";
import {
  accountAcceptsFile,
  accountHasActivity,
  createAccount,
  enteredBalanceAmount,
  migrateLedgerAccounts,
  quickCash,
  quickInvestment,
  storedFileBalance,
  upsertFileBalance,
} from "@/lib/budget/accounts";
import { applyCompleteSetup, isDemoLedger, type SetupExtras } from "@/lib/budget/onboarding-plan";
import { earliestDataMonth } from "@/lib/budget/ledger-month";
import { withBudgetStyle } from "@/lib/budget/style";
import { currentMonthKey, currentWeekKey } from "@/lib/budget/parse-date";
import { clearLedger, loadLedger, saveLedger } from "@/lib/budget/persist";
import { paybackNotes, paybackPartnerId } from "@/lib/budget/payback";
import { patchCategory, freezePastUsual, withMonthPlan } from "@/lib/budget/plans";
import { buildPresetCategories } from "@/lib/budget/presets";
import { recommendedPlans } from "@/lib/budget/year";
import { SAMPLE_CSV, SAMPLE_PROFILE } from "@/lib/budget/sample";
import type {
  Account,
  AccountKind,
  BalancePoint,
  BucketMove,
  BudgetPeriod,
  BudgetStyle,
  Category,
  CsvPreview,
  DebtItem,
  ImportBatch,
  IraRules,
  LedgerSnapshot,
  MoneyBucket,
  NetWorthPoint,
  Profile,
  SavingsGoal,
  SetAside,
  Transaction,
  TxSplit,
} from "@/lib/budget/types";

type ImportResult = {
  added: number;
  skipped: number;
  categorized: number;
  uncategorized: number;
  addedIds: string[];
  accountId: string | null;
  needsBalance: boolean;
};
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
  completeSetup: (profile: Profile, categories: Category[], extras?: SetupExtras) => void;
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
  setCategoryScoped: (id: string, categoryId: string | null, scope: ChangeScope) => CategoryUndo | null;
  setMerchantDefault: (
    merchantKey: string,
    side: "in" | "out",
    categoryId: string | null,
    options?: { includePinned?: boolean },
  ) => CategoryUndo;
  resetChargeToDefault: (id: string) => CategoryUndo | null;
  restoreCategories: (undo: CategoryUndo) => void;
  confirmAuto: (ids: string[]) => CategoryUndo;
  adoptIncomeStreams: (suggestions: IncomeSuggestion[]) => void;
  applyRecommendedPlans: (year: string) => number;
  patchTransaction: (id: string, patch: Partial<Pick<Transaction, "excluded" | "status" | "notes">>) => void;
  setSplits: (id: string, splits: TxSplit[] | null) => void;
  addGoal: (goal: Omit<SavingsGoal, "id">) => void;
  updateGoal: (id: string, patch: Partial<Omit<SavingsGoal, "id">>) => void;
  removeGoal: (id: string) => void;
  addBucket: (bucket: Omit<MoneyBucket, "id">) => string;
  updateBucket: (id: string, patch: Partial<Omit<MoneyBucket, "id">>) => void;
  removeBucket: (id: string) => void;
  linkBucketCategory: (bucketId: string, categoryId: string) => string;
  unlinkBucketCategory: (bucketId: string, categoryId: string) => void;
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
  setBudgetStyle: (style: BudgetStyle, options?: { carryStartMonth?: string; today?: string }) => void;
  addAccount: (input: { name: string; kind: AccountKind; institution?: string | null }) => string;
  updateAccount: (id: string, patch: Partial<Pick<Account, "name" | "kind" | "institution" | "growth">>) => void;
  removeAccount: (id: string) => boolean;
  archiveAccount: (id: string) => boolean;
  undoLast: () => boolean;
  addBalance: (accountId: string, amount: number, date?: string) => void;
  addCash: (amount: number, date?: string, name?: string) => string;
  addInvestment: (input: { name?: string | null; pick: "brokerage" | "roth" | "traditional" | "401k" | "other"; amount: number; date?: string }) => string;
  addSetAside: (input: { ym: string; categoryId: string; fundId: string | null; amount: number }) => string;
  removeSetAside: (id: string) => void;
  addCashCharge: (input: { categoryId: string; amount: number; date: string; description?: string }) => void;
  importPreview: (preview: CsvPreview, flipSign: boolean, accountId?: string | null, balanceAmount?: number | null) => ImportResult;
  loadSample: () => void;
  deleteTransaction: (id: string) => void;
  restoreBackup: (raw: unknown) => { ok: true; count: number } | { ok: false; error: string };
};

function todayInput() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

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
    accounts: s.accounts ?? [],
    balances: s.balances ?? [],
    setAsides: s.setAsides ?? [],
    activeMonth: s.activeMonth,
    activeWeek: s.activeWeek,
  };
}

let lastUndo: LedgerSnapshot | null = null;

function captureUndo(state: LedgerSnapshot) {
  lastUndo = snapshotOf(state);
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
        const profile = normalizeProfile(s.profile);
        const migrated = migrateLedgerAccounts({
          accounts: s.accounts ?? [],
          balances: s.balances ?? [],
          transactions: s.transactions,
          imports: s.imports ?? [],
        });
        quiet(() =>
          set({
            hydrated: true,
            ...openToday(),
            profile: { ...profile, detail: profile.detail === "nerd" ? "nerd" : "simple" },
            transactions: migrated.transactions,
            imports: migrated.imports,
            accounts: migrated.accounts,
            balances: migrated.balances,
            setAsides: s.setAsides ?? [],
            monthBudgets: s.monthBudgets ?? [],
            savingsGoals: s.savingsGoals ?? [],
            moneyBuckets: migrateGoals(s.savingsGoals ?? [], s.moneyBuckets ?? [], month),
            bucketMoves: s.bucketMoves ?? [],
            netWorth: s.netWorth ?? [],
            debts: s.debts ?? [],
            ira: s.ira ?? DEFAULT_IRA,
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
      completeSetup: (profile, categories, extras) => {
        set(applyCompleteSetup(get(), profile, categories, extras));
        void flushPersist();
      },
      reopenSetup: () => {
        const state = get();
        set({ profile: { ...state.profile, completedOnboarding: false, demo: isDemoLedger(state) } });
        schedulePersist();
      },
      cancelSetup: () => {
        if (!get().categories.length && !get().transactions.length) return;
        set({ profile: { ...get().profile, completedOnboarding: true } });
        schedulePersist();
      },
      patchProfile: (patch) => {
        const profile = { ...get().profile, ...patch, completedOnboarding: get().profile.completedOnboarding };
        for (const key of Object.keys(patch) as (keyof typeof profile)[]) {
          if (patch[key] === undefined) delete profile[key];
        }
        set({ profile });
        schedulePersist();
      },
      setBudgetStyle: (style, options) => {
        captureUndo(get());
        const profile = get().profile;
        let carryStartMonth = options?.carryStartMonth;
        if (style === "buckets" && !carryStartMonth && !profile.carryStartMonth) {
          carryStartMonth = earliestDataMonth(get().transactions) ?? undefined;
        }
        set({
          profile: withBudgetStyle(profile, style, {
            ...options,
            ...(carryStartMonth ? { carryStartMonth } : {}),
          }),
        });
        schedulePersist();
      },
      addAccount: (input) => {
        const account = createAccount(get().accounts ?? [], input);
        if (!account) return "";
        set({ accounts: [...(get().accounts ?? []), account] });
        schedulePersist();
        return account.id;
      },
      updateAccount: (id, patch) => {
        set({
          accounts: (get().accounts ?? []).map((account) => {
            if (account.id !== id) return account;
            const next = { ...account };
            if (patch.name != null && patch.name.trim()) next.name = patch.name.trim();
            if (patch.kind != null) next.kind = patch.kind;
            if (patch.institution !== undefined) next.institution = patch.institution?.trim() ? patch.institution.trim() : null;
            if (patch.growth !== undefined) next.growth = patch.growth;
            return next;
          }),
        });
        schedulePersist();
      },
      removeAccount: (id) => {
        const accounts = get().accounts ?? [];
        if (!accounts.some((account) => account.id === id)) return false;
        captureUndo(get());
        if (accountHasActivity(id, get().transactions, get().imports ?? [])) {
          set({ accounts: accounts.map((account) => (account.id === id ? { ...account, archived: true } : account)) });
        } else {
          set({
            accounts: accounts.filter((account) => account.id !== id),
            balances: (get().balances ?? []).filter((point) => point.accountId !== id),
          });
        }
        schedulePersist();
        return true;
      },
      archiveAccount: (id) => {
        const accounts = get().accounts ?? [];
        if (!accounts.some((account) => account.id === id)) return false;
        captureUndo(get());
        set({ accounts: accounts.map((account) => (account.id === id ? { ...account, archived: true } : account)) });
        schedulePersist();
        return true;
      },
      undoLast: () => {
        if (!lastUndo) return false;
        const snap = lastUndo;
        lastUndo = null;
        set({ ...snap });
        schedulePersist();
        return true;
      },
      addBalance: (accountId, amount, date) => {
        const account = (get().accounts ?? []).find((item) => item.id === accountId);
        if (!account || !Number.isFinite(amount)) return;
        const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayInput();
        const point: BalancePoint = {
          id: newId("bal"),
          accountId,
          date: day,
          amount: enteredBalanceAmount(account.kind, amount),
          source: "entered",
        };
        set({ balances: [...(get().balances ?? []), point] });
        schedulePersist();
      },
      addCash: (amount, date, name) => {
        const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayInput();
        const next = quickCash(get().accounts ?? [], get().balances ?? [], amount, day, name);
        if (!next) return "";
        const id = next.accounts.find((account) => account.kind === "cash")?.id ?? "";
        set({ accounts: next.accounts, balances: next.balances });
        schedulePersist();
        return id;
      },
      addInvestment: (input) => {
        const day = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayInput();
        const before = new Set((get().accounts ?? []).map((account) => account.id));
        const next = quickInvestment(get().accounts ?? [], get().balances ?? [], input, day);
        if (!next) return "";
        const id = next.accounts.find((account) => !before.has(account.id))?.id ?? "";
        set({ accounts: next.accounts, balances: next.balances });
        schedulePersist();
        return id;
      },
      addSetAside: (input) => {
        if (!/^\d{4}-\d{2}$/.test(input.ym) || !input.categoryId || !(input.amount > 0)) return "";
        const id = newId("aside");
        const row: SetAside = {
          id,
          ym: input.ym,
          categoryId: input.categoryId,
          fundId: input.fundId,
          amount: roundMoney(input.amount),
        };
        set({ setAsides: [...(get().setAsides ?? []), row] });
        schedulePersist();
        return id;
      },
      removeSetAside: (id) => {
        set({ setAsides: (get().setAsides ?? []).filter((row) => row.id !== id) });
        schedulePersist();
      },
      addCashCharge: (input) => {
        if (!input.categoryId || !Number.isFinite(input.amount) || input.amount === 0) return;
        const day = /^\d{4}-\d{2}-\d{2}$/.test(input.date) && input.date <= todayInput() ? input.date : todayInput();
        const description = input.description?.trim() || "Cash";
        const row: Transaction = {
          id: newId("tx"),
          date: day,
          description,
          merchantKey: description.toUpperCase(),
          amount: roundMoney(-Math.abs(input.amount)),
          sourceLabel: "Cash",
          fingerprint: newId("fp"),
          categoryId: input.categoryId,
          userSet: true,
          notes: "",
          excluded: false,
          status: "posted",
          pinned: "charge",
        };
        set({ transactions: [row, ...get().transactions] });
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
        captureUndo(get());
        const current = get().categories.find((category) => category.id === id);
        let monthBudgets = get().monthBudgets ?? [];
        if (current && patch.plannedMonthly != null && Number.isFinite(patch.plannedMonthly) && patch.plannedMonthly !== current.plannedMonthly) {
          const carry = current.carryFrom && /^\d{4}-\d{2}$/.test(current.carryFrom) ? current.carryFrom : null;
          const fromProfile = get().profile.carryStartMonth;
          const start = carry ?? (fromProfile && /^\d{4}-\d{2}$/.test(fromProfile) ? fromProfile : null) ?? earliestDataMonth(get().transactions);
          monthBudgets = freezePastUsual(monthBudgets, id, current.plannedMonthly || 0, get().activeMonth, start);
        }
        set({ categories: patchCategory(get().categories, id, patch), monthBudgets });
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
        set({ monthBudgets: withMonthPlan(get().monthBudgets ?? [], categoryId, ym, amount) });
        schedulePersist();
      },
      setTransactionCategory: (id, categoryId, applyToMerchant) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx) return;
        if (applyToMerchant) {
          get().setMerchantCategory(tx.merchantKey, categoryId, sideOf(tx));
          return;
        }
        set({
          transactions: get().transactions.map((t) =>
            t.id === id ? { ...t, categoryId, userSet: true, auto: null } : t,
          ),
          profile: rememberBankLabel(get().profile, tx.bankLabel, categoryId),
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
        const matched = get().transactions.filter(match);
        set({
          merchantRules: replaceMerchantRule(get().merchantRules, key, categoryId, side),
          transactions: get().transactions.map((t) =>
            match(t) ? { ...t, categoryId, userSet: true, splits: null, auto: null } : t,
          ),
          profile: matched.reduce((profile, row) => rememberBankLabel(profile, row.bankLabel, categoryId), get().profile),
        });
        schedulePersist();
      },
      setCategoryScoped: (id, categoryId, scope) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx) return null;
        const applied = applyChange({
          transactions: get().transactions,
          merchantRules: get().merchantRules,
          merchantKey: tx.merchantKey,
          side: sideOf(tx),
          ym: tx.date.slice(0, 7),
          categoryId,
          scope,
          id,
        });
        const changed = new Set(applied.before.map((row) => row.id));
        const labeled = get().transactions.filter((row) => changed.has(row.id));
        set({
          transactions: applied.transactions,
          merchantRules: applied.merchantRules,
          profile: labeled.reduce((profile, row) => rememberBankLabel(profile, row.bankLabel, categoryId), get().profile),
        });
        schedulePersist();
        return { rows: applied.before, rules: applied.rulesBefore };
      },
      setMerchantDefault: (merchantKey, side, categoryId, options) => {
        const applied = applyChange({
          transactions: get().transactions,
          merchantRules: get().merchantRules,
          merchantKey,
          side,
          categoryId,
          scope: "default",
          includePinned: options?.includePinned,
        });
        const changed = new Set(applied.before.map((row) => row.id));
        const labeled = get().transactions.filter((row) => changed.has(row.id));
        set({
          transactions: applied.transactions,
          merchantRules: applied.merchantRules,
          profile: labeled.reduce((profile, row) => rememberBankLabel(profile, row.bankLabel, categoryId), get().profile),
        });
        schedulePersist();
        return { rows: applied.before, rules: applied.rulesBefore };
      },
      resetChargeToDefault: (id) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx) return null;
        const undo: CategoryUndo = { rows: [captureRow(tx)], rules: null };
        set({
          transactions: get().transactions.map((t) => (t.id === id ? resetToDefault(t, get().merchantRules) : t)),
        });
        schedulePersist();
        return undo;
      },
      restoreCategories: (undo) => {
        set({
          transactions: restoreChanges(get().transactions, undo.rows),
          ...(undo.rules ? { merchantRules: undo.rules } : {}),
        });
        schedulePersist();
      },
      confirmAuto: (ids) => {
        const before = get()
          .transactions.filter((row) => ids.includes(row.id))
          .map(captureRow);
        const applied = applyConfirmAuto(get().transactions, ids, get().profile);
        set({ transactions: applied.transactions, profile: applied.profile });
        schedulePersist();
        return { rows: before, rules: null };
      },
      adoptIncomeStreams: (suggestions) => {
        const next = applyAdoptedIncome({
          profile: get().profile,
          categories: get().categories,
          transactions: get().transactions,
          suggestions,
          createCategoryId: () => newId("cat"),
          createStreamId: () => newId("income"),
        });
        set({ profile: next.profile, categories: next.categories, transactions: next.transactions });
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
              auto: null,
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
        if (!name) return "";
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
        return next.id;
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
      importPreview: (preview, flipSign, accountId, balanceAmount) => {
        const rows = applyAmountFlip(preview, flipSign);
        const chosen = accountId || null;
        const { added, skipped, transactions } = importNewRows({
          rows,
          sourceLabel: preview.guessedSource,
          existing: get().transactions,
          categories: get().categories,
          rules: get().merchantRules,
          incomeStreams: get().profile.incomeStreams ?? [],
          bankLabelMap: get().profile.bankLabelMap,
          accountId: chosen,
          createId: () => newId("tx"),
        });
        const account = chosen ? (get().accounts ?? []).find((item) => item.id === chosen) : undefined;
        const rawEnd = preview.endingBalance;
        let ending: ImportBatch["endingBalance"] = null;
        let balances = get().balances ?? [];
        if (account && rawEnd && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd.asOf) && Number.isFinite(rawEnd.amount)) {
          const amount =
            balanceAmount != null && Number.isFinite(balanceAmount)
              ? roundMoney(balanceAmount)
              : storedFileBalance(account.kind, rawEnd.amount);
          ending = { amount, asOf: rawEnd.asOf };
          balances = upsertFileBalance(balances, { accountId: account.id, date: rawEnd.asOf, amount });
        }
        if (account) {
          for (const point of monthEndBalances(rows)) {
            if (point.date === rawEnd?.asOf) continue;
            balances = upsertFileBalance(balances, {
              accountId: account.id,
              date: point.date,
              amount: storedFileBalance(account.kind, point.amount),
            });
          }
        }
        const batch: ImportBatch = {
          id: newId("imp"),
          fileName: preview.fileName,
          importedAt: new Date().toISOString(),
          added: added.length,
          skippedDuplicates: skipped,
          sourceLabel: preview.guessedSource,
          accountId: chosen,
          endingBalance: ending,
        };
        const next = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        const firstMonth = earliestDataMonth(next);
        const profile = get().profile.carryStartMonth || !firstMonth ? get().profile : { ...get().profile, carryStartMonth: firstMonth };
        set({
          profile,
          transactions: next,
          balances,
          imports: [batch, ...(get().imports ?? [])].slice(0, 40),
          ...openToday(),
        });
        void flushPersist();
        const needsBalance = Boolean(account && accountAcceptsFile(account.kind) && !rawEnd);
        return {
          added: added.length,
          skipped,
          categorized: added.filter((t) => t.categoryId || t.auto?.confidence === "sure").length,
          uncategorized: added.filter((t) => !t.categoryId && t.auto?.confidence !== "sure").length,
          addedIds: added.map((t) => t.id),
          accountId: chosen,
          needsBalance,
        };
      },
      loadSample: () => {
        const detail = get().profile.detail === "nerd" ? "nerd" : "simple";
        const profile: Profile = { ...SAMPLE_PROFILE, completedOnboarding: true, detail, detailChosen: true };
        const categories = buildPresetCategories(profile).map((c) =>
          c.slug === "food" ? { ...c, plannedMonthly: 0 } : c,
        );
        const preview = parseCsvText(SAMPLE_CSV, "sample-chase.csv");
        const { added } = importNewRows({
          rows: preview.rows,
          sourceLabel: "Demo bank file",
          existing: [],
          categories,
          rules: [],
          createId: () => newId("tx"),
        });
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
          split.auto = null;
        }
        const cafe = dressed.find((t) => t.description.includes("CORNER CAFE") && t.amount === -22.4);
        const friend = dressed.find((t) => t.description.includes("ZELLE PAYMENT FROM A FRIEND"));
        if (cafe && friend) {
          cafe.status = "reimbursement";
          cafe.notes = paybackNotes(friend.id, "A friend");
          cafe.userSet = true;
          cafe.auto = null;
          friend.status = "reimbursement";
          friend.notes = paybackNotes(cafe.id, "A friend");
          friend.userSet = true;
          friend.auto = null;
        }
        const goalId = "goal_demo_car";
        const ordered = dressed.sort((a, b) => b.date.localeCompare(a.date));
        const profileWithStart = { ...profile, carryStartMonth: earliestDataMonth(ordered), demo: true };
        set({
          profile: profileWithStart,
          categories,
          transactions: ordered,
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
          setAsides: [],
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
        captureUndo(get());
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
          accounts: parsed.data.accounts ?? [],
          balances: parsed.data.balances ?? [],
          setAsides: parsed.data.setAsides ?? [],
          imports: [
            {
              id: newId("imp"),
              fileName: "budgetflow-backup.json",
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
    state.accounts !== prev.accounts ||
    state.balances !== prev.balances ||
    state.setAsides !== prev.setAsides ||
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
