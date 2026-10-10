import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecurringBill } from "./analytics-depth.ts";
import { monthLedger } from "./ledger-month.ts";
import { budgetLead, categoryStory, comingUp, monthStrip, orderSpending, splitFixedFlexible, stillComingThisMonth, suggestAmounts, surplusSuggestions, yearlyComingLine } from "./screen-plan.ts";
import type { Category, Transaction } from "./types.ts";

test("the budget lead names the plan and stays quiet when income is missing", () => {
  const ready = budgetLead({ plannedSpend: 1800, usualIncome: 3000, typicalSpend: 2000, typicalMonths: 4 });
  assert.match(ready.sentence, /planned of/);
  assert.match(ready.sentence, /3,000/);
  assert.equal(ready.cover, null);
  const hot = budgetLead({ plannedSpend: 4000, usualIncome: 3000, typicalSpend: 2000, typicalMonths: 4 });
  assert.match(hot.cover ?? "", /%/);
  const thin = budgetLead({ plannedSpend: 400, usualIncome: 0, typicalSpend: null, typicalMonths: 1 });
  assert.equal(thin.incomeMissing, true);
  assert.match(thin.sentence, /add income/i);
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
  assert.equal(thin.length, 0);
  const two = [
    ...one,
    { ...one[0], id: "2", date: "2026-08-02", fingerprint: "2", amount: -60 },
  ];
  const ready = suggestAmounts(categories, two, "2026-09");
  assert.equal(ready[0]?.suggested, 50);
  assert.equal(suggestAmounts(categories, two, "2026-09", ["gas"]).length, 0);
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
      projectedLeft: 1100,
      sentence: "Spent so far.",
    },
    incomeSoFar: 2000,
    incomeStill: 500,
  });
  assert.equal(shown.ready, true);
  assert.equal(shown.daysLeft, 27);
  assert.equal(shown.projectedLeft, 1600);
});

test("carried overspending is labelled apart from this month", () => {
  const story = categoryStory({
    id: "rent",
    name: "Rent",
    planned: 1350,
    spent: 1350,
    carryIn: -3050,
    carryOut: -3050,
    left: -3050,
    carries: true,
    charges: 1,
    provisional: 0,
  });
  assert.equal(story.thisMonth, "on plan");
  assert.equal(story.fromEarlier, -3050);
  assert.doesNotMatch(story.headline, /\$3,050 over/);
  assert.match(story.detail, /From earlier/);
});

test("leftovers stay quiet when the month is short and skip savings and debt", () => {
  const pay: Category = { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 2000 };
  const food: Category = { id: "food", slug: "food", name: "Food", kind: "expense", plannedMonthly: 100, carry: true };
  const save: Category = { id: "save", slug: "savings", name: "Savings transfers", kind: "expense", plannedMonthly: 50, carry: true };
  const loan: Category = { id: "loan", slug: "debt", name: "Student loan", kind: "expense", plannedMonthly: 40, carry: true };
  const rent: Category = { id: "rent", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 800, carry: false };
  const tx = (id: string, date: string, amount: number, categoryId: string): Transaction => ({
    id,
    date,
    amount,
    description: id,
    merchantKey: id,
    sourceLabel: "Bank",
    fingerprint: id,
    categoryId,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
  });
  const short = surplusSuggestions(
    {
      transactions: [tx("in", "2026-03-01", 100, "pay"), tx("rent", "2026-03-02", -800, "rent")],
      categories: [pay, food, save, loan, rent],
      style: "buckets",
      carryStartMonth: "2026-01",
    },
    "2026-03",
  );
  assert.deepEqual(short, []);
  const open = surplusSuggestions(
    {
      transactions: [tx("in", "2026-03-01", 3000, "pay")],
      categories: [pay, food, save, loan],
      style: "buckets",
      carryStartMonth: "2026-03",
    },
    "2026-03",
  );
  assert.deepEqual(
    open.map((row) => row.categoryId),
    ["food"],
  );
  const foodLine = monthLedger(
    { transactions: [tx("in", "2026-03-01", 3000, "pay")], categories: [pay, food], style: "buckets", carryStartMonth: "2026-03" },
    "2026-03",
  ).spending.find((row) => row.id === "food");
  assert.equal(open[0]?.amount, foodLine?.left);
});

test("still coming lists only the rest of this month", () => {
  const bill = (partial: Partial<RecurringBill> & Pick<RecurringBill, "merchantKey" | "nextDate" | "status">): RecurringBill => ({
    description: partial.merchantKey,
    categoryId: null,
    categoryName: null,
    usual: 20,
    interval: "monthly",
    lastDate: "2026-09-01",
    yearly: 9999,
    kind: "fixed",
    priceChange: null,
    ...partial,
  });
  const bills = [
    bill({ merchantKey: "PAST", nextDate: "2026-10-01", status: "late" }),
    bill({ merchantKey: "STOP", nextDate: "2026-10-20", status: "stopped" }),
    bill({ merchantKey: "SOON", nextDate: "2026-10-20", status: "active" }),
    bill({ merchantKey: "NEXT", nextDate: "2026-11-02", status: "active" }),
    bill({ merchantKey: "PAID", nextDate: "2026-10-18", status: "active" }),
  ];
  const paid: Transaction = {
    id: "p",
    date: "2026-10-04",
    amount: -20,
    description: "PAID",
    merchantKey: "PAID",
    sourceLabel: "Bank",
    fingerprint: "p",
    categoryId: null,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
  };
  const items = stillComingThisMonth(bills, "2026-10-15", [paid]);
  assert.deepEqual(items?.map((item) => item.merchantKey), ["SOON"]);
  const six = Array.from({ length: 6 }, (_, index) => bill({ merchantKey: `B${index}`, nextDate: "2026-10-20", status: "active", usual: 20 }));
  const listed = stillComingThisMonth(six, "2026-10-15");
  assert.equal(yearlyComingLine(listed ?? []), "About $1,440.00 a year");
});
