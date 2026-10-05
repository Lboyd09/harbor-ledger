import { latestBalance, totalBalance } from "./accounts.ts";
import { monthLedger, yearLedger } from "./ledger-month.ts";
import { expectedIncomeForMonth } from "./income.ts";
import { roundMoney } from "./money.ts";
import { sumByCategory } from "./totals.ts";
import { monthsOfYear } from "./year.ts";
import type { Account, AccountKind, BalancePoint, BudgetStyle, Category, MonthBudget, Profile, Transaction } from "./types.ts";

export type YearOverview = {
  year: string;
  moneyIn: number;
  moneyOut: number;
  saved: number;
  left: number;
  savingsRate: number;
};

/** Full calendar year from the twelve month ledgers. */
export function yearOverview(
  transactions: Transaction[],
  categories: Category[],
  year: string,
  extra?: { buckets?: import("./types.ts").MoneyBucket[]; moves?: import("./types.ts").BucketMove[]; style?: BudgetStyle; carryStartMonth?: string | null },
): YearOverview {
  const book = yearLedger(
    { transactions, categories, buckets: extra?.buckets, moves: extra?.moves, style: extra?.style, carryStartMonth: extra?.carryStartMonth },
    year,
  );
  const moneyIn = book.totals.received;
  const moneyOut = book.totals.spent;
  const saved = book.totals.savedToFunds;
  const left = book.totals.leftOver;
  return { year, moneyIn, moneyOut, saved, left, savingsRate: moneyIn > 0 ? left / moneyIn : 0 };
}

/** January through `throughMonth` (1–12). */
export function spanOverview(
  transactions: Transaction[],
  categories: Category[],
  year: string,
  throughMonth: number,
  extra?: { buckets?: import("./types.ts").MoneyBucket[]; moves?: import("./types.ts").BucketMove[]; style?: BudgetStyle; carryStartMonth?: string | null },
): YearOverview {
  const book = yearLedger(
    { transactions, categories, buckets: extra?.buckets, moves: extra?.moves, style: extra?.style, carryStartMonth: extra?.carryStartMonth },
    year,
  );
  const last = Math.min(12, Math.max(1, Math.floor(throughMonth)));
  const slice = book.months.slice(0, last);
  const moneyIn = roundMoney(slice.reduce((sum, row) => sum + row.totals.received, 0));
  const moneyOut = roundMoney(slice.reduce((sum, row) => sum + row.totals.spent, 0));
  const saved = roundMoney(slice.reduce((sum, row) => sum + row.totals.savedToFunds, 0));
  const left = roundMoney(slice.reduce((sum, row) => sum + row.totals.leftOver, 0));
  return { year, moneyIn, moneyOut, saved, left, savingsRate: moneyIn > 0 ? left / moneyIn : 0 };
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
  const ledger = monthLedger(
    {
      transactions: input.transactions,
      categories: input.categories,
      budgets: input.budgets,
      style,
      carryStartMonth: input.carryStartMonth,
    },
    input.ym,
  );
  if (style === "buckets" && input.carryStartMonth) {
    let over = 0;
    let even = 0;
    let extra = 0;
    for (const line of ledger.spending) {
      if (!line.carries) continue;
      if (!input.carryStartMonth || input.ym < input.carryStartMonth) continue;
      if (line.left < -0.5) over += 1;
      else if (line.left > 0.5) extra += 1;
      else even += 1;
    }
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
  let over = 0;
  let onTrack = 0;
  for (const line of ledger.spending) {
    if (line.planned <= 0) continue;
    if (line.spent > line.planned + 0.004) over += 1;
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
  const uncategorized = yearLedger({ transactions: input.transactions, categories: input.categories }, year).months.reduce(
    (sum, row) => sum + row.flags.uncategorized,
    0,
  );
  const expected = expectedIncomeForMonth(input.profile, input.ym, input.budgets ?? []);
  const seen = monthLedger({ transactions: input.transactions, categories: input.categories }, input.ym).totals.received;
  const incomeLine = expected > 0 && seen <= 0 ? "Expected income has not shown up yet this month." : null;
  return { uncategorized, incomeLine };
}

export function staleLabel(ageDays: number): string {
  const months = Math.max(1, Math.round(ageDays / 30));
  return months === 1 ? "Last updated over a month ago" : `Last updated ${months} months ago`;
}
