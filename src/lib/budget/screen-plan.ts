import type { MonthEndForecast } from "./analytics.ts";
import type { RecurringBill } from "./analytics-depth.ts";
import { categorySpent, SURPLUS_PLAN_MONTHS } from "./carry.ts";
import { monthLedger, type LedgerSource, type SpendingLine } from "./ledger-month.ts";
import { formatMoney, roundMoney } from "./money.ts";
import { shiftMonth } from "./parse-date.ts";
import type { Category, RecurringInterval, Transaction } from "./types.ts";

export type ForecastChip = "Likely over by month end" | "Close" | "Fine";

/** Null when there is no plan to compare with. */
export function forecastChip(projected: number, planned: number | null): ForecastChip | null {
  if (planned == null || !(planned > 0)) return null;
  if (projected > planned * 1.05) return "Likely over by month end";
  if (projected >= planned * 0.9) return "Close";
  return "Fine";
}

export type BudgetLead = {
  sentence: string;
  cover: string | null;
  incomeMissing: boolean;
  /** True when the plan is far above a typical month. That is a warning, not "Fine". */
  warn: boolean;
};

/** The sentence above Budget. Thin income is named instead of invented. */
export function budgetLead(input: { plannedSpend: number; usualIncome: number; typicalSpend: number | null; typicalMonths: number }): BudgetLead {
  const incomeMissing = !(input.usualIncome > 0);
  const sentence = incomeMissing
    ? `${formatMoney(input.plannedSpend)} planned · add income`
    : `${formatMoney(input.plannedSpend)} planned of ${formatMoney(input.usualIncome)} income`;
  let cover: string | null = null;
  let warn = false;
  if (input.typicalSpend != null && input.typicalSpend > 0 && input.typicalMonths >= 3) {
    const pct = Math.round((input.plannedSpend / input.typicalSpend) * 100);
    warn = pct > 150;
    cover = warn ? `Plan is ${pct}% of a usual month` : null;
  }
  return { sentence, cover, incomeMissing, warn };
}

export type SpendRank = {
  id: string;
  name: string;
  over: boolean;
  risk: boolean;
  size: number;
};

/** Over or at risk first, then the largest. */
export function orderSpending<T extends SpendRank>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const rank = (row: SpendRank) => (row.over ? 0 : row.risk ? 1 : 2);
    return rank(a) - rank(b) || b.size - a.size || a.name.localeCompare(b.name);
  });
}

export function splitFixedFlexible<T extends { id: string }>(
  rows: T[],
  fixedIds: string[],
  flexibleIds: string[],
): { fixed: T[]; flexible: T[]; rest: T[] } {
  const fixed = new Set(fixedIds);
  const flexible = new Set(flexibleIds);
  return {
    fixed: rows.filter((row) => fixed.has(row.id)),
    flexible: rows.filter((row) => flexible.has(row.id)),
    rest: rows.filter((row) => !fixed.has(row.id) && !flexible.has(row.id)),
  };
}

export type AmountSuggestion = {
  id: string;
  name: string;
  suggested: number | null;
  sentence: string;
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Categories that show up in charges but have no amount. One month is not enough to invent a number. */
export function suggestAmounts(
  categories: Category[],
  transactions: Transaction[],
  ym: string,
): AmountSuggestion[] {
  const out: AmountSuggestion[] = [];
  for (const category of categories) {
    if (category.kind !== "expense" || category.parentId || category.plannedMonthly > 0) continue;
    const series: number[] = [];
    for (let i = 0; i < 12; i++) {
      const month = shiftMonth(ym, -i);
      const spent = categorySpent(transactions, categories, category.id, month);
      if (spent > 0.5) series.push(spent);
    }
    if (!series.length) continue;
    if (series.length < 2) continue;
    const suggested = roundMoney(median(series));
    out.push({
      id: category.id,
      name: category.name,
      suggested,
      sentence: `${category.name}: usually ${formatMoney(suggested)}/mo`,
    });
  }
  return out.sort((a, b) => (b.suggested ?? 0) - (a.suggested ?? 0) || a.name.localeCompare(b.name));
}

export type ComingItem = {
  merchantKey: string;
  description: string;
  usual: number;
  nextDate: string;
  status: RecurringBill["status"];
  yearly: number;
};

/** Bills expected in the next 30 days. Null when there are no repeating bills. */
export function comingUp(bills: RecurringBill[] | null, today: string, days = 30): ComingItem[] | null {
  if (!bills?.length || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const end = addDays(today, days);
  if (!end) return null;
  const items = bills
    .filter((bill) => bill.nextDate && bill.nextDate >= today && bill.nextDate <= end)
    .map((bill) => ({
      merchantKey: bill.merchantKey,
      description: bill.description,
      usual: bill.usual,
      nextDate: bill.nextDate as string,
      status: bill.status,
      yearly: bill.yearly,
    }));
  const late = bills
    .filter((bill) => bill.status !== "active" && !items.some((item) => item.merchantKey === bill.merchantKey))
    .map((bill) => ({
      merchantKey: bill.merchantKey,
      description: bill.description,
      usual: bill.usual,
      nextDate: bill.nextDate ?? bill.lastDate,
      status: bill.status,
      yearly: bill.yearly,
    }));
  const all = [...items, ...late].sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.description.localeCompare(b.description));
  return all.length ? all : null;
}

function monthEnd(today: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!match) return null;
  const last = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
  return `${match[1]}-${match[2]}-${String(last).padStart(2, "0")}`;
}

