import type { MonthEndForecast } from "./analytics.ts";
import type { RecurringBill } from "./analytics-depth.ts";
import { categorySpent } from "./carry.ts";
import { formatMoney, roundMoney } from "./money.ts";
import { shiftMonth } from "./parse-date.ts";
import type { Category, Transaction } from "./types.ts";

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
};

/** The sentence above Budget. Thin income is named instead of invented. */
export function budgetLead(input: { plannedSpend: number; usualIncome: number; typicalSpend: number | null; typicalMonths: number }): BudgetLead {
  const incomeMissing = !(input.usualIncome > 0);
  const sentence = incomeMissing
    ? `Planned spending is ${formatMoney(input.plannedSpend)}. Income is not entered yet.`
    : `Planned ${formatMoney(input.plannedSpend)} of about ${formatMoney(input.usualIncome)} usual income.`;
  const cover =
    input.typicalSpend != null && input.typicalSpend > 0 && input.typicalMonths >= 3
      ? (() => {
          const pct = Math.round((input.plannedSpend / input.typicalSpend) * 100);
          if (pct > 400) {
            return `A typical month in this file is ${formatMoney(input.typicalSpend)}. The plan is about ${pct} percent of that.`;
          }
          return `Plan covers ${pct} percent of a typical month's spending.`;
        })()
      : null;
  return { sentence, cover, incomeMissing };
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
    if (series.length < 2) {
      out.push({
        id: category.id,
        name: category.name,
        suggested: null,
        sentence: `${category.name} shows up, but one month is not enough to suggest an amount.`,
      });
      continue;
    }
    const suggested = roundMoney(median(series));
    out.push({
      id: category.id,
      name: category.name,
      suggested,
      sentence: `${category.name} averages ${formatMoney(suggested)} a month. Add it?`,
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
