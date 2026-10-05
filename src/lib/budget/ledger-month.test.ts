import assert from "node:assert/strict";
import { test } from "node:test";
import { monthLedger, safeFromLedger, yearLedger } from "./ledger-month.ts";
import type { Category, MoneyBucket, Transaction } from "./types.ts";

const pay: Category = { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 2000 };
const food: Category = { id: "food", slug: "food", name: "Food", kind: "expense", plannedMonthly: 100 };
const gas: Category = { id: "gas", slug: "gas", name: "Gas", kind: "expense", plannedMonthly: 40 };
const rent: Category = { id: "rent", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 1100 };
const categories = [pay, food, gas, rent];

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction {
  return {
    description: partial.description ?? "Charge",
    merchantKey: partial.merchantKey ?? "X",
    sourceLabel: "Bank",
    fingerprint: partial.id,
    categoryId: partial.categoryId === undefined ? "food" : partial.categoryId,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...partial,
  };
}

function finite(ledger: ReturnType<typeof monthLedger>) {
  const nums = [
    ledger.totals.received,
    ledger.totals.spent,
    ledger.totals.savedToFunds,
    ledger.totals.leftOver,
    ledger.totals.plannedTotal,
    ledger.totals.unassigned,
    ...ledger.spending.flatMap((line) => [line.planned, line.spent, line.carryIn, line.carryOut, line.left]),
    ...ledger.income.flatMap((line) => [line.received, line.expected, line.variance]),
  ];
  for (const n of nums) assert.equal(Number.isFinite(n), true);
}

test("left over is received minus spent minus saved, in both styles", () => {
  const transactions = [
    tx({ id: "in", date: "2026-07-01", amount: 1000, categoryId: "pay" }),
    tx({ id: "g", date: "2026-07-02", amount: -40, categoryId: "food" }),
    tx({ id: "r", date: "2026-07-03", amount: -100, categoryId: "rent" }),
  ];
  const bucket: MoneyBucket = {
    id: "g",
    name: "Groceries",
    monthly: 100,
    yearly: null,
    categoryIds: ["food"],
    target: null,
    by: null,
    startMonth: "2026-06",
    opening: 0,
  };
  const moves = [{ id: "m", ym: "2026-07", amount: 10, fromId: null, toId: "g" }];
  for (const style of ["monthly", "buckets"] as const) {
    const ledger = monthLedger(
      { transactions, categories, buckets: [bucket], moves, style, carryStartMonth: "2026-01" },
      "2026-07",
    );
    assert.equal(ledger.totals.savedToFunds, 110);
    assert.equal(ledger.totals.leftOver, ledger.totals.received - ledger.totals.spent - ledger.totals.savedToFunds);
    assert.equal(ledger.fundMoves, 0);
  }
});

test("a carrying category’s left is its carry-out, and switching one category does not move the cash", () => {
  const transactions = [
    tx({ id: "f1", date: "2026-02-02", amount: -20, categoryId: "food" }),
    tx({ id: "f2", date: "2026-03-02", amount: -40, categoryId: "food" }),
    tx({ id: "g", date: "2026-03-03", amount: -10, categoryId: "gas" }),
  ];
  const mixed = categories.map((category) => (category.id === "food" ? { ...category, carry: true as const } : category));
  const freshFood = categories.map((category) => (category.id === "food" ? { ...category, carry: false as const } : category));
  const carried = monthLedger({ transactions, categories: mixed, style: "monthly", carryStartMonth: "2026-02" }, "2026-03");
  const fresh = monthLedger({ transactions, categories: freshFood, style: "monthly", carryStartMonth: "2026-02" }, "2026-03");
  const foodLine = carried.spending.find((line) => line.id === "food");
  assert.ok(foodLine);
  assert.equal(foodLine.carries, true);
  assert.equal(foodLine.left, foodLine.carryOut);
  assert.equal(foodLine.carryIn, 80);
  assert.equal(foodLine.left, 140);
  const flipped = fresh.spending.find((line) => line.id === "food");
  assert.equal(flipped?.carries, false);
  assert.equal(flipped?.left, 60);
  assert.notEqual(flipped?.left, foodLine.left);
  assert.equal(carried.totals.received, fresh.totals.received);
  assert.equal(carried.totals.spent, fresh.totals.spent);
  assert.equal(carried.totals.savedToFunds, fresh.totals.savedToFunds);
  assert.equal(carried.totals.leftOver, fresh.totals.leftOver);
  assert.equal(carried.spending.find((line) => line.id === "gas")?.left, fresh.spending.find((line) => line.id === "gas")?.left);
});