function timesAYear(interval: RecurringInterval): number {
  if (interval === "weekly") return 52;
  if (interval === "biweekly") return 26;
  if (interval === "monthly") return 12;
  return 4;
}

/** Bills from today through the end of this month. Stopped bills and ones already paid this month stay off the list. */
export function stillComingThisMonth(
  bills: RecurringBill[] | null,
  today: string,
  transactions: Transaction[] = [],
): ComingItem[] | null {
  const end = monthEnd(today);
  if (!bills?.length || !end) return null;
  const ym = today.slice(0, 7);
  const paid = new Set(
    transactions.filter((row) => row.date.startsWith(ym) && row.amount < 0 && !row.excluded).map((row) => row.merchantKey),
  );
  const items = bills
    .filter((bill) => bill.status !== "stopped" && bill.nextDate && bill.nextDate >= today && bill.nextDate <= end && !paid.has(bill.merchantKey))
    .map((bill) => ({
      merchantKey: bill.merchantKey,
      description: bill.description,
      usual: bill.usual,
      nextDate: bill.nextDate as string,
      status: bill.status,
      yearly: roundMoney(bill.usual * timesAYear(bill.interval)),
    }))
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.description.localeCompare(b.description));
  return items.length ? items : null;
}

/** "About $1,440 a year" from the bills still coming, using each cadence's yearly cap. */
export function yearlyComingLine(items: { usual: number; yearly: number }[]): string {
  const total = roundMoney(items.reduce((sum, item) => sum + item.yearly, 0));
  return `About ${formatMoney(total)} a year`;
}

