import { fundingForMonth } from "./buckets.ts";
import { expectedMonthlyOf } from "./income.ts";
import { groupMonth, type MonthLayout } from "./month-view.ts";
import { roundMoney } from "./money.ts";
import { monthKeyFromDate, shiftMonth } from "./parse-date.ts";
import { countsTowardPlan, orderedCategories, planAmount } from "./plans.ts";
import { categoryCarries } from "./style.ts";
import type { BudgetStyle, Category, MoneyBucket, MonthBudget, Profile, SetAside, Transaction, BucketMove } from "./types.ts";

export type IncomeLine = {
  id: string;
  name: string;
  received: number;
  expected: number;
  variance: number;
};

export type SpendingLine = {
  id: string;
  name: string;
  planned: number;
  spent: number;
  carryIn: number;
  carryOut: number;
  left: number;
  carries: boolean;
  charges: number;
  provisional: number;
};

export type MonthTotals = {
  received: number;
  spent: number;
  savedToFunds: number;
  leftOver: number;
  plannedTotal: number;
  unassigned: number;
};

export type MonthFlags = {
  /** Charges in the month with no category. */
  uncategorized: number;
  /** Deposits filed as transfers, so they are not in income. */
  hiddenDeposits: number;
  provisional: number;
};

export type FundMonth = {
  id: string;
  name: string;
  funding: number;
  setAsides: number;
  spent: number;
};

export type MonthLedger = {
  ym: string;
  income: IncomeLine[];
  spending: SpendingLine[];
  /** Money assigned to funds this month. Moves between funds are not in this, because they do not change what is left. */
  savedToFunds: number;
  fundFunding: number;
  /** Moves from one fund to another. They cancel out of savedToFunds. */
  fundMoves: number;
  /** Set-asides with no fund. They lower a carry-out and are not new savings. */
  released: number;
  funds: FundMonth[];
  totals: MonthTotals;
  flags: MonthFlags;
};

export type LedgerSource = {
  transactions: Transaction[];
  categories: Category[];
  budgets?: MonthBudget[];
  buckets?: MoneyBucket[];
  moves?: BucketMove[];
  style?: BudgetStyle;
  carryStartMonth?: string | null;
  /** Same opening applied while walking a carrying category. Rarely set. */
  opening?: number;
  profile?: Pick<Profile, "incomeStreams" | "monthlyIncome"> | null;
  /** Optional. Missing on older ledgers. Lowers carry-out. A fund id also counts as saved. */
  setAsides?: SetAside[];
};

export function earliestDataMonth(transactions: Transaction[]): string | null {
  let first: string | null = null;
  for (const row of transactions) {
    const ym = monthKeyFromDate(row.date);
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    if (!first || ym < first) first = ym;
  }
  return first;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function layoutOf(
  source: LedgerSource,
  ym: string,
  cache?: Map<string, MonthLayout>,
): MonthLayout {
  const hit = cache?.get(ym);
  if (hit) return hit;
  const layout = groupMonth(source.transactions, source.categories, ym, source.budgets ?? []);
  cache?.set(ym, layout);
  return layout;
}

function spentOf(layout: MonthLayout, categoryId: string): { spent: number; charges: number; provisional: number } {
  const group = layout.expenses.find((row) => row.id === categoryId);
  if (!group) return { spent: 0, charges: 0, provisional: 0 };
  const provisional = group.transactions.filter((row) => row.auto?.provisional).length;
  return { spent: roundMoney(group.total), charges: group.transactions.length, provisional };
}

function usualIncome(source: LedgerSource, category: Category, ym: string, cache: Map<string, MonthLayout>): number {
  const fromSetup = expectedFromStreams(source, category.id, ym);
  if (fromSetup != null) return fromSetup;
  const past: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const layout = layoutOf(source, shiftMonth(ym, -i), cache);
    const amount = layout.income.find((row) => row.id === category.id)?.total ?? 0;
    if (amount > 0.004) past.push(amount);
  }
  if (past.length) return roundMoney(median(past));
  return planAmount(category, ym, source.budgets ?? []);
}

