import { roundMoney } from "./money.ts";
import type { Category, Transaction } from "./types.ts";

export type MyNumbers = {
  monthlyIncome: number;
  planTotal: number;
  typicalSpending: number;
  monthlySaving: number;
  cash: number;
  brokerage: number;
  retirement: number;
  debts: number;
  funds: number;
  age: number | null;
  net: number;
  cushionMonths: number | null;
  savingsRate: number | null;
};

/** One set of numbers for Today, Budget, Money, and the calculators. */
export function myNumbers(input: {
  monthlyIncome: number;
  planTotal: number;
  typicalSpending: number;
  savedByMonth: number[];
  cash: number;
  brokerage: number;
  retirement: number;
  debts: number;
  funds: number;
  cushionCash: number;
  age?: number | null;
}): MyNumbers {
  const months = input.savedByMonth.filter((n) => Number.isFinite(n));
  const monthlySaving = months.length ? roundMoney(months.reduce((sum, n) => sum + n, 0) / months.length) : 0;
  const spend = input.planTotal > 0 ? input.planTotal : input.typicalSpending;
  const income = input.monthlyIncome;
  return {
    monthlyIncome: roundMoney(income),
    planTotal: roundMoney(input.planTotal),
    typicalSpending: roundMoney(input.typicalSpending),
    monthlySaving,
    cash: roundMoney(input.cash),
    brokerage: roundMoney(input.brokerage),
    retirement: roundMoney(input.retirement),
    debts: roundMoney(input.debts),
    funds: roundMoney(input.funds),
    age: input.age ?? null,
    net: roundMoney(input.cash + input.brokerage + input.retirement - input.debts),
    cushionMonths: spend > 0 ? roundMoney(input.cushionCash / spend) : null,
    savingsRate: income > 0 ? roundMoney(monthlySaving / income) : null,
  };
}

/** Average moved into savings or retirement over the last three complete months. */
export function actualMonthlySaving(transactions: Transaction[], categories: Category[], todayYm?: string): number | null {
  const savingIds = new Set(
    categories
      .filter((category) => /savings|retirement/i.test(`${category.slug} ${category.name}`))
      .map((category) => category.id),
  );
  if (!savingIds.size) return null;
  const current = todayYm && /^\d{4}-\d{2}$/.test(todayYm) ? todayYm : latestMonth(transactions);
  const byMonth = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.excluded || !tx.categoryId || !savingIds.has(tx.categoryId)) continue;
    const ym = tx.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym) || (current && ym >= current)) continue;
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + Math.abs(tx.amount));
  }
  const months = [...byMonth.keys()].sort().slice(-3);
  if (!months.length) return null;
  return roundMoney(months.reduce((sum, ym) => sum + (byMonth.get(ym) ?? 0), 0) / months.length);
}

function latestMonth(transactions: Transaction[]): string | null {
  let latest: string | null = null;
  for (const tx of transactions) {
    const ym = tx.date.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym) && (latest == null || ym > latest)) latest = ym;
  }
  return latest;
}
