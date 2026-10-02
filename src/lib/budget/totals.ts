import { monthKeyFromDate, weekKeyFromDate } from "./parse-date.ts";
import { countsTowardPlan } from "./plans.ts";
import { plannedForPeriod } from "./period.ts";
import { piecesOf } from "./splits.ts";
import type { BudgetPeriod, Category, Transaction } from "./types.ts";

export function inMonth(t: Transaction, ym: string) {
  return monthKeyFromDate(t.date) === ym;
}

export function inWeek(t: Transaction, wk: string) {
  return weekKeyFromDate(t.date) === wk;
}

export function inPeriod(t: Transaction, period: BudgetPeriod, key: string) {
  return period === "week" ? inWeek(t, key) : inMonth(t, key);
}

export function monthsInData(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) set.add(monthKeyFromDate(t.date));
  return [...set].sort();
}

export function weeksInData(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) set.add(weekKeyFromDate(t.date));
  return [...set].sort();
}

function categoryMap(categories: Category[]) {
  return new Map(categories.map((c) => [c.id, c]));
}

export function countsInCashflow(t: Transaction) {
  return !t.excluded && t.status !== "transfer" && t.status !== "reimbursement";
}

export function sumByCategory(
  transactions: Transaction[],
  ym: string,
  kind: "income" | "expense",
  categories: Category[],
  period: BudgetPeriod = "month",
) {
  const ids = new Set(categories.filter((c) => c.kind === kind).map((c) => c.id));
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (!inPeriod(t, period, ym)) continue;
    if (!countsInCashflow(t)) continue;
    if (t.status === "refund") {
      if (kind !== "expense") continue;
      if (!t.categoryId || !ids.has(t.categoryId)) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) - Math.abs(t.amount));
      continue;
    }
    const parts = piecesOf(t);
    if (parts) {
      for (const part of parts) {
        if (!ids.has(part.categoryId)) continue;
        map.set(part.categoryId, (map.get(part.categoryId) ?? 0) + part.amount);
      }
      continue;
    }
    if (!t.categoryId || !ids.has(t.categoryId)) continue;
    const add = kind === "income" ? t.amount : -t.amount;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + add);
  }
  return map;
}

function foldCash(transactions: Transaction[], categories: Category[], keep: (t: Transaction) => boolean) {
  const byId = categoryMap(categories);
  let income = 0;
  let expenses = 0;
  let uncategorized = 0;
  let count = 0;
  let excluded = 0;
  let transfers = 0;
  let refunds = 0;
  for (const t of transactions) {
    if (!keep(t)) continue;
    if (t.excluded) {
      excluded += 1;
      continue;
    }
    if (t.status === "transfer") {
      transfers += 1;
      continue;
    }
    if (t.status === "reimbursement") {
      refunds += 1;
      continue;
    }
    if (t.status === "refund") {
      refunds += 1;
      count += 1;
      expenses -= Math.abs(t.amount);
      continue;
    }
    count += 1;
    const parts = piecesOf(t);
    if (parts) {
      for (const part of parts) {
        const cat = byId.get(part.categoryId);
        if (!cat) {
          if (t.amount > 0) income += part.amount;
          else expenses += part.amount;
          uncategorized += 1;
          continue;
        }
        if (cat.kind === "income") income += part.amount;
        else expenses += part.amount;
      }
      continue;
    }
    const cat = t.categoryId ? byId.get(t.categoryId) : undefined;
    if (!cat) {
      if (t.amount > 0) income += t.amount;
      else if (t.amount < 0) expenses += -t.amount;
      uncategorized += 1;
      continue;
    }
    if (cat.kind === "income") income += t.amount;
    else expenses += -t.amount;
  }
  return { income, expenses, net: income - expenses, uncategorized, count, excluded, transfers, refunds };
}

export function monthCash(transactions: Transaction[], ym: string, categories: Category[] = []) {
  return foldCash(transactions, categories, (t) => inMonth(t, ym));
}

export function weekCash(transactions: Transaction[], wk: string, categories: Category[] = []) {
  return foldCash(transactions, categories, (t) => inWeek(t, wk));
}

export function periodCash(
  transactions: Transaction[],
  period: BudgetPeriod,
  key: string,
  categories: Category[] = [],
) {
  return period === "week" ? weekCash(transactions, key, categories) : monthCash(transactions, key, categories);
}

export function yearCash(transactions: Transaction[], ym: string, categories: Category[] = []) {
  const year = ym.slice(0, 4);
  return { ...foldCash(transactions, categories, (t) => t.date.startsWith(year)), year };
}

export function monthlySeries(transactions: Transaction[], categories: Category[] = []) {
  const keys = monthsInData(transactions);
  return keys.map((ym) => {
    const v = monthCash(transactions, ym, categories);
    return { key: ym, ym, ...v };
  });
}

export function weeklySeries(transactions: Transaction[], categories: Category[] = []) {
  const keys = weeksInData(transactions);
  return keys.map((wk) => {
    const v = weekCash(transactions, wk, categories);
    return { key: wk, ym: wk, ...v };
  });
}

export function plannedTotals(categories: Category[], period: BudgetPeriod = "month") {
  const income = categories
    .filter((c) => c.kind === "income" && countsTowardPlan(c, categories))
    .reduce((s, c) => s + plannedForPeriod(c.plannedMonthly, period), 0);
  const expenses = categories
    .filter((c) => c.kind === "expense" && countsTowardPlan(c, categories))
    .reduce((s, c) => s + plannedForPeriod(c.plannedMonthly, period), 0);
  return { income, expenses, leftover: income - expenses };
}

export function coverage(transactions: Transaction[]) {
  const counted = transactions.filter((t) => !t.excluded);
  const total = counted.length;
  const assigned = counted.filter((t) => t.categoryId).length;
  return { total, assigned, uncategorized: total - assigned, pct: total ? Math.round((assigned / total) * 100) : 0 };
}

export function envelopeRows(
  transactions: Transaction[],
  categories: Category[],
  period: BudgetPeriod,
  key: string,
) {
  const exp = sumByCategory(transactions, key, "expense", categories, period);
  const inc = sumByCategory(transactions, key, "income", categories, period);
  return categories.map((c) => {
    const plan = plannedForPeriod(c.plannedMonthly, period);
    const actual = c.kind === "income" ? (inc.get(c.id) ?? 0) : (exp.get(c.id) ?? 0);
    const remaining = c.kind === "expense" ? plan - actual : actual - plan;
    const over = c.kind === "expense" && plan > 0 && actual > plan;
    return { category: c, plan, actual, remaining, over };
  });
}
