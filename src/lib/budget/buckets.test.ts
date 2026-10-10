import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBackup } from "./backup.ts";
import { bucketBalance, fullLineOf, fundMovesBetween, fundWindow, DEFAULT_FUND_VIEW, linkCategoryState, migrateGoals, safeToSpend, withMonthlyChange, withPaused } from "./buckets.ts";
import { suggestCategory } from "./categorize.ts";
import { normalizeSnapshot } from "./normalize.ts";
import type { Category, MoneyBucket, Transaction } from "./types.ts";

const rent: Category = { id: "rent", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 1100 };
const food: Category = { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 200 };
const pay: Category = { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 3000 };
const cats = [pay, rent, food];

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction {
  return {
    description: partial.description ?? "Row",
    merchantKey: partial.merchantKey ?? "ROW",
    sourceLabel: "t",
    fingerprint: partial.id,
    categoryId: partial.categoryId ?? null,
    userSet: partial.userSet ?? false,
    notes: "",
    excluded: false,
    status: partial.status ?? "posted",
    splits: partial.splits ?? null,
    ...partial,
  };
}

const groceries: MoneyBucket = {
  id: "g",
  name: "Groceries",
  monthly: 100,
  yearly: null,
  categoryIds: ["food"],
  target: null,
  by: null,
  startMonth: "2026-06",
  opening: 40,
};

test("bucket balance carries funding and ignores payback, refunds, and splits outside the category", () => {
  const transactions = [
    tx({ id: "1", date: "2026-06-02", amount: -30, categoryId: "food" }),
    tx({ id: "2", date: "2026-07-02", amount: -20, categoryId: "food" }),
    tx({ id: "3", date: "2026-07-03", amount: 8, categoryId: "food", status: "refund" }),
    tx({ id: "4", date: "2026-07-04", amount: -50, categoryId: "food", status: "reimbursement" }),
    tx({
      id: "5",
      date: "2026-07-05",
      amount: -40,
      categoryId: "rent",
      splits: [
        { categoryId: "food", amount: 15 },
        { categoryId: "rent", amount: 25 },
      ],
    }),
    tx({ id: "6", date: "2026-05-01", amount: -99, categoryId: "food" }),
  ];
  assert.equal(bucketBalance(groceries, "2026-05", transactions, cats, []), 40);
  assert.equal(bucketBalance(groceries, "2026-06", transactions, cats, []), 110);
  assert.equal(bucketBalance(groceries, "2026-07", transactions, cats, []), 183);
});

test("safe to spend uses monthly amounts, bucket funding, and leftover spending once", () => {
  const transactions = [
    tx({ id: "in", date: "2026-07-01", amount: 1000, categoryId: "pay" }),
    tx({ id: "g", date: "2026-07-02", amount: -40, categoryId: "food" }),
    tx({ id: "r", date: "2026-07-03", amount: -100, categoryId: "rent" }),
  ];
  const safe = safeToSpend({
    ym: "2026-07",
    transactions,
    categories: cats,
    buckets: [groceries],
    moves: [{ id: "m", ym: "2026-07", amount: 10, fromId: null, toId: "g" }],
  });
  assert.equal(safe.income, 1000);
  assert.equal(safe.funding, 100);
  assert.equal(safe.moved, 10);
  assert.equal(safe.plans, 1100);
  assert.equal(safe.spent, 0);
  assert.equal(safe.amount, 750 - 1160);
});

test("a rate change does not rewrite months already funded", () => {
  const changed = withMonthlyChange(groceries, 250, "2026-07");
  assert.equal(changed.monthly, 250);
  assert.equal(changed.pastRates?.find((r) => r.ym === "2026-06")?.monthly, 100);
  assert.equal(changed.pastRates?.find((r) => r.ym === "2026-07")?.monthly, 100);
  assert.equal(changed.monthlyFrom, "2026-08");
  const transactions = [tx({ id: "1", date: "2026-06-02", amount: -30, categoryId: "food" })];
  assert.equal(bucketBalance(changed, "2026-06", transactions, cats, []), 110);
  assert.equal(bucketBalance(changed, "2026-08", transactions, cats, []), 110 + 100 + 250);
});

test("paused months add nothing, and unpausing does not backfill them", () => {
  const paused = withPaused(groceries, true, "2026-07");
  assert.equal(paused.paused, true);
  const transactions = [tx({ id: "1", date: "2026-06-02", amount: -30, categoryId: "food" })];
  assert.equal(bucketBalance(paused, "2026-06", transactions, cats, []), 110);
  assert.equal(bucketBalance(paused, "2026-07", transactions, cats, []), 110);
  const resumed = withPaused(paused, false, "2026-09");
  assert.equal(resumed.paused, false);
  assert.equal(bucketBalance(resumed, "2026-08", transactions, cats, []), 110);
  assert.equal(bucketBalance(resumed, "2026-09", transactions, cats, []), 210);
});

