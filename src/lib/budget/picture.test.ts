import assert from "node:assert/strict";
import { test } from "node:test";
import { moneyPicture } from "./picture.ts";
import type { Account, BalancePoint, DebtItem } from "./types.ts";

const accounts: Account[] = [
  { id: "chk", name: "Checking", kind: "checking", createdAt: "2026-01-01" },
  { id: "sav", name: "Savings", kind: "savings", createdAt: "2026-01-01" },
  { id: "bro", name: "Brokerage", kind: "investment", createdAt: "2026-01-01" },
  { id: "roth", name: "Roth", kind: "retirement", createdAt: "2026-01-01" },
  { id: "card", name: "Visa", kind: "credit", createdAt: "2026-01-01" },
];

const balances: BalancePoint[] = [
  { id: "b1", accountId: "chk", amount: 2000, date: "2026-10-01", source: "entered" },
  { id: "b2", accountId: "sav", amount: 8000, date: "2026-10-01", source: "entered" },
  { id: "b3", accountId: "bro", amount: 6950, date: "2026-10-01", source: "entered" },
  { id: "b4", accountId: "roth", amount: 36900, date: "2026-10-01", source: "entered" },
  { id: "b5", accountId: "card", amount: -1240, date: "2026-10-01", source: "entered" },
];

const loans: DebtItem[] = [
  { id: "car", name: "Car", balance: 9800, apr: 6, minimum: 250 },
  { id: "school", name: "Student", balance: 18500, apr: 5.5, minimum: 180 },
];

test("net worth subtracts cards and every loan, and keeps brokerage apart from retirement", () => {
  const picture = moneyPicture({ accounts, balances, debts: loans, bills: 2000 });
  assert.equal(picture.cash, 10000);
  assert.equal(picture.brokerage, 6950);
  assert.equal(picture.retirement, 36900);
  assert.equal(picture.cards, 1240);
  assert.equal(picture.loans, 28300);
  // 2000+8000+6950+36900-1240-9800-18500 = 24310
  assert.equal(picture.net, 24310);
  assert.equal(picture.cushionCash, 8000);
  assert.equal(picture.cushionMonths, 4);
});

test("a blank bill amount does not invent months of cushion", () => {
  const picture = moneyPicture({ accounts, balances, debts: [], bills: null });
  assert.equal(picture.cushionMonths, null);
  assert.equal(picture.loans, 0);
});
