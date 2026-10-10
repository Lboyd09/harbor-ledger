import assert from "node:assert/strict";
import { test } from "node:test";
import { goalPace } from "./buckets.ts";
import { alexHousehold } from "./fixtures/household-alex.ts";
import { debtWhatIfs } from "./grow-math.ts";
import { lumpWhatIfs } from "./lump.ts";
import { actualMonthlySaving, myNumbers } from "./my-numbers.ts";
import { savingsPlanMonthly } from "./onboarding-plan.ts";
import { dropSameWhatIfs } from "./phase4.ts";
import { moneyPicture } from "./picture.ts";
import { plannerFacts } from "./planner.ts";
import { planTotal } from "./plans.ts";
import { retirementInputFrom, retirementSensitivity } from "./retirement.ts";
import type { MoneyBucket } from "./types.ts";

test("Alex's screens share income, plan, cushion, net worth, and monthly saving", () => {
  const alex = alexHousehold();
  const plan = planTotal(alex.categories);
  assert.equal(plan, 4065);
  const picture = moneyPicture({
    accounts: alex.accounts,
    balances: alex.balances,
    debts: alex.debts,
    transactions: alex.transactions,
    categories: alex.categories,
    ym: "2026-10",
    bills: plan,
  });
  const moved = actualMonthlySaving(alex.transactions, alex.categories);
  assert.equal(moved, 500);
  const numbers = myNumbers({
    monthlyIncome: alex.profile.monthlyIncome,
    planTotal: plan,
    typicalSpending: 1408,
    savedByMonth: [500, 500, 500],
    cash: picture.cash,
    brokerage: picture.brokerage,
    retirement: picture.retirement,
    debts: picture.debts,
    funds: 0,
    cushionCash: picture.cushionCash,
    age: 35,
  });
  const facts = plannerFacts({ ...alex, year: 2026 });
  assert.equal(facts.incomeMonthly.value, numbers.monthlyIncome);
  assert.equal(facts.monthlySaving.value, numbers.monthlySaving);
  assert.equal(picture.net, numbers.net);
  assert.equal(picture.cushionMonths, numbers.cushionMonths);
  assert.equal(numbers.monthlyIncome, 4200);
  assert.equal(numbers.monthlySaving, 500);
  assert.equal(numbers.net, 25440);
  assert.equal(picture.cushionMonths, 1.51);
});

test("setup and a fund use the same monthly amount once already-saved counts", () => {
  const start = "2026-01";
  const by = "2027-03";
  const monthly = savingsPlanMonthly(10000, by, start, 1650);
  const fund: MoneyBucket = {
    id: "car",
    name: "Used car",
    monthly: monthly ?? 0,
    yearly: null,
    categoryIds: [],
    target: 10000,
    by,
    startMonth: start,
    opening: 1650,
  };
  const pace = goalPace(fund, 1650, start);
  assert.equal(monthly, 556.67);
  assert.equal(pace?.required, monthly);
});

test("shown what-if rows differ from the base and from each other", () => {
  const alex = alexHousehold();
  const debtRows = dropSameWhatIfs(
    debtWhatIfs(
      alex.debts.map((debt) => ({ ...debt, origin: "plan" as const })),
      150,
    ).map((row) => ({ label: row.label, value: `${row.months}:${row.interest}` })),
  );
  assert.ok(debtRows.length >= 1);
  assert.equal(new Set(debtRows.map((row) => row.value)).size, debtRows.length);
  assert.ok(debtRows.every((row) => !/as entered/i.test(row.label)));

  const lumpRows = dropSameWhatIfs(
    lumpWhatIfs({ amount: 1000, years: 10, rate: 0.07, gainTax: 0.15, inflation: 0.02, today: false }).map((row) => ({
      label: row.label,
      value: String(row.beforeTax),
    })),
  );
  assert.equal(new Set(lumpRows.map((row) => row.value)).size, lumpRows.length);
  assert.ok(lumpRows.every((row) => !/as entered/i.test(row.label)));

  const read = retirementInputFrom({
    age: "35",
    retireAge: "67",
    saved: "10000",
    monthlySaving: "200",
    employerMatchPercent: "0",
    low: "4",
    mid: "7",
    high: "10",
    inflation: "2",
    incomeWantedYearly: "40000",
    socialSecurityMonthly: "0",
    withdrawal: "4",
  });
  assert.equal(read.ok, true);
  if (!read.ok) return;
  const sense = retirementSensitivity(read.input);
  const base = sense.find((row) => row.label === "Return as entered")?.real ?? 0;
  const shown = dropSameWhatIfs(
    sense.map((row) => ({ label: row.label, value: String(row.real) })),
    String(base),
  );
  assert.equal(new Set(shown.map((row) => row.value)).size, shown.length);
  assert.ok(shown.every((row) => row.value !== String(base)));
});