function addDays(iso: string, days: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function carryConsequence(left: number, carries: boolean): string {
  if (!carries) return "Next month starts at $0.";
  if (left < -0.004) return `${formatMoney(left)} carries into next month. That is money to cut back.`;
  return `${formatMoney(Math.max(0, left))} carries into next month.`;
}

export function paceSentence(forecast: MonthEndForecast | null): string {
  if (!forecast) return "Not enough of this month yet to guess how it ends.";
  return forecast.sentence;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function addDaysIso(iso: string, days: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** "Due Friday" when the next paycheck lands in this month and has not arrived. */
export function dueLabel(
  hints: string[],
  cadence: "weekly" | "biweekly" | "twice-monthly" | "monthly" | "irregular",
  transactions: Transaction[],
  ym: string,
  received: number,
): string | null {
  if (received > 0.5 || !hints.length) return null;
  const gap = cadence === "weekly" ? 7 : cadence === "biweekly" ? 14 : cadence === "twice-monthly" ? 15 : cadence === "monthly" ? 30 : 0;
  if (!gap) return null;
  const hits = transactions
    .filter((row) => row.amount > 0 && !row.excluded && hints.some((hint) => row.description.toLowerCase().includes(hint.toLowerCase())))
    .map((row) => row.date)
    .sort();
  const last = hits.at(-1);
  if (!last) return null;
  const next = addDaysIso(last, gap);
  if (!next || !next.startsWith(ym)) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(next);
  if (!match) return null;
  const weekday = WEEKDAYS[new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()];
  return `Due ${weekday}`;
}

export type MonthStrip = {
  ready: boolean;
  reason: string | null;
  daysLeft: number | null;
  spent: number | null;
  expected: number | null;
  low: number | null;
  high: number | null;
  incomeStill: number | null;
  projectedLeft: number | null;
};

function daysInMonth(ym: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return 30;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
}

/** The month strip. Hidden, with a reason, until the forecast exists. */
export function monthStrip(input: {
  forecast: MonthEndForecast | null;
  incomeSoFar: number;
  incomeStill: number | null;
}): MonthStrip {
  const forecast = input.forecast;
  if (!forecast) {
    return {
      ready: false,
      reason: "Not enough of this month yet to guess how it ends.",
      daysLeft: null,
      spent: null,
      expected: null,
      low: null,
      high: null,
      incomeStill: null,
      projectedLeft: null,
    };
  }
  const day = Number(forecast.today.slice(8, 10));
  const daysLeft = Math.max(0, daysInMonth(forecast.ym) - day);
  const still = input.incomeStill;
  const projectedLeft =
    still == null && input.incomeSoFar <= 0 ? null : roundMoney(input.incomeSoFar + (still ?? 0) - forecast.projectedSpend);
  return {
    ready: true,
    reason: null,
    daysLeft,
    spent: forecast.spentSoFar,
    expected: forecast.projectedSpend,
    low: forecast.low,
    high: forecast.high,
    incomeStill: still,
    projectedLeft,
  };
}

export type CategoryStory = {
  headline: string;
  detail: string;
  nextMonth: string;
  tone: "over" | "under" | "even" | "fresh";
  icon: "over" | "under" | "even" | "fresh";
  /** This month only: "on plan", "$X over", or "$X left". Carry-in is not in this. */
  thisMonth: string;
  /** Carry-in from earlier months. Zero when the month started even. */
  fromEarlier: number;
};

function thisMonthStatus(planned: number, spent: number): { text: string; tone: "over" | "under" | "even" } {
  const delta = roundMoney(planned - spent);
  if (Math.abs(delta) < 0.005) return { text: "on plan", tone: "even" };
  if (delta < 0) return { text: `${formatMoney(Math.abs(delta))} over`, tone: "over" };
  return { text: `${formatMoney(delta)} left`, tone: "under" };
}

/** One sentence about this month, and one about next. Carry-in is labelled on its own. */
export function categoryStory(row: SpendingLine): CategoryStory {
  const month = thisMonthStatus(row.planned, row.spent);
  const fromEarlier = row.carryIn;
  if (!row.carries) {
    const again = `Starts again at ${formatMoney(row.planned)}.`;
    return { headline: "Fresh month.", detail: again, nextMonth: again, tone: "fresh", icon: "fresh", thisMonth: month.text, fromEarlier };
  }
  const headline = month.tone === "even" ? "Even." : month.tone === "over" ? `${formatMoney(Math.abs(row.planned - row.spent))} over.` : `${formatMoney(row.planned - row.spent)} left.`;
  let nextMonth = "Next month starts at the amount.";
  let detail = "Nothing extra to carry.";
  if (row.left < -0.004) {
    nextMonth = `Next month starts ${formatMoney(Math.abs(row.left))} lower.`;
    detail = nextMonth;
  } else if (row.left > 0.004) {
    nextMonth = `${formatMoney(row.left)} carries into next month.`;
    detail = nextMonth;
  }
  if (Math.abs(fromEarlier) > 0.004) detail = `From earlier: ${formatMoney(fromEarlier)}.`;
  return { headline, detail, nextMonth, tone: month.tone, icon: month.tone, thisMonth: month.text, fromEarlier };
}

export type SurplusSuggestion = {
  categoryId: string;
  name: string;
  amount: number;
  fundLabel: string;
  growLabel: string;
  /** Set when the spare figure includes money carried in. */
  fromEarlier: number | null;
};

const SURPLUS_SKIP = new Set(["housing", "utilities", "subscriptions", "debt", "savings", "insurance", "phone"]);

function skipSurplus(category: Category | undefined, line: SpendingLine): boolean {
  if (!line.carries) return true;
  if (!category) return /savings transfer|debt payment|student loan/i.test(line.name);
  if (category.carry === false) return true;
  if (SURPLUS_SKIP.has(category.slug)) return true;
  return /savings transfer|debt payment|student loan/i.test(category.name);
}

/** Leftovers worth moving, largest first. Nothing while the month is short, and nothing from savings, debt, or fixed bills. */
export function surplusSuggestions(source: LedgerSource, ym: string): SurplusSuggestion[] {
  if (!/^\d{4}-\d{2}$/.test(ym)) return [];
  const ledger = monthLedger(source, ym);
  if (ledger.totals.leftOver < -0.004) return [];
  const byId = new Map(source.categories.map((category) => [category.id, category]));
  const out: SurplusSuggestion[] = [];
  for (const line of ledger.spending) {
    if (skipSurplus(byId.get(line.id), line)) continue;
    const amount = roundMoney(Math.max(0, line.left));
    if (amount <= 0.5) continue;
    const shown = formatMoney(amount);
    const fromEarlier = Math.abs(line.carryIn) > 0.004 ? line.carryIn : null;
    out.push({
      categoryId: line.id,
      name: line.name,
      amount,
      fundLabel: `Add ${shown} to a fund`,
      growLabel: "Grow it",
      fromEarlier,
    });
  }
  return out.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

export { SURPLUS_PLAN_MONTHS };
