import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBackup } from "./backup.ts";
import { accountRows, monthGlance, spanOverview, weeklySafe, yearOverview } from "./dashboard.ts";
import { normalizeProfile, normalizeSnapshot } from "./normalize.ts";
import { yearCash } from "./totals.ts";
import type { Account, BalancePoint, Category, Transaction } from "./types.ts";

const food: Category = { id: "food", slug: "food", name: "Food", kind: "expense", plannedMonthly: 100 };
const gas: Category = { id: "gas", slug: "gas", name: "Gas", kind: "expense", plannedMonthly: 40 };
const pay: Category = { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 2000 };

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction {
  return {
    description: "Charge",
    merchantKey: "X",
    sourceLabel: "Chase",
    fingerprint: partial.id,
    categoryId: partial.categoryId === undefined ? "food" : partial.categoryId,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...partial,
  };
}

test("yearOverview matches yearCash, including a partial span at month 12", () => {
  const rows = [
    tx({ id: "1", date: "2026-01-02", amount: 1000, categoryId: "pay" }),
    tx({ id: "2", date: "2026-01-03", amount: -40, categoryId: "food" }),
    tx({ id: "3", date: "2026-06-01", amount: -25, categoryId: null, status: "transfer" }),
    tx({ id: "4", date: "2026-06-02", amount: 10, categoryId: "food", status: "refund" }),
    tx({ id: "5", date: "2025-12-01", amount: -80, categoryId: "gas" }),
  ];
  const categories = [food, gas, pay];
  const overview = yearOverview(rows, categories, "2026");
  const cash = yearCash(rows, "2026-01", categories);
  assert.equal(overview.moneyIn, cash.income);
  assert.equal(overview.moneyOut, cash.expenses);
  assert.equal(overview.left, cash.net);
  assert.equal(overview.savingsRate, cash.income > 0 ? cash.net / cash.income : 0);
  const full = spanOverview(rows, categories, "2026", 12);
  assert.equal(full.moneyIn, overview.moneyIn);
  assert.equal(full.moneyOut, overview.moneyOut);
  assert.equal(full.left, overview.left);
});

test("accountRows uses the latest point, marks stale balances, and keeps credit as owed", () => {
  const accounts: Account[] = [
    { id: "chk", name: "Everyday", kind: "checking", createdAt: "2026-01-01" },
    { id: "card", name: "Card", kind: "credit", createdAt: "2026-01-01" },
  ];
  const balances: BalancePoint[] = [
    { id: "a", accountId: "chk", date: "2026-08-01", amount: 100, source: "file" },
    { id: "b", accountId: "chk", date: "2026-09-28", amount: 250, source: "entered" },
    { id: "c", accountId: "card", date: "2026-08-20", amount: -80, source: "file" },
  ];
  const rows = accountRows(accounts, balances, "2026-10-03");
  const checking = rows.rows.find((row) => row.id === "chk");
  const card = rows.rows.find((row) => row.id === "card");
  assert.equal(checking?.amount, 250);
  assert.equal(checking?.source, "typed in");
  assert.equal(checking?.stale, false);
  assert.equal(card?.amount, -80);
  assert.equal(card?.owed, true);
  assert.equal(card?.source, "from a file");
  assert.equal(card?.stale, true);
  assert.ok((card?.ageDays ?? 0) > 35);
  assert.equal(rows.net, 170);
  const loan = accountRows(
    [{ id: "car", name: "Car", kind: "car_loan", createdAt: "2026-01-01" }],
    [{ id: "d", accountId: "car", date: "2026-09-01", amount: -9800, source: "entered" }],
    "2026-10-03",
  );
  assert.equal(loan.rows[0]?.owed, true);
  assert.equal(loan.net, -9800);
});

test("monthGlance counts over and on track, and carry-over over, even, and extra", () => {
  const categories = [food, gas, pay];
  const monthly = monthGlance({
    style: "monthly",
    ym: "2026-03",
    transactions: [
      tx({ id: "p", date: "2026-03-01", amount: 500, categoryId: "pay" }),
      tx({ id: "f", date: "2026-03-02", amount: -150, categoryId: "food" }),
      tx({ id: "g", date: "2026-03-03", amount: -10, categoryId: "gas" }),
    ],
    categories,
    safeToSpend: 40,
  });
  assert.equal(monthly.over, 1);
  assert.equal(monthly.onTrack, 1);
  assert.match(monthly.sentence, /1 over and 1 on track/);

  const carry = monthGlance({
    style: "buckets",
    ym: "2026-03",
    carryStartMonth: "2026-03",
    transactions: [
      tx({ id: "f2", date: "2026-03-02", amount: -150, categoryId: "food" }),
      tx({ id: "g2", date: "2026-03-03", amount: -40, categoryId: "gas" }),
    ],
    categories: [
      food,
      gas,
      { id: "fun", slug: "fun", name: "Fun", kind: "expense", plannedMonthly: 30 },
    ],
    safeToSpend: 0,
  });
  assert.equal(carry.over, 1);
  assert.equal(carry.even, 1);
  assert.equal(carry.extra, 1);
  assert.match(carry.sentence, /1 over, 1 even, 1 with extra/);
});

test("old ledgers and backups still load when the new looks are absent", () => {
  const kept = normalizeProfile({ ledgerName: "Kept", accent: "not-a-look", monthlyIncome: 10 });
  assert.equal(kept.accent, "harbor");
  assert.equal(kept.ledgerName, "Kept");
  const meadow = normalizeProfile({ ledgerName: "Garden", accent: "meadow", monthlyIncome: 10 });
  assert.equal(meadow.accent, "tide");
  assert.equal(meadow.ledgerName, "Garden");
  const midnight = normalizeProfile({ accent: "midnight", ledgerName: "Night" });
  assert.equal(midnight.accent, "dusk");
  const brass = normalizeProfile({ accent: "brass", ledgerName: "Lamp" });
  assert.equal(brass.accent, "harbor");
  const auto = normalizeProfile({ accent: "auto", ledgerName: "Device" });
  assert.equal(auto.accent, "auto");

  const old = {
    profile: { ledgerName: "Old file", monthlyIncome: 100, completedOnboarding: true },
    categories: [pay],
    transactions: [tx({ id: "1", date: "2026-01-02", amount: 100, categoryId: "pay" })],
  };
  const snap = normalizeSnapshot(old);
  assert.ok(snap);
  assert.equal(snap?.profile.accent, "harbor");
  assert.equal(snap?.profile.ledgerName, "Old file");
  assert.equal(snap?.transactions.length, 1);
  const backup = parseBackup(old);
  assert.equal(backup.ok, true);
  if (backup.ok) {
    assert.equal(backup.data.profile.accent, "harbor");
    assert.equal(backup.data.profile.ledgerName, "Old file");
    assert.equal(backup.data.transactions[0]?.amount, 100);
  }
  const withLook = parseBackup({ ...old, profile: { ...old.profile, accent: "meadow" } });
  assert.equal(withLook.ok, true);
  if (withLook.ok) assert.equal(withLook.data.profile.accent, "tide");
});

test("weekly safe hides a shortfall and splits the rest of the month", () => {
  assert.equal(weeklySafe(-2565, 14), null);
  assert.equal(weeklySafe(0, 14), null);
  assert.equal(weeklySafe(700, 14), 350);
});
