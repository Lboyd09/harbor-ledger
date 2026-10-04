import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecurringBill } from "./analytics-depth.ts";
import { budgetLead, comingUp, monthStrip, orderSpending, splitFixedFlexible, suggestAmounts } from "./screen-plan.ts";
import type { Category, Transaction } from "./types.ts";

test("the budget lead names the plan and stays quiet when income is missing", () => {
  const ready = budgetLead({ plannedSpend: 1800, usualIncome: 3000, typicalSpend: 2000, typicalMonths: 4 });
  assert.match(ready.sentence, /Planned/);
  assert.match(ready.sentence, /3,000/);
  assert.match(ready.cover ?? "", /percent/);
  const thin = budgetLead({ plannedSpend: 400, usualIncome: 0, typicalSpend: null, typicalMonths: 1 });
  assert.equal(thin.incomeMissing, true);
  assert.match(thin.sentence, /not entered yet/i);
  assert.equal(thin.cover, null);
});

test("spending rows put what is over first, then split fixed and flexible", () => {
  const ordered = orderSpending([
    { id: "a", name: "Gas", over: false, risk: false, size: 200 },
    { id: "b", name: "Rent", over: true, risk: false, size: 50 },
    { id: "c", name: "Food", over: false, risk: true, size: 80 },
  ]);
  assert.deepEqual(ordered.map((row) => row.id), ["b", "c", "a"]);
  const groups = splitFixedFlexible(ordered, ["b"], ["a"]);
  assert.deepEqual(groups.fixed.map((row) => row.id), ["b"]);
  assert.deepEqual(groups.flexible.map((row) => row.id), ["a"]);
  assert.deepEqual(groups.rest.map((row) => row.id), ["c"]);
});

test("a suggestion needs two months, and coming up is the next 30 days", () => {
  const categories: Category[] = [{ id: "gas", slug: "gas", name: "Gas", kind: "expense", plannedMonthly: 0 }];
  const one: Transaction[] = [
    {
      id: "1",
      date: "2026-09-02",
      description: "SHELL",
      merchantKey: "SHELL",
      amount: -40,
      sourceLabel: "Bank",
      fingerprint: "1",
      categoryId: "gas",
      userSet: true,
      notes: "",
      excluded: false,
      status: "posted",
    },
  ];
  const thin = suggestAmounts(categories, one, "2026-09");
  assert.equal(thin[0]?.suggested, null);
  assert.match(thin[0]?.sentence ?? "", /not enough/i);
  const two = [
    ...one,
    { ...one[0], id: "2", date: "2026-08-02", fingerprint: "2", amount: -60 },
  ];
  const ready = suggestAmounts(categories, two, "2026-09");
  assert.equal(ready[0]?.suggested, 50);
  const bills: RecurringBill[] = [
    {
      merchantKey: "RENT",
      description: "Rent",
      categoryId: "housing",
      categoryName: "Rent",
      usual: 1000,
      interval: "monthly",
      lastDate: "2026-09-01",
      nextDate: "2026-10-01",
      yearly: 12000,
      kind: "fixed",
      priceChange: null,
      status: "active",
    },
    {
      merchantKey: "FAR",
      description: "Far",
      categoryId: null,
      categoryName: null,
      usual: 10,
      interval: "monthly",
      lastDate: "2026-09-01",
      nextDate: "2026-12-01",
      yearly: 120,
      kind: "fixed",
      priceChange: null,
      status: "active",
    },
  ];
  const soon = comingUp(bills, "2026-09-20", 30);
  assert.equal(soon?.length, 1);
  assert.equal(soon?.[0].description, "Rent");
  assert.equal(comingUp(null, "2026-09-20"), null);
});

test("the month strip stays hidden until a forecast exists", () => {
  const hidden = monthStrip({ forecast: null, incomeSoFar: 0, incomeStill: null });
  assert.equal(hidden.ready, false);
  assert.match(hidden.reason ?? "", /not enough/i);
  const shown = monthStrip({
    forecast: {
      ym: "2026-10",
      today: "2026-10-04",
      spentSoFar: 400,
      projectedSpend: 900,
      low: 800,
      high: 1000,
      planned: 1000,
      sentence: "Spent so far.",
    },
    incomeSoFar: 2000,
    incomeStill: 500,
  });
  assert.equal(shown.ready, true);
  assert.equal(shown.daysLeft, 27);
  assert.equal(shown.projectedLeft, 1600);
});
