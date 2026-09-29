import assert from "node:assert/strict";
import { test } from "node:test";
import { merchantKey } from "./merchant.ts";
import { groupMonth } from "./month-view.ts";
import type { Category, Transaction } from "./types.ts";

const cats: Category[] = [
  { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 3000 },
  { id: "rent", slug: "housing", name: "Housing", kind: "expense", plannedMonthly: 950 },
];

function tx(id: string, date: string, description: string, amount: number, categoryId: string | null, extra?: Partial<Transaction>): Transaction {
  return {
    id,
    date,
    description,
    merchantKey: merchantKey(description),
    amount,
    sourceLabel: "t",
    fingerprint: id,
    categoryId,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...extra,
  };
}

test("month groups split income and expenses and pin uncategorized", () => {
  const layout = groupMonth(
    [
      tx("1", "2026-09-05", "DIR DEP", 1840, "pay"),
      tx("2", "2026-09-01", "RENT", -950, "rent"),
      tx("3", "2026-09-04", "CAFE", -12, null),
      tx("4", "2026-09-02", "CARD PAYMENT", -200, null, { status: "transfer" }),
      tx("5", "2026-08-01", "OLD", -10, "rent"),
    ],
    cats,
    "2026-09",
  );
  assert.equal(layout.income.length, 1);
  assert.equal(layout.income[0].name, "Paycheck");
  assert.equal(layout.incomeTotal, 1840);
  assert.equal(layout.expenses[0].open, true);
  assert.equal(layout.expenses[0].name, "Needs a category");
  assert.equal(layout.expenses[1].name, "Housing");
  assert.equal(layout.expenseTotal, 962);
  assert.equal(layout.openCount, 1);
  assert.equal(layout.aside.length, 1);
  assert.equal(layout.aside[0].id, "4");
});

test("paid back rows stay on the lists but add nothing to the totals", () => {
  const layout = groupMonth(
    [
      tx("1", "2026-09-05", "DIR DEP", 1840, "pay"),
      tx("2", "2026-09-12", "TARGET", -40, "rent", { status: "reimbursement", notes: "payback:3" }),
      tx("3", "2026-09-13", "ZELLE FROM PARENT", 40, "pay", { status: "reimbursement", notes: "payback:2" }),
    ],
    cats,
    "2026-09",
  );
  assert.equal(layout.incomeTotal, 1840);
  assert.equal(layout.income[0].transactions.length, 2);
  assert.equal(layout.expenseTotal, 0);
  assert.equal(layout.expenses[0].transactions[0].id, "2");
  assert.equal(layout.aside.length, 0);
});

test("money back from a store lowers spending and is not income", () => {
  const layout = groupMonth(
    [
      tx("1", "2026-09-05", "DIR DEP", 100, "pay"),
      tx("2", "2026-09-06", "MCDONALDS", 8, "rent", { status: "refund" }),
      tx("3", "2026-09-07", "TARGET", -40, "rent"),
    ],
    cats,
    "2026-09",
  );
  assert.equal(layout.incomeTotal, 100);
  assert.equal(layout.expenses.some((g) => g.transactions.some((t) => t.id === "2")), true);
  assert.equal(layout.income.some((g) => g.transactions.some((t) => t.id === "2")), false);
  assert.equal(layout.expenseTotal, 32);
});
