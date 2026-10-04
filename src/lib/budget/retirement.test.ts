import assert from "node:assert/strict";
import { test } from "node:test";
import {
  projectRetirement,
  retirementMonteCarlo,
  retirementWithExtra,
  retirementWithYears,
  type RetirementInput,
} from "./retirement.ts";

const base: RetirementInput = {
  age: 40,
  retireAge: 67,
  saved: 50000,
  monthlySaving: 400,
  employerMatchPercent: 0,
  returns: { conservative: 0.04, expected: 0.07, optimistic: 0.1 },
  inflation: 0.02,
  incomeWantedYearly: 60000,
  socialSecurityMonthly: 0,
  withdrawalRate: 0.04,
};

function finite(result: ReturnType<typeof projectRetirement>) {
  assert.equal(Number.isFinite(result.gapYearly), true);
  assert.equal(Number.isFinite(result.coveredPercent), true);
  for (const path of result.paths) {
    assert.equal(Number.isFinite(path.balance), true);
    assert.equal(Number.isFinite(path.real), true);
    assert.equal(Number.isFinite(path.incomeYearly), true);
    assert.ok(!Number.isNaN(path.balance));
  }
}

test("zero savings still projects from what you add", () => {
  const result = projectRetirement({ ...base, saved: 0, monthlySaving: 500, incomeWantedYearly: 20000 });
  finite(result);
  assert.ok(result.paths[1].balance > 0);
});

test("already past retire age does not invent future years of saving", () => {
  const result = projectRetirement({ ...base, age: 70, retireAge: 67, saved: 10000, monthlySaving: 0 });
  finite(result);
  assert.equal(result.years, 0);
  assert.equal(result.extraPerMonth, null);
  assert.match(result.sentence, /already past/i);
});

test("a huge gap and negative inputs stay finite", () => {
  const huge = projectRetirement({
    ...base,
    age: -4,
    saved: -1000,
    monthlySaving: -50,
    employerMatchPercent: -10,
    inflation: Number.NaN,
    incomeWantedYearly: 1e15,
    socialSecurityMonthly: -20,
    withdrawalRate: -1,
  });
  finite(huge);
  assert.ok(huge.gapYearly > 0);
  const empty = projectRetirement({ ...base, saved: 0, monthlySaving: 0, incomeWantedYearly: 1e12 });
  finite(empty);
  assert.equal(empty.extraYears, null);
  assert.equal(Number.isFinite(empty.extraPerMonth ?? 0), true);
});

test("the same seed gives the same Monte Carlo", () => {
  const first = retirementMonteCarlo(base, { seed: 7, runs: 200, mean: 0.06, spread: 0.1 });
  const second = retirementMonteCarlo(base, { seed: 7, runs: 200, mean: 0.06, spread: 0.1 });
  assert.deepEqual(first, second);
  assert.equal(first.runs, 200);
  assert.ok(first.points.length > 10);
  assert.ok(first.points.every((point) => point.p10 <= point.p50 && point.p50 <= point.p90));
  const other = retirementMonteCarlo(base, { seed: 8, runs: 200, mean: 0.06, spread: 0.1 });
  assert.notDeepEqual(other.points, first.points);
});

test("extra per month and extra years both reach the income you want", () => {
  const result = projectRetirement(base);
  finite(result);
  assert.ok(result.gapYearly > 0);
  assert.ok(result.extraPerMonth != null && result.extraPerMonth > 0);
  assert.ok(result.extraYears != null && result.extraYears > 0);
  const withMoney = retirementWithExtra(base, result.extraPerMonth);
  assert.ok(
    withMoney.paths[1].incomeYearly + 1 >= result.wantedYearly,
    `extra monthly ${result.extraPerMonth} reached ${withMoney.paths[1].incomeYearly}, wanted ${result.wantedYearly}`,
  );
  const withYears = retirementWithYears(base, result.extraYears);
  assert.ok(
    withYears.paths[1].incomeYearly + 1 >= result.wantedYearly,
    `extra years ${result.extraYears} reached ${withYears.paths[1].incomeYearly}, wanted ${result.wantedYearly}`,
  );
});
