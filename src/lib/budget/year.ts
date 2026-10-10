import { formatMoney, roundMoney, roundPlan } from "./money.ts";
import { countsTowardPlan, planTotal } from "./plans.ts";
import { monthKeyFromDate, monthShort } from "./parse-date.ts";
import { countsInCashflow, monthCash, sumByCategory } from "./totals.ts";
import type { Category, Transaction } from "./types.ts";

export type MonthStatus = "on-track" | "over" | "empty" | "no-plan" | "behind";

export type YearMonthCell = {
  ym: string;
  income: number;
  expenses: number;
  net: number;
  uncategorized: number;
  count: number;
  status: MonthStatus;
  planExpenses: number;
  planIncome: number;
};

export type SheetRow = {
  id: string;
  name: string;
  kind: "income" | "expense" | "uncategorized";
  months: number[];
  yearTotal: number;
  typical: number;
  plan: number;
  effectivePlan: number;
  usingSuggested: boolean;
  status: MonthStatus;
};

export type YearInsight = {
  id: string;
  title: string;
  body: string;
  tone: "good" | "warn" | "neutral";
};

export type YearWorkbook = {
  year: string;
  months: string[];
  incomeRows: SheetRow[];
  expenseRows: SheetRow[];
  uncategorizedRow: SheetRow | null;
  monthSummaries: YearMonthCell[];
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  uncategorized: number;
  count: number;
  savingsMoved: number;
  planIncome: number;
  planExpenses: number;
  planLeftover: number;
  suggestedIncome: number;
  suggestedExpenses: number;
  usingSuggestedPlan: boolean;
  monthsOnTrack: number;
  monthsOver: number;
  activeMonths: number;
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
};

export function yearsInData(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) {
    if (t.date.length >= 4) set.add(t.date.slice(0, 4));
  }
  return [...set].sort();
}

