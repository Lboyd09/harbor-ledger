import { latestBalance, totalBalance } from "./accounts.ts";
import { carryMonth, carrySummary, type CarryContext } from "./carry.ts";
import { expectedIncomeForMonth } from "./income.ts";
import { roundMoney } from "./money.ts";
import { monthCash, sumByCategory, yearCash } from "./totals.ts";
import { groupMonth } from "./month-view.ts";
import { countsTowardPlan } from "./plans.ts";
import { monthsOfYear } from "./year.ts";
import type { Account, AccountKind, BalancePoint, BudgetStyle, Category, MonthBudget, Profile, Transaction } from "./types.ts";

export type YearOverview = {
  year: string;
  moneyIn: number;
  moneyOut: number;
  left: number;
  savingsRate: number;
};

/** Full calendar year, same cash rules as yearCash. */
export function yearOverview(transactions: Transaction[], categories: Category[], year: string): YearOverview {
  const cash = yearCash(transactions, `${year}-01`, categories);
  const moneyIn = roundMoney(cash.income);
  const moneyOut = roundMoney(cash.expenses);
  const left = roundMoney(cash.net);
  return {
    year,
    moneyIn,
    moneyOut,
    left,
    savingsRate: moneyIn > 0 ? left / moneyIn : 0,
  };
}

/** January through `throughMonth` (1–12), still using monthCash so a partial year does not borrow later months. */
export function spanOverview(
  transactions: Transaction[],
  categories: Category[],
  year: string,
  throughMonth: number,
): YearOverview {
  const last = Math.min(12, Math.max(1, Math.floor(throughMonth)));
  let moneyIn = 0;
  let moneyOut = 0;
  for (let month = 1; month <= last; month++) {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const cash = monthCash(transactions, ym, categories);
    moneyIn += cash.income;
    moneyOut += cash.expenses;
  }
  moneyIn = roundMoney(moneyIn);
  moneyOut = roundMoney(moneyOut);
  const left = roundMoney(moneyIn - moneyOut);
  return { year, moneyIn, moneyOut, left, savingsRate: moneyIn > 0 ? left / moneyIn : 0 };
}

export type SpendingSlice = { id: string; label: string; value: number };

/** Expense categories only, for one calendar year. */
export function spendingSlices(transactions: Transaction[], categories: Category[], year: string): SpendingSlice[] {
  const totals = new Map<string, number>();
  const byId = new Map(categories.map((c) => [c.id, c]));
  for (const ym of monthsOfYear(year)) {
    const part = sumByCategory(transactions, ym, "expense", categories);
    for (const [id, value] of part) totals.set(id, (totals.get(id) ?? 0) + value);
  }
  return [...totals.entries()]
    .map(([id, value]) => ({ id, label: byId.get(id)?.name ?? "Category", value: roundMoney(value) }))
    .filter((slice) => slice.value > 0.004)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export type AccountRow = {
  id: string;
  name: string;
  kind: AccountKind;
  amount: number;
  owed: boolean;
  asOf: string | null;
  source: "from a file" | "typed in" | null;
  ageDays: number | null;
  stale: boolean;
};

export type AccountRows = { rows: AccountRow[]; net: number };

function ageInDays(today: string, date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

/** Latest balance per account. Nothing is left out of the net total. Credit stays negative (owed). */
export function accountRows(accounts: Account[], balances: BalancePoint[], today: string): AccountRows {
  const rows: AccountRow[] = accounts.map((account) => {
    const latest = latestBalance(account.id, balances);
    const ageDays = latest ? ageInDays(today, latest.date) : null;
    return {
      id: account.id,
      name: account.name,
      kind: account.kind,
      amount: latest?.amount ?? 0,
      owed: account.kind === "credit",
      asOf: latest?.date ?? null,
      source: latest ? (latest.source === "file" ? "from a file" : "typed in") : null,
      ageDays,
      stale: ageDays != null && ageDays > 35,
    };
  });
  return { rows, net: totalBalance(accounts, balances) };
}

export type MonthGlance = {
  style: BudgetStyle;
  safeToSpend: number;
  sentence: string;
  over: number;
  even: number;
  extra: number;
  onTrack: number;
};

export function monthGlance(input: {
  style: BudgetStyle;
  ym: string;
  transactions: Transaction[];
  categories: Category[];
  budgets?: MonthBudget[];
  carryStartMonth?: string | null;
  safeToSpend: number;
}): MonthGlance {
  const style = input.style === "buckets" ? "buckets" : "monthly";
  if (style === "buckets" && input.carryStartMonth) {
    const ctx: CarryContext = {
      transactions: input.transactions,
      categories: input.categories,
      budgets: input.budgets,
      carryStartMonth: input.carryStartMonth,
    };
    const summary = carrySummary(input.ym, ctx);
    let counted = 0;
    for (const category of input.categories) {
      if (category.kind !== "expense" || !countsTowardPlan(category, input.categories)) continue;
      if (carryMonth(category, input.ym, ctx)) counted += 1;
    }
    const over = summary.countOver;
    const extra = summary.countExtra;
    const even = Math.max(0, counted - over - extra);
    return {
      style,
      safeToSpend: input.safeToSpend,
      over,
      even,
      extra,
      onTrack: 0,
      sentence: `${over} over, ${even} even, ${extra} with extra.`,
    };
  }
  const layout = groupMonth(input.transactions, input.categories, input.ym, input.budgets ?? []);
  let over = 0;
  let onTrack = 0;
  for (const group of layout.expenses) {
    if (group.id === "money-back" || group.plan <= 0) continue;
    if (group.total > group.plan + 0.004) over += 1;
    else onTrack += 1;
  }
  return {
    style: "monthly",
    safeToSpend: input.safeToSpend,
    over,
    even: 0,
    extra: 0,
    onTrack,
    sentence: `${over} over and ${onTrack} on track.`,
  };
}

export type NeedsALook = {
  uncategorized: number;
  incomeLine: string | null;
};

/** Open charges in the year, plus at most one line when expected income has not arrived this month. */
export function needsALook(input: {
  transactions: Transaction[];
  categories: Category[];
  profile: Profile;
  ym: string;
  budgets?: MonthBudget[];
}): NeedsALook {
  const year = input.ym.slice(0, 4);
  const uncategorized = yearCash(input.transactions, `${year}-01`, input.categories).uncategorized;
  const expected = expectedIncomeForMonth(input.profile, input.ym, input.budgets ?? []);
  const seen = monthCash(input.transactions, input.ym, input.categories).income;
  const incomeLine = expected > 0 && seen <= 0 ? "Expected income has not shown up yet this month." : null;
  return { uncategorized, incomeLine };
}

export function staleLabel(ageDays: number): string {
  const months = Math.max(1, Math.round(ageDays / 30));
  return months === 1 ? "Last updated over a month ago" : `Last updated ${months} months ago`;
}
