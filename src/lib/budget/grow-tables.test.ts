import assert from "node:assert/strict";
import { test } from "node:test";
import { loanCompare, payoffPlan } from "./grow-math.ts";
import { amortizationSchedule, debtMatchesPayoff, debtTimeline, fiNumbers, netWorthSeries, sensitivityOf, yearRows } from "./grow-tables.ts";
import type { Account, BalancePoint, DebtItem } from "./types.ts";

test("year rows and sensitivity keep the same ending balance", () => {
  const rows = yearRows({ principal: 1000, monthly: 100, years: 10, rate: 0.07, inflation: 0.02, today: false });
  assert.equal(rows.length, 10);
  assert.ok(rows.at(-1)!.balance > rows[0].balance);
  const sense = sensitivityOf((rate, monthly) => yearRows({ principal: 1000, monthly, years: 10, rate, inflation: 0, today: false }).at(-1)?.balance ?? 0, 0.07, 100);
  assert.equal(sense.length, 5);
  assert.equal(sense[1].value, rows.at(-1)?.balance);
  assert.ok(sense[2].value > sense[0].value);
});

test("the loan table matches the loan payment and the payoff month", () => {
  const loan = loanCompare({ balance: 20000, apr: 6.5, years: 5, extra: 0 });
  const rows = amortizationSchedule({ balance: 20000, aprPercent: 6.5, years: 5 });
  assert.equal(rows.length, loan.months);
  assert.ok(Math.abs(rows[0].payment - loan.payment) < 0.02);
  const interest = rows.reduce((sum, row) => sum + row.interest, 0);
  assert.ok(Math.abs(interest - loan.interest) < 2, `table interest ${interest} vs ${loan.interest}`);
  assert.ok(rows.at(-1)!.balance < 1);
});

test("5.5 years is 66 months and extra payments lower the interest", () => {
  const half = loanCompare({ balance: 10000, apr: 6, years: 5.5, extra: 0 });
  assert.equal(half.months, 66);
  const rows = amortizationSchedule({ balance: 10000, aprPercent: 6, years: 5.5 });
  assert.equal(rows.length, 66);
  const plain = loanCompare({ balance: 20000, apr: 6.5, years: 5, extra: 0 });
  const extra = loanCompare({ balance: 20000, apr: 6.5, years: 5, extra: 100 });
  assert.ok(extra.extraInterest < plain.interest);
  assert.ok(extra.extraMonths < plain.months);
});

test("the debt timeline matches the avalanche payoff", () => {
  const debts: DebtItem[] = [
    { id: "a", name: "Card", balance: 2000, apr: 18, minimum: 80 },
    { id: "b", name: "Loan", balance: 5000, apr: 6, minimum: 100 },
  ];
  assert.equal(debtMatchesPayoff(debts, 50), true);
  const line = debtTimeline(debts, 50);
  const plan = payoffPlan(debts, 50, "avalanche");
  assert.equal(line.withExtra.at(-1)?.month, plan.months);
  assert.ok(line.minimums.at(-1)!.month >= line.withExtra.at(-1)!.month);
});

test("net worth walks balances forward and FI uses spending over the withdrawal rate", () => {
  const accounts: Account[] = [
    { id: "check", name: "Checking", kind: "checking", createdAt: "2026-01-01" },
    { id: "ira", name: "IRA", kind: "retirement", createdAt: "2026-01-01" },
  ];
  const balances: BalancePoint[] = [
    { id: "1", accountId: "check", date: "2026-01-15", amount: 1000, source: "entered" },
    { id: "2", accountId: "ira", date: "2026-01-15", amount: 4000, source: "entered" },
    { id: "3", accountId: "check", date: "2026-03-01", amount: 1500, source: "entered" },
  ];
  const series = netWorthSeries(accounts, balances);
  assert.equal(series.length, 2);
  assert.equal(series[0].total, 5000);
  assert.equal(series[1].total, 5500);
  assert.equal(series[1].byKind.checking, 1500);
  assert.equal(series[1].byKind.retirement, 4000);
  const fi = fiNumbers({ yearlySpend: 40000, withdrawal: 0.04, savingsRate: 0.2, realReturn: 0.05, yearsLeft: 20 });
  assert.equal(fi.fi, 1000000);
  assert.equal(typeof fi.years, "number");
  assert.ok(fi.coast != null && fi.coast < 1000000);
});