test("refunds, splits, transfers, hidden deposits, provisional charges, and an empty month stay finite", () => {
  const empty = monthLedger({ transactions: [], categories, style: "monthly" }, "2026-04");
  finite(empty);
  assert.equal(empty.totals.received, 0);
  assert.equal(empty.totals.spent, 0);
  assert.equal(empty.totals.leftOver, 0);

  const rows = [
    tx({ id: "pay", date: "2026-05-01", amount: 500, categoryId: "pay" }),
    tx({ id: "food", date: "2026-05-02", amount: -80, categoryId: "food" }),
    tx({ id: "back", date: "2026-05-03", amount: 10, categoryId: "food", status: "refund" }),
    tx({
      id: "split",
      date: "2026-05-04",
      amount: -30,
      categoryId: "food",
      splits: [
        { categoryId: "food", amount: 20 },
        { categoryId: "gas", amount: 10 },
      ],
    }),
    tx({ id: "move", date: "2026-05-05", amount: -200, categoryId: null, status: "transfer" }),
    tx({ id: "hide", date: "2026-05-06", amount: 75, categoryId: null, status: "transfer" }),
    tx({ id: "open", date: "2026-05-07", amount: -12, categoryId: null, auto: { source: "keyword", confidence: "likely", suggestedCategoryId: "food", provisional: true } }),
  ];
  const once = monthLedger({ transactions: rows, categories, style: "buckets", carryStartMonth: "2026-01" }, "2026-05");
  const twice = monthLedger({ transactions: rows, categories, style: "buckets", carryStartMonth: "2026-01" }, "2026-05");
  finite(once);
  assert.deepEqual(once.totals, twice.totals);
  assert.equal(once.flags.hiddenDeposits, 1);
  assert.equal(once.flags.provisional, 1);
  assert.equal(once.flags.uncategorized, 1);
  assert.equal(once.totals.received, 500);
  assert.ok(once.totals.spent > 0);
  const foodLine = once.spending.find((line) => line.id === "food");
  assert.equal(foodLine?.left, foodLine?.carryOut);
});

test("a year is the twelve months, including a year boundary", () => {
  const transactions = [
    tx({ id: "a", date: "2025-12-15", amount: 100, categoryId: "pay" }),
    tx({ id: "b", date: "2026-01-02", amount: 1000, categoryId: "pay" }),
    tx({ id: "c", date: "2026-06-02", amount: -40, categoryId: "food" }),
    tx({ id: "d", date: "2026-12-20", amount: -25, categoryId: "gas" }),
    tx({ id: "e", date: "2027-01-02", amount: 80, categoryId: "pay" }),
  ];
  const source = { transactions, categories, style: "monthly" as const, carryStartMonth: "2025-12" };
  const book = yearLedger(source, "2026");
  assert.equal(book.months.length, 12);
  const summed = book.months.reduce(
    (sum, month) => ({
      received: sum.received + month.totals.received,
      spent: sum.spent + month.totals.spent,
      saved: sum.saved + month.totals.savedToFunds,
    }),
    { received: 0, spent: 0, saved: 0 },
  );
  assert.equal(book.totals.received, Math.round(summed.received * 100) / 100);
  assert.equal(book.totals.spent, Math.round(summed.spent * 100) / 100);
  assert.equal(book.totals.savedToFunds, Math.round(summed.saved * 100) / 100);
  assert.equal(book.totals.leftOver, book.totals.received - book.totals.spent - book.totals.savedToFunds);
  assert.equal(book.months[0].totals.received, 1000);
  assert.equal(book.months[11].totals.spent, 25);
  const prior = yearLedger(source, "2025");
  assert.equal(prior.totals.received, 100);
  assert.equal(prior.months[11].totals.received, 100);
  const next = yearLedger(source, "2027");
  assert.equal(next.totals.received, 80);
  assert.equal(next.months[0].totals.received, 80);
});

test("moves between funds are reported and do not change what is left", () => {
  const transactions = [tx({ id: "in", date: "2026-08-01", amount: 400, categoryId: "pay" })];
  const bucket: MoneyBucket = {
    id: "car",
    name: "Car",
    monthly: 50,
    yearly: null,
    categoryIds: [],
    target: null,
    by: null,
    startMonth: "2026-01",
    opening: 0,
  };
  const withMove = monthLedger(
    {
      transactions,
      categories,
      buckets: [bucket],
      moves: [{ id: "m", ym: "2026-08", amount: 20, fromId: "car", toId: "other" }],
      style: "monthly",
    },
    "2026-08",
  );
  const plain = monthLedger({ transactions, categories, buckets: [bucket], style: "monthly" }, "2026-08");
  assert.equal(withMove.fundMoves, 20);
  assert.equal(withMove.totals.savedToFunds, plain.totals.savedToFunds);
  assert.equal(withMove.totals.leftOver, plain.totals.leftOver);
});

test("safe to spend is derived from the month ledger", () => {
  const transactions = [
    tx({ id: "in", date: "2026-07-01", amount: 1000, categoryId: "pay" }),
    tx({ id: "g", date: "2026-07-02", amount: -40, categoryId: "food" }),
    tx({ id: "r", date: "2026-07-03", amount: -100, categoryId: "rent" }),
  ];
  const bucket: MoneyBucket = {
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
  const safe = safeFromLedger(
    {
      transactions,
      categories: [pay, rent, food],
      buckets: [bucket],
      moves: [{ id: "m", ym: "2026-07", amount: 10, fromId: null, toId: "g" }],
      style: "monthly",
    },
    "2026-07",
  );
  assert.equal(safe.amount, 1000 - 1100 - 100 - 10);
});
