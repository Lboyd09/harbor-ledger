import assert from "node:assert/strict";
import { test } from "node:test";
import { monthEndForecast } from "./analytics.ts";
import {
  categoryTrends,
  dataDepth,
  incomeStability,
  payCycle,
  recurringBills,
  runway,
  savingsRateSeries,
  typicalMonth,
  unusualCharges,
} from "./analytics-depth.ts";
import type { Account, BalancePoint, Category, Transaction } from "./types.ts";

const categories: Category[] = [
  { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 200 },
  { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 2000 },
  { id: "rent", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 1000 },
];

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction {
  return {
    description: partial.description ?? "Charge",
    merchantKey: partial.merchantKey ?? "STORE",
    sourceLabel: "Bank",
    fingerprint: partial.id,
    categoryId: partial.categoryId ?? "food",
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...partial,
  };
}

test("new readings stay quiet until the file can support them", () => {
  assert.equal(dataDepth([]), null);
  assert.equal(typicalMonth([tx({ id: "a", date: "2026-01-02", amount: -10 })], categories), null);
  assert.equal(recurringBills([tx({ id: "a", date: "2026-01-02", amount: -10 })], categories, "2026-03-01"), null);
  assert.equal(payCycle([tx({ id: "a", date: "2026-01-02", amount: 100, description: "PAYROLL" })], ), null);
  assert.equal(runway([], [], [tx({ id: "a", date: "2026-01-02", amount: -10 })], categories), null);
  assert.equal(categoryTrends([tx({ id: "a", date: "2026-01-02", amount: -10 })], categories, "2026-01"), null);
  assert.equal(unusualCharges([tx({ id: "a", date: "2026-01-02", amount: -10 })], "2026-01"), null);
  assert.equal(incomeStability([tx({ id: "a", date: "2026-01-02", amount: 100, categoryId: "pay" })], categories), null);
  assert.equal(savingsRateSeries([tx({ id: "a", date: "2026-01-02", amount: 100, categoryId: "pay" })], categories), null);
});

test("new readings return when there is enough history", () => {
  const rows: Transaction[] = [];
  for (let month = 1; month <= 6; month++) {
    const ym = `2026-0${month}`;
    rows.push(tx({ id: `p${month}`, date: `${ym}-01`, amount: 2000, description: "ACME PAYROLL", merchantKey: "ACME PAYROLL", categoryId: "pay" }));
    rows.push(tx({ id: `r${month}`, date: `${ym}-02`, amount: -1000, description: "MAPLE RENT", merchantKey: "MAPLE RENT", categoryId: "rent" }));
    rows.push(tx({ id: `g${month}`, date: `${ym}-04`, amount: -80, description: "KROGER", merchantKey: "KROGER", categoryId: "food" }));
  }
  rows.push(tx({ id: "odd", date: "2026-06-06", amount: -500, description: "KROGER BIG", merchantKey: "KROGER", categoryId: "food" }));
  const depth = dataDepth(rows);
  assert.equal(depth?.level, "strong");
  const typical = typicalMonth(rows, categories);
  assert.ok(typical && typical.moneyIn > 0 && typical.months >= 2);
  const bills = recurringBills(rows, categories, "2026-06-20");
  assert.ok(bills && bills.some((bill) => bill.merchantKey === "MAPLE RENT"));
  const cycle = payCycle(rows);
  assert.ok(cycle && cycle.days.length === 16);
  const accounts: Account[] = [{ id: "chk", name: "Checking", kind: "checking", createdAt: "2026-01-01" }];
  const balances: BalancePoint[] = [{ id: "b1", accountId: "chk", date: "2026-06-30", amount: 6000, source: "file" }];
  const cushion = runway(accounts, balances, rows, categories);
  assert.ok(cushion && cushion.months > 0 && cushion.low <= cushion.months && cushion.months <= cushion.high);
  const trends = categoryTrends(rows, categories, "2026-06");
  assert.ok(trends);
  const odd = unusualCharges(rows, "2026-06");
  assert.ok(odd?.some((item) => item.id === "odd"));
  const steady = incomeStability(rows, categories);
  assert.equal(steady?.label, "steady");
  const rates = savingsRateSeries(rows, categories);
  assert.ok(rates && rates.length >= 2);
  const forecast = monthEndForecast({ transactions: rows, categories, ym: "2026-06", today: "2026-06-10" });
  const again = monthEndForecast({ transactions: rows, categories, ym: "2026-06", today: "2026-06-10" });
  assert.equal(JSON.stringify(forecast), JSON.stringify(again));
});

test("edges: a quiet month, a stopped bill, a price increase, and one month", () => {
  const one = [tx({ id: "only", date: "2026-04-02", amount: -15, categoryId: "food" })];
  assert.equal(typicalMonth(one, categories), null);
  assert.equal(categoryTrends(one, categories, "2026-04"), null);
  const netflix = [1, 2, 3].map((month) =>
    tx({
      id: `n${month}`,
      date: `2026-0${month}-05`,
      amount: month === 3 ? -15.99 : -9.99,
      description: "NETFLIX",
      merchantKey: "NETFLIX",
      categoryId: "food",
    }),
  );
  const bills = recurringBills(netflix, categories, "2026-03-20");
  assert.ok(bills?.some((bill) => bill.priceChange && bill.priceChange > 0));
  const stopped = recurringBills(
    [1, 2, 3].map((month) =>
      tx({ id: `s${month}`, date: `2026-0${month}-01`, amount: -10, description: "SPOTIFY", merchantKey: "SPOTIFY", categoryId: "food" }),
    ),
    categories,
    "2026-08-01",
  );
  assert.ok(stopped?.some((bill) => bill.status === "stopped" || bill.status === "late"));
});