/** Setup income wins over old deposits. A month amount replaces that category for that month only. */
function expectedFromStreams(source: LedgerSource, categoryId: string, ym: string): number | null {
  const streams = (source.profile?.incomeStreams ?? []).filter((stream) => stream.categoryId === categoryId && expectedMonthlyOf(stream) > 0);
  if (!streams.length) return null;
  const hit = (source.budgets ?? []).find((row) => row.categoryId === categoryId && row.ym === ym);
  if (hit && Number.isFinite(hit.amount)) return Math.max(0, hit.amount);
  return roundMoney(streams.reduce((sum, stream) => sum + expectedMonthlyOf(stream), 0));
}

function carryStartFor(category: Category, ledgerStart: string | null): string | null {
  if (category.carryFrom && /^\d{4}-\d{2}$/.test(category.carryFrom)) return category.carryFrom;
  return ledgerStart && /^\d{4}-\d{2}$/.test(ledgerStart) ? ledgerStart : null;
}

function asideFor(source: LedgerSource, categoryId: string, ym: string): number {
  let total = 0;
  for (const row of source.setAsides ?? []) {
    if (row.ym !== ym || row.categoryId !== categoryId || !(row.amount > 0)) continue;
    total += row.amount;
  }
  return roundMoney(total);
}

function walked(
  source: LedgerSource,
  category: Category,
  ym: string,
  cache: Map<string, MonthLayout>,
): { carryIn: number; carryOut: number; planned: number; spent: number } | null {
  const start = carryStartFor(category, source.carryStartMonth ?? null);
  if (!start || ym < start) return null;
  let cursor = start;
  let carryIn = roundMoney(source.opening ?? 0);
  let guard = 0;
  while (cursor <= ym && guard < 360) {
    const layout = layoutOf(source, cursor, cache);
    const planned = planAmount(category, cursor, source.budgets ?? []);
    const spent = spentOf(layout, category.id).spent;
    const aside = asideFor(source, category.id, cursor);
    const carryOut = roundMoney(carryIn + planned - spent - aside);
    if (cursor === ym) return { carryIn, carryOut, planned, spent };
    carryIn = carryOut;
    cursor = shiftMonth(cursor, 1);
    guard += 1;
  }
  return null;
}

function addTotals(rows: MonthTotals[]): MonthTotals {
  const totals = rows.reduce(
    (sum, row) => ({
      received: sum.received + row.received,
      spent: sum.spent + row.spent,
      savedToFunds: sum.savedToFunds + row.savedToFunds,
      leftOver: sum.leftOver + row.leftOver,
      plannedTotal: sum.plannedTotal + row.plannedTotal,
      unassigned: sum.unassigned + row.unassigned,
    }),
    { received: 0, spent: 0, savedToFunds: 0, leftOver: 0, plannedTotal: 0, unassigned: 0 },
  );
  return {
    received: roundMoney(totals.received),
    spent: roundMoney(totals.spent),
    savedToFunds: roundMoney(totals.savedToFunds),
    leftOver: roundMoney(totals.leftOver),
    plannedTotal: roundMoney(totals.plannedTotal),
    unassigned: roundMoney(totals.unassigned),
  };
}