test("full line is the target, or three months when there is no target", () => {
  assert.equal(fullLineOf(groceries), 300);
  assert.equal(fullLineOf({ ...groceries, target: 800 }), 800);
  assert.equal(fullLineOf({ ...groceries, target: 800, fullLine: 500 }), 500);
});

test("linking a category clears its budget", () => {
  const next = linkCategoryState({
    categories: cats,
    monthBudgets: [{ categoryId: "food", ym: "2026-07", amount: 50 }],
    buckets: [{ ...groceries, categoryIds: [] }],
    categoryId: "food",
    bucketId: "g",
  });
  assert.ok(next);
  assert.equal(next?.categories.find((c) => c.id === "food")?.plannedMonthly, 0);
  assert.equal(next?.monthBudgets.length, 0);
  assert.deepEqual(next?.buckets[0].categoryIds, ["food"]);
});

test("goals migrate once and old backups without buckets still open", () => {
  const once = migrateGoals([{ id: "car", name: "Car", target: 1000, saved: 200, by: "2027-06" }], [], "2026-10");
  const twice = migrateGoals([{ id: "car", name: "Car", target: 1000, saved: 200, by: "2027-06" }], once, "2026-10");
  assert.equal(once.length, 1);
  assert.equal(once[0].opening, 200);
  assert.equal(twice.length, 1);
  const parsed = parseBackup({
    profile: { ledgerName: "Old", completedOnboarding: true },
    categories: [pay, rent],
    transactions: [],
    savingsGoals: [{ id: "car", name: "Car", target: 1000, saved: 200, by: null }],
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.moneyBuckets.length, 1);
    assert.equal(parsed.data.moneyBuckets[0].fromGoalId, "car");
    assert.ok(parsed.data.ira.under50 > 0);
  }
  const empty = normalizeSnapshot({ categories: [pay], transactions: [], savingsGoals: [] });
  assert.ok(empty);
  assert.deepEqual(empty?.moneyBuckets, []);
});

test("a young fund window starts at the start month", () => {
  const young: MoneyBucket = { ...groceries, startMonth: "2026-09", opening: 0, monthly: 100 };
  const window = fundWindow(young, "2026-10", [], cats);
  assert.equal(window.young, true);
  assert.equal(window.label, "Since September");
  assert.deepEqual(window.months.map((row) => row.ym), ["2026-09", "2026-10"]);
  assert.equal(window.funded, 200);
  assert.equal(DEFAULT_FUND_VIEW, "year");
});

test("ahead, on budget, and over come from money put in minus money used", () => {
  const young: MoneyBucket = { ...groceries, startMonth: "2026-09", opening: 0, monthly: 100, categoryIds: ["food"] };
  const spent = [tx({ id: "a", date: "2026-09-02", amount: -40, categoryId: "food" })];
  const ahead = fundWindow(young, "2026-10", spent, cats);
  assert.equal(ahead.status, "ahead");
  assert.equal(ahead.delta, 160);
  const even = fundWindow(young, "2026-09", [tx({ id: "b", date: "2026-09-02", amount: -100, categoryId: "food" })], cats);
  assert.equal(even.status, "on");
  const over = fundWindow(young, "2026-09", [tx({ id: "c", date: "2026-09-02", amount: -140, categoryId: "food" })], cats);
  assert.equal(over.status, "over");
  assert.equal(over.delta, -40);
});

test("put in and used match the balance when the window covers the whole fund", () => {
  const young: MoneyBucket = { ...groceries, startMonth: "2026-09", opening: 40, monthly: 100, categoryIds: ["food"] };
  const txs = [tx({ id: "a", date: "2026-09-02", amount: -25, categoryId: "food" })];
  const moves = [{ id: "m", ym: "2026-10", amount: 15, fromId: null, toId: young.id }];
  const window = fundWindow(young, "2026-10", txs, cats);
  assert.equal(window.from, young.startMonth);
  const moved = fundMovesBetween(young.id, young.startMonth, "2026-10", moves);
  const covered = Math.round((young.opening + window.funded + moved - window.used) * 100) / 100;
  assert.equal(covered, bucketBalance(young, "2026-10", txs, cats, moves));
});

test("old ledgers without fund fields still load", () => {
  const legacy = normalizeSnapshot({
    profile: { ledgerName: "Old", completedOnboarding: true },
    categories: [pay],
    transactions: [],
  });
  assert.ok(legacy);
  assert.deepEqual(legacy?.moneyBuckets, []);
  assert.equal(legacy?.profile.completedOnboarding, true);
});

test("import suggestion prefers the last category the person set", () => {
  const hit = suggestCategory("CITY GROCERY", -12, cats, [], "CITY GROCERY", [
    { merchantKey: "CITY GROCERY", categoryId: "rent", userSet: true, date: "2026-08-01" },
  ]);
  assert.equal(hit.reason, "history");
  assert.equal(hit.categoryId, "rent");
});
