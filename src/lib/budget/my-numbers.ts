import { roundMoney } from "./money.ts";

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
