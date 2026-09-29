import { currentMonthKey, currentWeekKey, weekKeyFromDate } from "./parse-date.ts";
import { DEFAULT_PROFILE } from "./presets.ts";
import type {
  BudgetGoal,
  BudgetPeriod,
  Category,
  HarborLook,
  HarborMotion,
  ImportBatch,
  LedgerSnapshot,
  MerchantRule,
  MonthBudget,
  Profile,
  Transaction,
  TxStatus,
} from "./types.ts";

const STATUSES: TxStatus[] = ["posted", "refund", "transfer", "reimbursement"];
const PERIODS: BudgetPeriod[] = ["week", "month"];
const HOUSEHOLDS = ["single", "partnered", "married"] as const;
const STAGES = ["student", "early-career", "established", "parent", "retired"] as const;
const HOUSING = ["family", "rent", "own"] as const;
const GOALS: BudgetGoal[] = ["track", "save", "debt", "purchase", "live-within"];
const LOOKS: HarborLook[] = ["harbor", "dusk", "tide", "brass"];
const MOTIONS: HarborMotion[] = ["calm", "lively"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function normalizeProfile(raw: unknown): Profile {
  const p = isRecord(raw) ? raw : {};
  const streamsRaw = Array.isArray(p.incomeStreams) ? p.incomeStreams : [];
  const streams = streamsRaw.filter(isRecord).map((s) => ({
    name: asString(s.name, "Income"),
    monthly: Math.max(0, asNumber(s.monthly, 0)),
  }));
  const monthly = Math.max(
    0,
    asNumber(
      p.monthlyIncome,
      streams.reduce((s, x) => s + x.monthly, 0),
    ),
  );
  const budgetPeriod: BudgetPeriod = PERIODS.includes(p.budgetPeriod as BudgetPeriod)
    ? (p.budgetPeriod as BudgetPeriod)
    : "month";
  return {
    ledgerName: asString(p.ledgerName, DEFAULT_PROFILE.ledgerName),
    household: HOUSEHOLDS.includes(p.household as Profile["household"])
      ? (p.household as Profile["household"])
      : "single",
    dependents: Math.max(0, asNumber(p.dependents, 0)),
    lifeStage: STAGES.includes(p.lifeStage as Profile["lifeStage"])
      ? (p.lifeStage as Profile["lifeStage"])
      : "early-career",
    housing: HOUSING.includes(p.housing as Profile["housing"]) ? (p.housing as Profile["housing"]) : "rent",
    hasVehicle: asBool(p.hasVehicle, true),
    usesTransit: asBool(p.usesTransit, false),
    hasPets: asBool(p.hasPets, false),
    monthlyIncome: monthly,
    incomeStreams: streams.length ? streams : [{ name: "Paycheck", monthly }],
    buckets: Array.isArray(p.buckets) ? p.buckets.filter((b): b is string => typeof b === "string") : [],
    goals: Array.isArray(p.goals)
      ? (p.goals.filter((g) => GOALS.includes(g as BudgetGoal)) as BudgetGoal[])
      : ["track"],
    completedOnboarding: asBool(p.completedOnboarding, false),
    budgetPeriod,
    accent: LOOKS.includes(p.accent as HarborLook) ? (p.accent as HarborLook) : "harbor",
    motion: MOTIONS.includes(p.motion as HarborMotion) ? (p.motion as HarborMotion) : "lively",
  };
}

export function normalizeTransaction(raw: unknown, index = 0): Transaction | null {
  if (!isRecord(raw)) return null;
  const date = asString(raw.date);
  if (!date) return null;
  const status = STATUSES.includes(raw.status as TxStatus) ? (raw.status as TxStatus) : "posted";
  return {
    id: asString(raw.id, `tx_restored_${index}`),
    date,
    description: asString(raw.description),
    merchantKey: asString(raw.merchantKey, "UNKNOWN"),
    amount: asNumber(raw.amount, 0),
    sourceLabel: asString(raw.sourceLabel, "Imported"),
    fingerprint: asString(raw.fingerprint, `${index}`),
    categoryId: typeof raw.categoryId === "string" ? raw.categoryId : null,
    userSet: asBool(raw.userSet, false),
    notes: asString(raw.notes),
    excluded: asBool(raw.excluded, false),
    status,
  };
}

export function normalizeSnapshot(raw: unknown): LedgerSnapshot | null {
  if (!isRecord(raw)) return null;
  const inner = isRecord(raw.state) ? raw.state : raw;
  const categoriesRaw = inner.categories;
  const transactionsRaw = inner.transactions;
  if (!Array.isArray(categoriesRaw) || !Array.isArray(transactionsRaw)) return null;
  const categories: Category[] = categoriesRaw.filter(isRecord).map((c, i) => ({
    id: asString(c.id, `cat_restored_${i}`),
    slug: asString(c.slug, `custom-${i}`),
    name: asString(c.name, "Untitled"),
    kind: c.kind === "income" ? "income" : "expense",
    plannedMonthly: Math.max(0, asNumber(c.plannedMonthly, 0)),
    parentId: typeof c.parentId === "string" && c.parentId ? c.parentId : null,
  }));
  const transactions = transactionsRaw
    .map((t, i) => normalizeTransaction(t, i))
    .filter((t): t is Transaction => t !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const rulesRaw = inner.merchantRules;
  const merchantRules: MerchantRule[] = Array.isArray(rulesRaw)
    ? rulesRaw.filter(isRecord).map((r) => ({
        merchantKey: asString(r.merchantKey),
        categoryId: asString(r.categoryId),
      }))
    : [];
  const importsRaw = inner.imports;
  const imports: ImportBatch[] = Array.isArray(importsRaw)
    ? importsRaw.filter(isRecord).map((b, i) => ({
        id: asString(b.id, `imp_${i}`),
        fileName: asString(b.fileName, "import.csv"),
        importedAt: asString(b.importedAt, new Date().toISOString()),
        added: asNumber(b.added, 0),
        skippedDuplicates: asNumber(b.skippedDuplicates, 0),
        sourceLabel: asString(b.sourceLabel, ""),
      }))
    : [];
  const profile = normalizeProfile(inner.profile);
  const budgetsRaw = inner.monthBudgets;
  const monthBudgets: MonthBudget[] = Array.isArray(budgetsRaw)
    ? budgetsRaw.filter(isRecord).flatMap((b) => {
        const categoryId = asString(b.categoryId);
        const ym = asString(b.ym);
        if (!categoryId || !/^\d{4}-\d{2}$/.test(ym)) return [];
        return [{ categoryId, ym, amount: Math.max(0, asNumber(b.amount, 0)) }];
      })
    : [];
  const activeMonth = asString(inner.activeMonth, currentMonthKey());
  const last = transactions[0]?.date;
  const activeWeek = asString(inner.activeWeek, last ? weekKeyFromDate(last) : currentWeekKey());
  return { profile, categories, transactions, merchantRules, imports, monthBudgets, activeMonth, activeWeek };
}

export function emptySnapshot(): LedgerSnapshot {
  return {
    profile: DEFAULT_PROFILE,
    categories: [],
    transactions: [],
    merchantRules: [],
    imports: [],
    monthBudgets: [],
    activeMonth: currentMonthKey(),
    activeWeek: currentWeekKey(),
  };
}
