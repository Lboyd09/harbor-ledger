import assert from "node:assert/strict";
import { test } from "node:test";
import { fileCounts, guessAccountKind, inferIncomeStreams, monthEndBalances } from "./file-inference.ts";
import type { ParsePreviewRow, Profile } from "./types.ts";

const profile: Pick<Profile, "incomeStreams"> = { incomeStreams: [] };

function row(date: string, description: string, amount: number, balance?: number): ParsePreviewRow {
  return {
    date,
    description,
    amount,
    balance: balance ?? null,
    raw: [],
    bankCategory: null,
    memo: null,
  };
}

test("account kind from a negative balance, a card payment, interest, and pay", () => {
  const credit = guessAccountKind(
    [
      { description: "PAYMENT THANK YOU", amount: 200 },
      { description: "SHELL", amount: -40 },
      { description: "KROGER", amount: -20 },
    ],
    -340,
  );
  assert.equal(credit.kind, "credit");
  assert.match(credit.reason, /negative|card/i);

  const card = guessAccountKind(
    [
      { description: "AUTOPAY PAYMENT", amount: 80 },
      { description: "STORE", amount: -20 },
      { description: "CAFE", amount: -12 },
    ],
    10,
  );
  assert.equal(card.kind, "credit");

  const savings = guessAccountKind(
    [
      { description: "INTEREST PAYMENT", amount: 1.2 },
      { description: "INTEREST PAID", amount: 1.1 },
    ],
    4000,
  );
  assert.equal(savings.kind, "savings");

  const checking = guessAccountKind(
    [
      { description: "ACME PAYROLL", amount: 1800 },
      { description: "CHECK 104", amount: -40 },
    ],
    900,
  );
  assert.equal(checking.kind, "checking");
});

test("income cadences and a refund that is not pay", () => {
  const weekly = ["2026-01-02", "2026-01-09", "2026-01-16", "2026-01-23"].map((date) => ({
    date,
    description: "SIDE GIG STRIPE",
    amount: 200,
    merchantKey: "SIDE GIG STRIPE",
  }));
  const biweekly = ["2026-01-02", "2026-01-16", "2026-01-30", "2026-02-13"].map((date) => ({
    date,
    description: "NORTH PAYROLL",
    amount: 1500,
    merchantKey: "NORTH PAYROLL",
  }));
  const twice = ["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-15"].map((date) => ({
    date,
    description: "CITY PAYROLL",
    amount: 900,
    merchantKey: "CITY PAYROLL",
  }));
  const monthly = ["2026-01-31", "2026-02-28", "2026-03-31"].map((date) => ({
    date,
    description: "PENSION DEPOSIT",
    amount: 700,
    merchantKey: "PENSION DEPOSIT",
  }));
  const irregular = [
    { date: "2026-01-02", description: "ODD DEPOSIT", amount: 100, merchantKey: "ODD DEPOSIT" },
    { date: "2026-01-05", description: "ODD DEPOSIT", amount: 110, merchantKey: "ODD DEPOSIT" },
    { date: "2026-04-20", description: "ODD DEPOSIT", amount: 105, merchantKey: "ODD DEPOSIT" },
  ];
  const refund = [
    { date: "2026-01-02", description: "KROGER REFUND", amount: 20, merchantKey: "KROGER REFUND", status: "refund" },
    { date: "2026-02-02", description: "KROGER REFUND", amount: 20, merchantKey: "KROGER REFUND", status: "refund" },
    { date: "2026-03-02", description: "KROGER REFUND", amount: 20, merchantKey: "KROGER REFUND", status: "refund" },
  ];
  const all = [...weekly, ...biweekly, ...twice, ...monthly, ...irregular, ...refund];
  const found = inferIncomeStreams(all, [], profile);
  const by = Object.fromEntries(found.map((item) => [item.merchantKey, item.cadence]));
  assert.equal(by["SIDE GIG STRIPE"], "weekly");
  assert.equal(by["NORTH PAYROLL"], "biweekly");
  assert.equal(by["CITY PAYROLL"], "twice-monthly");
  assert.equal(by["PENSION DEPOSIT"], "monthly");
  assert.equal(by["ODD DEPOSIT"], "irregular");
  assert.equal(by["KROGER REFUND"], undefined);
  assert.ok(found.every((item) => item.amount > 0 && item.matchHints.length > 0));
});

test("month-end balances are the same newest-first and oldest-first", () => {
  const oldest: ParsePreviewRow[] = [
    row("2026-01-15", "A", -10, 100),
    row("2026-01-31", "B", -5, 95),
    row("2026-02-28", "C", 20, 115),
  ];
  const newest: ParsePreviewRow[] = [...oldest].reverse();
  const a = monthEndBalances(oldest);
  const b = monthEndBalances(newest);
  assert.deepEqual(
    a.map((point) => [point.date, point.amount, point.source]),
    b.map((point) => [point.date, point.amount, point.source]),
  );
  assert.deepEqual(
    a.map((point) => point.date),
    ["2026-01-31", "2026-02-28"],
  );
  assert.equal(a[0].amount, 95);
  assert.equal(a[1].amount, 115);
});

test("deposit and payment counts add up to the total", () => {
  const counts = fileCounts([
    { amount: 100 },
    { amount: -20 },
    { amount: -5 },
    { amount: 0 },
  ]);
  assert.equal(counts.total, 3);
  assert.equal(counts.deposits, 1);
  assert.equal(counts.payments, 2);
});