/** One month. Income, spending, funds, and what is left all come from here. */
export function monthLedger(source: LedgerSource, ym: string, cache?: Map<string, MonthLayout>): MonthLedger {
  const style: BudgetStyle = source.style === "buckets" ? "buckets" : "monthly";
  const box = cache ?? new Map<string, MonthLayout>();
  const layout = layoutOf(source, ym, box);
  const income = orderedCategories(source.categories, "income").map((category) => {
    const received = roundMoney(layout.income.find((row) => row.id === category.id)?.total ?? 0);
    const expected = usualIncome(source, category, ym, box);
    return { id: category.id, name: category.name, received, expected, variance: roundMoney(received - expected) };
  });
  const spending = orderedCategories(source.categories, "expense")
    .filter((category) => countsTowardPlan(category, source.categories))
    .map((category) => {
      const planned = planAmount(category, ym, source.budgets ?? []);
      const current = spentOf(layout, category.id);
      const carries = categoryCarries(category, style);
      const walkedRow = carries ? walked(source, category, ym, box) : null;
      const carryIn = walkedRow?.carryIn ?? 0;
      const carryOut = walkedRow?.carryOut ?? 0;
      const left = carries ? carryOut : roundMoney(planned - current.spent);
      return {
        id: category.id,
        name: category.name,
        planned,
        spent: current.spent,
        carryIn,
        carryOut,
        left,
        carries,
        charges: current.charges,
        provisional: current.provisional,
      };
    });

  const fundFunding = roundMoney(
    (source.buckets ?? []).filter((bucket) => bucket.startMonth <= ym).reduce((sum, bucket) => sum + fundingForMonth(bucket, ym), 0),
  );
  const fromCash = roundMoney(
    (source.moves ?? []).filter((move) => move.ym === ym && move.fromId == null).reduce((sum, move) => sum + Math.abs(move.amount), 0),
  );
  const fundMoves = roundMoney(
    (source.moves ?? []).filter((move) => move.ym === ym && move.fromId != null).reduce((sum, move) => sum + move.amount, 0),
  );
  const asideRows = (source.setAsides ?? []).filter((row) => row.ym === ym && row.amount > 0);
  const asideToFunds = roundMoney(asideRows.filter((row) => row.fundId).reduce((sum, row) => sum + row.amount, 0));
  const released = roundMoney(asideRows.filter((row) => !row.fundId).reduce((sum, row) => sum + row.amount, 0));
  const savedToFunds = roundMoney(fundFunding + fromCash + asideToFunds);
  const received = roundMoney(layout.incomeTotal);
  const spent = roundMoney(layout.expenseTotal);
  const leftOver = roundMoney(received - spent - savedToFunds);
  const plannedTotal = roundMoney(spending.reduce((sum, line) => sum + line.planned, 0));
  const expectedIncome = roundMoney(income.reduce((sum, line) => sum + line.expected, 0));
  const linkedIds = new Set<string>();
  for (const bucket of source.buckets ?? []) {
    if (bucket.startMonth > ym) continue;
    for (const id of bucket.categoryIds) linkedIds.add(id);
  }
  const linkedPlanned = roundMoney(spending.filter((line) => linkedIds.has(line.id)).reduce((sum, line) => sum + line.planned, 0));
  const unassigned = roundMoney(expectedIncome - plannedTotal - savedToFunds + linkedPlanned);
  const provisional = source.transactions.filter(
    (row) => monthKeyFromDate(row.date) === ym && row.auto?.provisional && !row.excluded && row.status !== "transfer" && row.status !== "reimbursement",
  ).length;

  const known = new Map((source.buckets ?? []).map((bucket) => [bucket.id, bucket.name]));
  const fundIds = new Set<string>();
  for (const bucket of source.buckets ?? []) {
    if (bucket.startMonth <= ym) fundIds.add(bucket.id);
  }
  for (const row of asideRows) {
    if (row.fundId) fundIds.add(row.fundId);
  }
  const funds: FundMonth[] = [...fundIds].map((id) => {
    const bucket = (source.buckets ?? []).find((item) => item.id === id);
    const funding = bucket && bucket.startMonth <= ym ? fundingForMonth(bucket, ym) : 0;
    const setAsides = roundMoney(asideRows.filter((row) => row.fundId === id).reduce((sum, row) => sum + row.amount, 0));
    const spent = roundMoney(
      spending.filter((line) => bucket?.categoryIds.includes(line.id)).reduce((sum, line) => sum + line.spent, 0),
    );
    return { id, name: known.get(id) ?? "Fund", funding: roundMoney(funding), setAsides, spent };
  });

  return {
    ym,
    income,
    spending,
    savedToFunds,
    fundFunding,
    fundMoves,
    released,
    funds,
    totals: { received, spent, savedToFunds, leftOver, plannedTotal, unassigned },
    flags: {
      uncategorized: layout.openCount,
      hiddenDeposits: layout.aside.filter((row) => row.amount > 0).length,
      provisional,
    },
  };
}

