import assert from "node:assert/strict";
import { test } from "node:test";
import { fileReadout, incomeRows, spendingRows } from "./readout.ts";
import type { Category, Transaction } from "./types.ts";

const paycheck: Category = { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 3000 };
const groceries: Category = { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 100 };
const rent: Category = { id: "rent", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 1500 };
const categories = [paycheck, groceries, rent];

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction {
  return {
    description: partial.description ?? "Charge",
    merchantKey: partial.merchantKey ?? "STORE",
    sourceLabel: "Bank",
    fingerprint: partial.id,
    categoryId: partial.categoryId ?? null,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...partial,
  };
}

test("income is compared with usual and is not carried over", () => {
  const rows = incomeRows({
    transactions: [tx({ id: "p", date: "2026-03-01", amount: 2800, categoryId: "pay", merchantKey: "ACME", description: "ACME PAYROLL" })],
    categories,
    ym: "2026-03",
  });
  const pay = rows.find((row) => row.id === "pay");
  assert.ok(pay);
  assert.equal(pay.primary, "$200.00 less than usual");
  assert.match(pay.detail, /not carried over/i);
  assert.doesNotMatch(pay.detail, /left|rollover|fund/i);
});

test("past deposits become the usual amount when no plan is set", () => {
  const open: Category = { ...paycheck, plannedMonthly: 0 };
  const rows = incomeRows({
    transactions: [
      tx({ id: "a", date: "2026-01-01", amount: 2000, categoryId: "pay" }),
      tx({ id: "b", date: "2026-02-01", amount: 2200, categoryId: "pay" }),
      tx({ id: "c", date: "2026-03-01", amount: 2600, categoryId: "pay" }),
    ],
    categories: [open, groceries],
    ym: "2026-03",
  });
  const pay = rows.find((row) => row.id === "pay");
  assert.equal(pay?.mark, 2100);
  assert.match(pay?.primary ?? "", /more than usual/);
});

test("spending categories reset or roll over, and a fund is not required", () => {
  const transactions = [tx({ id: "g", date: "2026-03-04", amount: -140, categoryId: "food", description: "Kroger" })];
  const fresh = spendingRows({ transactions, categories, ym: "2026-03", style: "monthly" });
  const food = fresh.find((row) => row.id === "food");
  const housing = fresh.find((row) => row.id === "rent");
  assert.equal(food?.primary, "$40.00 over");
  assert.match(food?.detail ?? "", /starts over/);
  assert.ok(housing, "every spending category stays on the budget");

  const carry = spendingRows({
    transactions: [tx({ id: "g2", date: "2026-03-04", amount: -40, categoryId: "food" })],
    categories,
    ym: "2026-03",
    style: "buckets",
    carryStartMonth: "2026-03",
  });
  assert.equal(carry.find((row) => row.id === "food")?.primary, "$60.00 left");
});

test("a file yields a typical month, the biggest category, and a repeat", () => {
  const transactions = [
    tx({ id: "p1", date: "2026-01-02", amount: 2000, categoryId: "pay", merchantKey: "ACME PAYROLL", description: "ACME PAYROLL" }),
    tx({ id: "p2", date: "2026-02-02", amount: 2000, categoryId: "pay", merchantKey: "ACME PAYROLL", description: "ACME PAYROLL" }),
    tx({ id: "p3", date: "2026-03-02", amount: 2000, categoryId: "pay", merchantKey: "ACME PAYROLL", description: "ACME PAYROLL" }),
    tx({ id: "g1", date: "2026-01-03", amount: -400, categoryId: "food", merchantKey: "KROGER", description: "KROGER" }),
    tx({ id: "g2", date: "2026-01-22", amount: -420, categoryId: "food", merchantKey: "KROGER", description: "KROGER" }),
    tx({ id: "g3", date: "2026-03-18", amount: -80, categoryId: "food", merchantKey: "KROGER", description: "KROGER" }),
    tx({ id: "n1", date: "2026-01-05", amount: -15.99, categoryId: "rent", merchantKey: "NETFLIX", description: "NETFLIX" }),
    tx({ id: "n2", date: "2026-02-05", amount: -15.99, categoryId: "rent", merchantKey: "NETFLIX", description: "NETFLIX" }),
    tx({ id: "n3", date: "2026-03-05", amount: -15.99, categoryId: "rent", merchantKey: "NETFLIX", description: "NETFLIX" }),
    tx({ id: "u", date: "2026-03-09", amount: -12, categoryId: null, merchantKey: "MYSTERY", description: "MYSTERY" }),
  ];
  const empty = fileReadout([], categories);
  assert.equal(empty.headline, "Nothing to read yet.");
  assert.equal(empty.lines.length, 0);

  const read = fileReadout(transactions, categories);
  assert.equal(read.monthCount, 3);
  assert.match(read.headline, /typical month/i);
  assert.match(read.headline, /Groceries/);
  assert.ok(read.lines.some((line) => /Netflix/i.test(line) && /every month/i.test(line)));
  assert.ok(read.lines.some((line) => /no category/i.test(line)));
  assert.ok(read.moneyOut > 0);
});
