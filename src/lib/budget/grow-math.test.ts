import assert from "node:assert/strict";
import { test } from "node:test";
import { monthsToTarget, yearsToDouble } from "./grow-math.ts";
import { DEFAULT_IRA, reducedRothLimit } from "./ira.ts";

test("money doubles in about 10 years at 7%", () => {
  const years = yearsToDouble(7);
  assert.ok(years != null && years > 10 && years < 11);
  assert.equal(yearsToDouble(0), null);
});

test("Roth phase-out rounds up to $10 and keeps the $200 floor", () => {
  assert.equal(reducedRothLimit(DEFAULT_IRA, 100000, false, 7500), 7500);
  assert.equal(reducedRothLimit(DEFAULT_IRA, 168000, false, 7500), 0);
  assert.equal(reducedRothLimit(DEFAULT_IRA, 167800, false, 7500), 200);
  assert.equal(reducedRothLimit(DEFAULT_IRA, 167992, false, 7500), 200);
});

test("monthly saving reaches a target", () => {
  assert.equal(monthsToTarget({ principal: 1000, monthly: 0, apr: 0, target: 500 }), 0);
  assert.equal(monthsToTarget({ principal: 0, monthly: 100, apr: 0, target: 1200 }), 12);
  assert.equal(monthsToTarget({ principal: 0, monthly: 0, apr: 0, target: 100 }), null);
});