export function monthsOfYear(year: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function recommendMonthly(monthlyActuals: number[]): number {
  const active = monthlyActuals.filter((n) => Math.abs(n) >= 0.5);
  return roundPlan(median(active));
}

export function effectivePlanOf(plan: number, typical: number): number {
  return plan > 0 ? plan : typical;
}

function monthStatus(actualExpenses: number, planExpenses: number, count: number): MonthStatus {
  if (count === 0) return "empty";
  if (planExpenses <= 0) return "no-plan";
  if (actualExpenses > planExpenses + 0.5) return "over";
  return "on-track";
}

function rowStatus(
  kind: SheetRow["kind"],
  yearTotal: number,
  planMonthly: number,
  monthsWithActivity: number,
): MonthStatus {
  if (monthsWithActivity === 0 && yearTotal === 0) return "empty";
  if (planMonthly <= 0) return "no-plan";
  const expected = planMonthly * Math.max(1, monthsWithActivity);
  if (kind === "income") {
    if (yearTotal + 0.5 < expected) return "behind";
    return "on-track";
  }
  if (yearTotal > expected + 0.5) return "over";
  return "on-track";
}

function inYear(t: Transaction, year: string) {
  return t.date.startsWith(year);
}

export function categoryMonthSeries(
  transactions: Transaction[],
  category: Category,
  months: string[],
): number[] {
  return months.map((ym) => {
    const map = sumByCategory(transactions, ym, category.kind, [category], "month");
    return roundMoney(map.get(category.id) ?? 0);
  });
}

export function uncategorizedMonthSeries(
  transactions: Transaction[],
  months: string[],
  categories: Category[],
): number[] {
  const known = new Set(categories.map((c) => c.id));
  return months.map((ym) => {
    let n = 0;
    for (const t of transactions) {
      if (monthKeyFromDate(t.date) !== ym) continue;
      if (!countsInCashflow(t)) continue;
      if (t.categoryId && known.has(t.categoryId)) continue;
      n += t.amount < 0 ? -t.amount : t.amount;
    }
    return roundMoney(n);
  });
}

function toSheetRow(cat: Category, yearTx: Transaction[], months: string[]): SheetRow {
  const values = categoryMonthSeries(yearTx, cat, months);
  const yearTotal = roundMoney(values.reduce((s, n) => s + n, 0));
  const typical = recommendMonthly(values);
  const plan = cat.plannedMonthly;
  const effectivePlan = effectivePlanOf(plan, typical);
  const activeMonths = values.filter((n) => Math.abs(n) >= 0.5).length;
  return {
    id: cat.id,
    name: cat.name,
    kind: cat.kind,
    months: values,
    yearTotal,
    typical,
    plan,
    effectivePlan,
    usingSuggested: plan <= 0 && typical > 0,
    status: rowStatus(cat.kind, yearTotal, effectivePlan, activeMonths),
  };
}

export function buildYearWorkbook(
  transactions: Transaction[],
  categories: Category[],
  year: string,
): YearWorkbook {
  const months = monthsOfYear(year);
  const yearTx = transactions.filter((t) => inYear(t, year));
  const planExpensesUser = planTotal(categories);

  const incomeRows = categories
    .filter((c) => c.kind === "income")
    .map((c) => toSheetRow(c, yearTx, months))
    .filter((r) => r.yearTotal !== 0 || r.plan > 0 || r.typical > 0);

  const expenseRows = categories
    .filter((c) => c.kind === "expense")
    .map((c) => toSheetRow(c, yearTx, months))
    .filter((r) => r.yearTotal !== 0 || r.plan > 0 || r.typical > 0)
    .sort((a, b) => b.yearTotal - a.yearTotal);

  const suggestedIncome = roundMoney(incomeRows.reduce((s, r) => s + r.typical, 0));
  const suggestedExpenses = roundMoney(expenseRows.reduce((s, r) => s + r.typical, 0));
  const counting = new Set(categories.filter((category) => countsTowardPlan(category, categories)).map((category) => category.id));
  const planIncome = roundMoney(incomeRows.filter((row) => counting.has(row.id)).reduce((s, r) => s + r.effectivePlan, 0));
  const planExpenses = roundMoney(expenseRows.filter((row) => counting.has(row.id)).reduce((s, r) => s + r.effectivePlan, 0));
  const usingSuggestedPlan = planExpensesUser <= 0 && suggestedExpenses > 0;

  const monthSummaries: YearMonthCell[] = months.map((ym) => {
    const cash = monthCash(yearTx, ym, categories);
    return {
      ym,
      income: cash.income,
      expenses: cash.expenses,
      net: cash.net,
      uncategorized: cash.uncategorized,
      count: cash.count,
      status: monthStatus(cash.expenses, planExpenses, cash.count),
      planExpenses,
      planIncome,
    };
  });

  const uncMonths = uncategorizedMonthSeries(yearTx, months, categories);
  const uncTotal = roundMoney(uncMonths.reduce((s, n) => s + n, 0));
  const uncategorizedRow: SheetRow | null =
    uncTotal > 0
      ? {
          id: "uncategorized",
          name: "Needs a category",
          kind: "uncategorized",
          months: uncMonths,
          yearTotal: uncTotal,
          typical: 0,
          plan: 0,
          effectivePlan: 0,
          usingSuggested: false,
          status: "no-plan",
        }
      : null;

  const income = roundMoney(monthSummaries.reduce((s, m) => s + m.income, 0));
  const expenses = roundMoney(monthSummaries.reduce((s, m) => s + m.expenses, 0));
  const net = roundMoney(income - expenses);
  const uncategorized = monthSummaries.reduce((s, m) => s + m.uncategorized, 0);
  const count = monthSummaries.reduce((s, m) => s + m.count, 0);
  const savingsCat = categories.find((c) => c.slug === "savings");
  const savingsMoved = savingsCat ? (expenseRows.find((r) => r.id === savingsCat.id)?.yearTotal ?? 0) : 0;
  const activeMonths = monthSummaries.filter((m) => m.count > 0).length;
  const monthsOnTrack = monthSummaries.filter((m) => m.status === "on-track").length;
  const monthsOver = monthSummaries.filter((m) => m.status === "over").length;

  return {
    year,
    months,
    incomeRows,
    expenseRows,
    uncategorizedRow,
    monthSummaries,
    income,
    expenses,
    net,
    savingsRate: income > 0 ? net / income : 0,
    uncategorized,
    count,
    savingsMoved,
    planIncome,
    planExpenses,
    planLeftover: roundMoney(planIncome - planExpenses),
    suggestedIncome,
    suggestedExpenses,
    usingSuggestedPlan,
    monthsOnTrack,
    monthsOver,
    activeMonths,
    avgMonthlyIncome: activeMonths ? roundMoney(income / activeMonths) : 0,
    avgMonthlyExpenses: activeMonths ? roundMoney(expenses / activeMonths) : 0,
  };
}

export function recommendedPlans(
  transactions: Transaction[],
  categories: Category[],
  year: string,
): { id: string; plannedMonthly: number }[] {
  const book = buildYearWorkbook(transactions, categories, year);
  const rows = [...book.incomeRows, ...book.expenseRows];
  return rows.filter((r) => r.typical > 0).map((r) => ({ id: r.id, plannedMonthly: r.typical }));
}

export function statusLabel(status: MonthStatus): string {
  if (status === "on-track") return "On track";
  if (status === "over") return "Over";
  if (status === "behind") return "Behind";
  if (status === "empty") return "No activity";
  return "No plan";
}

export function yearInsights(book: YearWorkbook): YearInsight[] {
  const items: YearInsight[] = [];
  if (book.income > 0) {
    const pct = Math.round(book.savingsRate * 100);
    items.push({
      id: "rate",
      title: `${pct}% savings rate`,
      body: `You kept ${formatMoney(book.net, { signed: true })} of ${formatMoney(book.income)} after spending ${formatMoney(book.expenses)}.`,
      tone: book.net >= 0 ? "good" : "warn",
    });
  }
  if (book.activeMonths) {
    items.push({
      id: "months",
      title:
        book.monthsOver > 0
          ? `${book.monthsOver} month${book.monthsOver === 1 ? "" : "s"} over plan`
          : `${book.monthsOnTrack} of ${book.activeMonths} months on track`,
      body:
        book.monthsOver > 0
          ? `${book.monthsOnTrack} of ${book.activeMonths} months with activity stayed at or under the monthly plan (${formatMoney(book.planExpenses)}).`
          : `Spending stayed at or under ${formatMoney(book.planExpenses)} in every month that had activity.`,
      tone: book.monthsOver > 0 ? "warn" : "good",
    });
  }
  const top = book.expenseRows[0];
  if (top && top.yearTotal > 0 && book.expenses > 0) {
    const share = Math.round((top.yearTotal / book.expenses) * 100);
    items.push({
      id: "top",
      title: `${top.name} is the largest expense`,
      body: `${formatMoney(top.yearTotal)} this year (${share}% of spending). Typical month ${formatMoney(top.typical)}.`,
      tone: "neutral",
    });
  }
  if (book.uncategorized > 0) {
    items.push({
      id: "open",
      title: `${book.uncategorized} row${book.uncategorized === 1 ? "" : "s"} still need a category`,
      body: "Open Categories — most repeated merchants are first. One change updates every matching charge.",
      tone: "warn",
    });
  } else if (book.avgMonthlyIncome > 0) {
    items.push({
      id: "avg",
      title: `Typical month ${formatMoney(book.avgMonthlyIncome)} in`,
      body: `Average spending in months with activity is ${formatMoney(book.avgMonthlyExpenses)}. Suggested leftover is ${formatMoney(book.planLeftover, { signed: true })}.`,
      tone: "neutral",
    });
  }
  return items.slice(0, 4);
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function yearSheetCsv(book: YearWorkbook): string {
  const header = [
    "Category",
    ...book.months.map(monthShort),
    "Year",
    "Typical / mo",
    "Plan / mo",
    "Status",
  ];
  const lines = [header.join(",")];

  function add(section: string, rows: SheetRow[], totalLabel: string, yearTotal: number) {
    lines.push([csvEscape(section), ...Array(15).fill("")].join(","));
    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.name),
          ...r.months.map((n) => n.toFixed(2)),
          r.yearTotal.toFixed(2),
          r.typical.toFixed(2),
          r.effectivePlan.toFixed(2),
          statusLabel(r.status),
        ].join(","),
      );
    }
    const monthTotals = book.months.map((_, i) => roundMoney(rows.reduce((s, r) => s + r.months[i], 0)));
    lines.push(
      [csvEscape(totalLabel), ...monthTotals.map((n) => n.toFixed(2)), yearTotal.toFixed(2), "", "", ""].join(","),
    );
  }

  add("Income", book.incomeRows, "Total income", book.income);
  add("Expenses", book.expenseRows, "Total spending", book.expenses);
  if (book.uncategorizedRow) {
    add("Uncategorized", [book.uncategorizedRow], "Needs a category", book.uncategorizedRow.yearTotal);
  }
  lines.push(
    [
      "Net leftover",
      ...book.monthSummaries.map((m) => m.net.toFixed(2)),
      book.net.toFixed(2),
      "",
      book.planLeftover.toFixed(2),
      book.income > 0 ? `${Math.round(book.savingsRate * 100)}% saved` : "",
    ].join(","),
  );
  return lines.join("\n");
}
