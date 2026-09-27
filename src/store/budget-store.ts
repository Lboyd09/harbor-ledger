import { create } from "zustand";
import { persist } from "zustand/middleware";
import { parseBackup } from "@/lib/budget/backup";
import { suggestCategory } from "@/lib/budget/categorize";
import { parseCsvText, applyAmountFlip } from "@/lib/budget/csv";
import { fingerprint } from "@/lib/budget/fingerprint";
import { newId } from "@/lib/budget/ids";
import { merchantKey } from "@/lib/budget/merchant";
import { emptySnapshot, normalizeSnapshot } from "@/lib/budget/normalize";
import { currentMonthKey, currentWeekKey, monthKeyFromDate, weekKeyFromDate } from "@/lib/budget/parse-date";
import { loadLedger, saveLedger } from "@/lib/budget/persist";
import { paybackNotes, paybackPartnerId } from "@/lib/budget/payback";
import { buildPresetCategories } from "@/lib/budget/presets";
import { recommendedPlans } from "@/lib/budget/year";
import { SAMPLE_CSV, SAMPLE_PROFILE } from "@/lib/budget/sample";
import type {
  BudgetPeriod,
  Category,
  CsvPreview,
  ImportBatch,
  LedgerSnapshot,
  MerchantRule,
  Profile,
  Transaction,
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
  resetAll: () => void;
  setActiveMonth: (ym: string) => void;
  setActiveWeek: (wk: string) => void;
  setBudgetPeriod: (period: BudgetPeriod) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  addCategory: (cat: Omit<Category, "id">) => void;
  removeCategory: (id: string) => void;
  setTransactionCategory: (id: string, categoryId: string | null, applyToMerchant: boolean) => void;
  setMerchantCategory: (merchantKey: string, categoryId: string | null) => void;
  applyRecommendedPlans: (year: string) => number;
  patchTransaction: (id: string, patch: Partial<Pick<Transaction, "excluded" | "status" | "notes">>) => void;
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

function snapshotOf(s: LedgerSnapshot): LedgerSnapshot {
  return {
    profile: s.profile,
    categories: s.categories,
    transactions: s.transactions,
    merchantRules: s.merchantRules,
    imports: s.imports,
    activeMonth: s.activeMonth,
    activeWeek: s.activeWeek,
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistChain: Promise<void> = Promise.resolve();

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
  persistChain = persistChain.then(async () => {
    const s = useBudgetStore.getState();
    if (!s.hydrated || !s.profile.completedOnboarding) return;
    useBudgetStore.setState({ saveState: "saving", saveError: null });
    try {
      await saveLedger({ data: snapshotOf(s) });
      useBudgetStore.setState({ saveState: "saved" });
    } catch (err) {
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
    const suggestion = suggestCategory(row.description, row.amount, categories, rules, key);
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
      setHydrated: () => set({ hydrated: true }),
      hydrateLocal: () => {
        const persistApi = useBudgetStore.persist;
        const mark = () => get().setHydrated();
        persistApi?.onFinishHydration?.(mark);
        if (persistApi?.hasHydrated?.()) mark();
        window.setTimeout(mark, 200);
        const legacy = readLegacy();
        if (legacy && (legacy.profile.completedOnboarding || legacy.transactions.length) && !get().profile.completedOnboarding) {
          set({ ...legacy, hydrated: true });
          dropLegacy();
        }
      },
      loadRemote: async () => {
        const local = snapshotOf(get());
        try {
          const remote = await loadLedger();
          const editing =
            !get().profile.completedOnboarding && (get().transactions.length > 0 || get().categories.length > 0);
          if (remote?.profile.completedOnboarding && !editing) {
            set({ ...remote, hydrated: true, saveState: "saved", saveError: null });
            dropLegacy();
            return;
          }
          if (local.profile.completedOnboarding) {
            set({ hydrated: true, saveState: "saving" });
            await flushPersist();
            return;
          }
          const legacy = readLegacy();
          if (legacy?.profile.completedOnboarding) {
            set({ ...legacy, hydrated: true, saveState: "saving" });
            dropLegacy();
            await flushPersist();
            return;
          }
          set({ hydrated: true, saveState: "idle" });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not load";
          if (message === "Unauthorized") {
            set({ hydrated: true, saveState: "idle" });
            return;
          }
          set({ hydrated: true, saveState: "error", saveError: message });
        }
      },
      completeSetup: (profile, categories) => {
        const idMap = remapIds(get().categories, categories);
        set({
          profile: { ...profile, completedOnboarding: true },
          categories,
          transactions: get().transactions.map((t) => ({
            ...t,
            categoryId: t.categoryId ? (idMap.get(t.categoryId) ?? null) : null,
          })),
          merchantRules: get()
            .merchantRules.map((r) => ({ ...r, categoryId: idMap.get(r.categoryId) ?? "" }))
            .filter((r) => r.categoryId),
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
      resetAll: () => {
        set({ ...emptySnapshot(), saveState: "idle" });
        void flushPersist();
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
        set({
          categories: get().categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        });
        schedulePersist();
      },
      addCategory: (cat) => {
        set({
          categories: [...get().categories, { ...cat, id: newId("cat") }],
        });
        schedulePersist();
      },
      removeCategory: (id) => {
        set({
          categories: get().categories.filter((c) => c.id !== id),
          transactions: get().transactions.map((t) =>
            t.categoryId === id ? { ...t, categoryId: null, userSet: false } : t,
          ),
          merchantRules: get().merchantRules.filter((r) => r.categoryId !== id),
        });
        schedulePersist();
      },
      setTransactionCategory: (id, categoryId, applyToMerchant) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx) return;
        if (applyToMerchant) {
          get().setMerchantCategory(tx.merchantKey, categoryId);
          return;
        }
        set({
          transactions: get().transactions.map((t) => (t.id === id ? { ...t, categoryId, userSet: true } : t)),
        });
        schedulePersist();
      },
      setMerchantCategory: (key, categoryId) => {
        set({
          merchantRules: get().merchantRules.filter((r) => r.merchantKey !== key),
          transactions: get().transactions.map((t) =>
            t.merchantKey === key ? { ...t, categoryId, userSet: true } : t,
          ),
        });
        schedulePersist();
      },
      applyRecommendedPlans: (year) => {
        const recs = recommendedPlans(get().transactions, get().categories, year);
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
        const months = added.map((t) => monthKeyFromDate(t.date)).sort();
        const weeks = added.map((t) => weekKeyFromDate(t.date)).sort();
        set({
          transactions: next,
          imports: [batch, ...get().imports].slice(0, 40),
          activeMonth: months.length ? months[months.length - 1] : get().activeMonth,
          activeWeek: weeks.length ? weeks[weeks.length - 1] : get().activeWeek,
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
        const profile: Profile = { ...SAMPLE_PROFILE, completedOnboarding: true };
        const categories = buildPresetCategories(profile);
        const preview = parseCsvText(SAMPLE_CSV, "sample-chase.csv");
        const { added } = applyImportRows(preview.rows, "Demo bank file", [], categories, []);
        const months = added.map((t) => monthKeyFromDate(t.date)).sort();
        const weeks = added.map((t) => weekKeyFromDate(t.date)).sort();
        set({
          profile,
          categories,
          transactions: added.sort((a, b) => b.date.localeCompare(a.date)),
          merchantRules: [],
          imports: [
            {
              id: newId("imp"),
              fileName: "sample-chase.csv",
              importedAt: new Date().toISOString(),
              added: added.length,
              skippedDuplicates: 0,
              sourceLabel: "Demo bank file",
            },
          ],
          activeMonth: months.length ? months[months.length - 1] : currentMonthKey(),
          activeWeek: weeks.length ? weeks[weeks.length - 1] : currentWeekKey(),
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
        const months = parsed.data.transactions.map((t) => monthKeyFromDate(t.date)).filter(Boolean).sort();
        const weeks = parsed.data.transactions.map((t) => weekKeyFromDate(t.date)).filter(Boolean).sort();
        set({
          profile: parsed.data.profile,
          categories: parsed.data.categories,
          transactions: [...parsed.data.transactions].sort((a, b) => b.date.localeCompare(a.date)),
          merchantRules: parsed.data.merchantRules,
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
          activeMonth: months.length ? months[months.length - 1] : currentMonthKey(),
          activeWeek: weeks.length ? weeks[weeks.length - 1] : currentWeekKey(),
        });
        void flushPersist();
        return { ok: true, count: parsed.data.transactions.length };
      },
    }),
    {
      name: LOCAL_KEY,
      partialize: (s) => snapshotOf(s),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

export { flushPersist };

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void flushPersist();
  });
}
