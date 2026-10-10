import assert from "node:assert/strict";
import { test } from "node:test";
import { inflated, loanCompare, monthlyForGoal, projectBoth, yearsToDouble } from "./grow-math.ts";
import { axisMoney } from "./money.ts";
import { myNumbers } from "./my-numbers.ts";
import {
  amountEditorKey,
  cashAboveCushion,
  extraPaymentSavings,
  investingReadiness,
  savingsRate,
  scheduleGap,
  whatIfRows,
} from "./phase4.ts";
import { moneyPicture } from "./picture.ts";
import { monteCarloInTodaysDollars, projectRetirement, retirementInputFrom, retirementMonteCarlo, type RetirementFields } from "./retirement.ts";
import type { Account, BalancePoint, DebtItem, MoneyBucket, Transaction } from "./types.ts";

/** Scenario (d). Likely today's dollars are locked in calc-input.test.ts at $543,829.77. Mortgage payment is locked in calc-input.test.ts at $1,896.20. */
const scenarioD: RetirementFields = {
  age: "29",
  retireAge: "67",
  saved: "18300",
  monthlySaving: "500",
  employerMatchPercent: "0",
  low: "4",
  mid: "7",
  high: "10",
  inflation: "2.5",
  incomeWantedYearly: "13521",
  socialSecurityMonthly: "",
  withdrawal: "4",
};

const scenarioB: DebtItem[] = [
  { id: "visa", name: "Visa", balance: 1240, apr: 24.99, minimum: 40 },
  { id: "student", name: "Student loan", balance: 18500, apr: 5.5, minimum: 280 },
];

test("axisMoney prints short ticks", () => {
  assert.equal(axisMoney(0), "$0");
  assert.equal(axisMoney(2_000_000), "$2M");
  assert.equal(axisMoney(12_500), "$12.5K");
  assert.equal(axisMoney(-2_000), "−$2K");
});

test("named references: monthly add, goal, doubling, inflation", () => {
  const path = projectBoth({ principal: 10000, monthly: 200, years: 10, rate: 0.07, inflation: 0, today: false });
  assert.equal(path.at(-1)?.balance, 54713.58);
  assert.equal(monthlyForGoal(12000, 6200, 24), 241.67);
  assert.equal(yearsToDouble(7), 10.24);
  assert.deepEqual(inflated(1000, 10, 3), { later: 1343.92, buyingPower: 744.09 });
  assert.equal(loanCompare({ balance: 300000, apr: 6.5, years: 30, extra: 0 }).payment, 1896.2);
});

test("extra payment on the reference debts saves the gap to 47 months and $2,337.61", () => {
  const saved = extraPaymentSavings(scenarioB, 150);
  assert.ok(saved);
  assert.equal(saved.interestSaved, 1955.45);
  assert.equal(saved.monthsSaved, 29);
});

test("cushion, savings rate, spare cash, and schedule pace", () => {
  const numbers = myNumbers({
    monthlyIncome: 4200,
    planTotal: 4065,
    typicalSpending: 1408,
    savedByMonth: [500, 500, 500],
    cash: 11130,
    brokerage: 6950,
    retirement: 36900,
    debts: 29540,
    funds: 1000,
    cushionCash: 7130,
    age: 35,
  });
  assert.equal(numbers.monthlySaving, 500);
  assert.equal(numbers.cushionMonths, 1.75);
  assert.equal(numbers.net, 25440);
  assert.equal(savingsRate(500, 4200), numbers.savingsRate);
  assert.equal(cashAboveCushion(20000, 4065), 7805);
  assert.equal(cashAboveCushion(1000, 4065), null);
  assert.equal(scheduleGap({ monthly: 1000, monthsElapsed: 3, balance: 3090 }).sentence, "You're $90 ahead of schedule");
});

test("a cushion fund flag counts, and a name match is only the fallback", () => {
  const accounts: Account[] = [
    { id: "sav", name: "Savings", kind: "savings", createdAt: "2026-01-01" },
  ];
  const balances: BalancePoint[] = [{ id: "b", accountId: "sav", date: "2026-03-01", amount: 6130, source: "entered" }];
  const fund: MoneyBucket = {
    id: "c",
    name: "Trip",
    monthly: 0,
    yearly: null,
    categoryIds: [],
    target: null,
    by: null,
    startMonth: "2026-01",
    opening: 1000,
    isCushion: true,
  };
  const tx: Transaction[] = [];
  const picture = moneyPicture({
    accounts,
    balances,
    funds: [fund],
    transactions: tx,
    categories: [],
    ym: "2026-03",
    bills: 4065,
  });
  assert.equal(picture.cushionMonths, 1.75);
});

test("what-if rows drop a result that matches the base", () => {
  const rows = whatIfRows(10, [
    { label: "same", value: 10 },
    { label: "up", value: 12 },
    { label: "also up", value: 12 },
  ], (a, b) => a === b);
  assert.deepEqual(rows, [{ label: "up", value: 12 }]);
});

test("investing readiness stops on a 24.99% card and is ready at 4 months", () => {
  const blocked = investingReadiness({ monthsSaved: 2, highAprDebt: { name: "Visa", apr: 24.99 } });
  assert.equal(blocked.step, 2);
  assert.match(blocked.sentence, /Pay off your Visa first/);
  assert.match(blocked.sentence, /24\.99%/);
  assert.equal(investingReadiness({ monthsSaved: 4 }).step, "ready");
});

test("the first Escape restores the amount and the second closes", () => {
  const once = amountEditorKey({ draft: "9", saved: "5", armed: false, close: false }, "Escape");
  assert.equal(once.draft, "5");
  assert.equal(once.close, false);
  const twice = amountEditorKey(once, "Escape");
  assert.equal(twice.close, true);
});

test("scenario (d) likely value stays $543,829.77 and the monte carlo median is in today's dollars", () => {
  const read = retirementInputFrom(scenarioD);
  assert.ok(read.ok);
  const result = projectRetirement(read.input);
  assert.equal(result.paths[1].real, 543829.77);
  const mc = retirementMonteCarlo(read.input, { mean: 0.07, spread: 0.12, seed: 20261004, runs: 200 });
  const raw = mc.points.find((point) => point.age === 67);
  const today = monteCarloInTodaysDollars(mc.points, read.input.inflation, read.input.age);
  const at67 = today.find((point) => point.age === 67);
  assert.ok(raw && at67);
  assert.ok(at67.p50 < raw.p50, "today's dollars are below the future-dollar median");
  assert.ok(at67.p50 < 800_000, `converted median ${at67.p50} must not stay near $1.11M`);
});
