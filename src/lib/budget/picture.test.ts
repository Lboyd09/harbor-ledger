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

test("a calculator card does not change net worth", () => {
  const few: Account[] = [
    { id: "chk", name: "Checking", kind: "checking", createdAt: "2026-01-01" },
    { id: "card", name: "Visa", kind: "credit", createdAt: "2026-01-01" },
  ];
  const points: BalancePoint[] = [
    { id: "b1", accountId: "chk", amount: 5000, date: "2026-10-01", source: "entered" },
    { id: "b2", accountId: "card", amount: -1240, date: "2026-10-01", source: "entered" },
  ];
  const base = moneyPicture({ accounts: few, balances: points, debts: [] });
  assert.equal(base.net, 3760);
  const planned: DebtItem[] = [{ id: "p", name: "Visa", balance: 1240, apr: 24.99, minimum: 35, origin: "plan" }];
  assert.equal(moneyPicture({ accounts: few, balances: points, debts: planned }).net, 3760);
  const legacy: DebtItem[] = [{ id: "old", name: "Visa", balance: 1240, apr: 24.99, minimum: 35 }];
  assert.equal(moneyPicture({ accounts: few, balances: points, debts: legacy }).net, 3760);
  const money: DebtItem[] = [{ id: "loan", name: "Student", balance: 5000, apr: 5.5, minimum: 100, origin: "money" }];
  assert.equal(moneyPicture({ accounts: few, balances: points, debts: money }).net, -1240);
});

test("loan accounts and money loans share one debt total", () => {
  const rows: Account[] = [
    { id: "chk", name: "Checking", kind: "checking", createdAt: "2026-01-01" },
    { id: "sav", name: "Savings", kind: "savings", createdAt: "2026-01-01" },
    { id: "card", name: "Visa", kind: "credit", createdAt: "2026-01-01" },
    { id: "car", name: "Car loan", kind: "other", createdAt: "2026-01-01" },
    { id: "roth", name: "Roth", kind: "retirement", createdAt: "2026-01-01" },
    { id: "bro", name: "Brokerage", kind: "investment", createdAt: "2026-01-01" },
  ];
  const points: BalancePoint[] = [
    { id: "b1", accountId: "chk", amount: 5000, date: "2026-10-01", source: "entered" },
    { id: "b2", accountId: "sav", amount: 6130, date: "2026-10-01", source: "entered" },
    { id: "b3", accountId: "card", amount: -1240, date: "2026-10-01", source: "entered" },
    { id: "b4", accountId: "car", amount: -9800, date: "2026-10-01", source: "entered" },
    { id: "b5", accountId: "roth", amount: 36900, date: "2026-10-01", source: "entered" },
    { id: "b6", accountId: "bro", amount: 6950, date: "2026-10-01", source: "entered" },
  ];
  const student: DebtItem[] = [{ id: "s", name: "Student", balance: 18500, apr: 5.5, minimum: 190, origin: "money" }];
  const picture = moneyPicture({ accounts: rows, balances: points, debts: student });
  assert.equal(picture.cash, 11130);
  assert.equal(picture.debts, 29540);
  assert.equal(picture.net, 25440);
});

test("a blank bill amount does not invent months of cushion", () => {
  const picture = moneyPicture({ accounts, balances, debts: [], bills: null });
  assert.equal(picture.cushionMonths, null);
  assert.equal(picture.loans, 0);
});