export type YearLedger = {
  year: string;
  months: MonthLedger[];
  totals: MonthTotals;
  rolling12: MonthTotals;
  sinceStart: MonthTotals;
  funds: FundMonth[];
};

/** Twelve months of one year, plus a rolling year ending in December and everything since the first charge. */
export function yearLedger(source: LedgerSource, year: string): YearLedger {
  const cache = new Map<string, MonthLayout>();
  const months = Array.from({ length: 12 }, (_, index) => {
    const ym = `${year}-${String(index + 1).padStart(2, "0")}`;
    return monthLedger(source, ym, cache);
  });
  const rollingStart = shiftMonth(`${year}-12`, -11);
  const rolling: MonthLedger[] = [];
  let cursor = rollingStart;
  for (let i = 0; i < 12; i++) {
    rolling.push(cursor.startsWith(year) ? months[Number(cursor.slice(5, 7)) - 1] : monthLedger(source, cursor, cache));
    cursor = shiftMonth(cursor, 1);
  }
  const first = earliestDataMonth(source.transactions);
  const since: MonthLedger[] = [];
  if (first) {
    let ym = first;
    let guard = 0;
    const end = `${year}-12`;
    while (ym <= end && guard < 360) {
      since.push(ym.startsWith(year) ? months[Number(ym.slice(5, 7)) - 1] : monthLedger(source, ym, cache));
      ym = shiftMonth(ym, 1);
      guard += 1;
    }
  }
  return {
    year,
    months,
    totals: addTotals(months.map((row) => row.totals)),
    rolling12: addTotals(rolling.map((row) => row.totals)),
    sinceStart: addTotals(since.map((row) => row.totals)),
    funds: sumFunds(months),
  };
}

function sumFunds(months: MonthLedger[]): FundMonth[] {
  const map = new Map<string, FundMonth>();
  for (const month of months) {
    for (const line of month.funds) {
      const current = map.get(line.id) ?? { id: line.id, name: line.name, funding: 0, setAsides: 0, spent: 0 };
      current.funding += line.funding;
      current.setAsides += line.setAsides;
      current.spent += line.spent;
      current.name = line.name;
      map.set(line.id, current);
    }
  }
  return [...map.values()].map((line) => ({
    id: line.id,
    name: line.name,
    funding: roundMoney(line.funding),
    setAsides: roundMoney(line.setAsides),
    spent: roundMoney(line.spent),
  }));
}

/** What is left to assign after plans and fund funding. Built only from monthLedger. */
export function safeFromLedger(source: LedgerSource, ym: string): {
  amount: number;
  funding: number;
  moved: number;
  spent: number;
  plans: number;
  income: number;
} {
  const linked = new Set((source.buckets ?? []).flatMap((bucket) => bucket.categoryIds));
  const ledger = monthLedger(source, ym);
  let plans = 0;
  let spent = 0;
  for (const line of ledger.spending) {
    if (linked.has(line.id)) continue;
    if (line.planned <= 0) {
      spent += line.spent;
      continue;
    }
    plans += line.planned;
    if (line.spent > line.planned) spent += line.spent - line.planned;
  }
  const moved = roundMoney(
    (source.moves ?? []).filter((move) => move.ym === ym && move.fromId == null).reduce((sum, move) => sum + Math.abs(move.amount), 0),
  );
  plans = roundMoney(plans);
  spent = roundMoney(Math.max(0, spent));
  return {
    income: ledger.totals.received,
    funding: ledger.fundFunding,
    moved,
    plans,
    spent,
    amount: roundMoney(ledger.totals.received - plans - spent - ledger.totals.savedToFunds),
  };
}
