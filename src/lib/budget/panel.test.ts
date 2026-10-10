import assert from "node:assert/strict";
import { test } from "node:test";
import { accountGrowth, defaultImportAccount, groupAccounts, quickCash, quickInvestment, shownBalance } from "./accounts.ts";
import { monthLedger } from "./ledger-month.ts";
import { categoryStory, surplusSuggestions } from "./screen-plan.ts";
import type { Account, BalancePoint, Category, MoneyBucket, SetAside, Transaction } from "./types.ts";
import type { SpendingLine as Line } from "./ledger-month.ts";

const pay: Category = { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 2000 };
const food: Category = { id: "food", slug: "food", name: "Food", kind: "expense", plannedMonthly: 100, carry: true };
const gas: Category = { id: "gas", slug: "gas", name: "Gas", kind: "expense", plannedMonthly: 40, carry: true };
const rent: Category = { id: "rent", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 400, carry: false };

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount" | "categoryId">): Transaction {
  return {
    description: "Charge",
    merchantKey: "X",
    sourceLabel: "Bank",
    fingerprint: partial.id,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...partial,
  };
}

function words(sentence: string) {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

function line(partial: Partial<Line>): Line {
  return {
    id: "food",
    name: "Food",
    planned: 400,
    spent: 0,
    carryIn: 0,
    carryOut: 0,
    left: 0,
    carries: true,
    charges: 0,
    provisional: 0,
    ...partial,
  };
}

test("category stories stay short for over, under, even, fresh, and carry", () => {
  const over = categoryStory(line({ left: -40, carryOut: -40, spent: 440, planned: 400 }));
  assert.equal(over.tone, "over");
  assert.match(over.headline, /over/);
  assert.match(over.nextMonth, /lower/);
  const under = categoryStory(line({ left: 60, carryOut: 60, spent: 340, planned: 400 }));
  assert.equal(under.tone, "under");
  assert.match(under.headline, /left/);
  assert.match(under.detail, /carries into next month/);
  const even = categoryStory(line({ left: 0, carryOut: 0, spent: 400, planned: 400 }));
  assert.equal(even.tone, "even");
  assert.match(even.headline, /Even/);
  const fresh = categoryStory(line({ carries: false, planned: 400, left: 400 }));
  assert.equal(fresh.tone, "fresh");
  assert.match(fresh.detail, /Starts again/);
  assert.match(fresh.nextMonth, /400/);
  for (const story of [over, under, even, fresh]) {
    assert.ok(words(story.headline) <= 16, story.headline);
    assert.ok(words(story.detail) <= 16, story.detail);
    assert.ok(words(story.nextMonth) <= 16, story.nextMonth);
    assert.ok(story.icon);
  }
});

test("a set-aside lowers carry-out, and only a fund counts as saved", () => {
  const transactions = [
    tx({ id: "in", date: "2026-03-01", amount: 1000, categoryId: "pay" }),
    tx({ id: "f", date: "2026-03-02", amount: -40, categoryId: "food" }),
  ];
  const bucket: MoneyBucket = {
    id: "trip",
    name: "Trip",
    monthly: 0,
    yearly: null,
    categoryIds: [],
    target: null,
    by: null,
    startMonth: "2026-01",
    opening: 0,
  };
  const base = {
    transactions,
    categories: [pay, food, gas, rent],
    buckets: [bucket],
    style: "buckets" as const,
    carryStartMonth: "2026-03",
  };
  const plain = monthLedger(base, "2026-03");
  const foodPlain = plain.spending.find((row) => row.id === "food");
  assert.ok(foodPlain);
  const saved: SetAside = { id: "a1", ym: "2026-03", categoryId: "food", fundId: "trip", amount: 30 };
  const released: SetAside = { id: "a2", ym: "2026-03", categoryId: "gas", fundId: null, amount: 10 };
  const withAside = monthLedger({ ...base, setAsides: [saved] }, "2026-03");
  const foodAside = withAside.spending.find((row) => row.id === "food");
  assert.ok(foodAside);
  assert.equal(foodAside.left, foodAside.carryOut);
  assert.equal(foodAside.carryOut, foodPlain.carryOut - 30);
  assert.equal(withAside.totals.savedToFunds, plain.totals.savedToFunds + 30);
  assert.equal(withAside.totals.leftOver, withAside.totals.received - withAside.totals.spent - withAside.totals.savedToFunds);
  assert.equal(withAside.funds.find((row) => row.id === "trip")?.setAsides, 30);
  const letGo = monthLedger({ ...base, setAsides: [released] }, "2026-03");
  const gasLine = letGo.spending.find((row) => row.id === "gas");
  assert.equal(gasLine?.left, gasLine?.carryOut);
  assert.equal(letGo.totals.savedToFunds, plain.totals.savedToFunds);
  assert.equal(letGo.released, 10);
  assert.ok((gasLine?.carryOut ?? 0) < (plain.spending.find((row) => row.id === "gas")?.carryOut ?? 0));
});

test("surplus suggestions rank leftovers and shrink after a set-aside", () => {
  const transactions = [tx({ id: "in", date: "2026-01-01", amount: 3000, categoryId: "pay" })];
  const source = {
    transactions,
    categories: [pay, food, gas],
    style: "buckets" as const,
    carryStartMonth: "2026-01",
  };
  const ranked = surplusSuggestions(source, "2026-03");
  assert.deepEqual(
    ranked.map((row) => row.categoryId),
    ["food", "gas"],
  );
  assert.ok(ranked[0].amount > ranked[1].amount);
  assert.match(ranked[0].fundLabel, /Add/);
  assert.match(ranked[0].growLabel, /Grow/);
  const after = surplusSuggestions(
    { ...source, setAsides: [{ id: "s", ym: "2026-03", categoryId: "food", fundId: "trip", amount: ranked[0].amount }] },
    "2026-03",
  );
  assert.ok(!after.some((row) => row.categoryId === "food" && row.amount >= ranked[0].amount));
});

function point(accountId: string, date: string, amount: number): BalancePoint {
  return { id: `${accountId}-${date}`, accountId, date, amount, source: "entered" };
}

function invest(partial: Partial<Account> = {}): Account {
  return {
    id: "roth",
    name: "Roth IRA",
    kind: "retirement",
    createdAt: "2020-01-01T00:00:00.000Z",
    growth: { band: "typical", monthlyAdd: 100, yearlyFeePercent: 0 },
    ...partial,
  };
}

test("the import picker never starts on a demo account", () => {
  assert.equal(defaultImportAccount([{ id: "acct_demo_bank", name: "Demo bank file" }], "acct_demo_bank"), "");
  assert.equal(
    defaultImportAccount(
      [
        { id: "acct_demo_bank", name: "Demo bank file" },
        { id: "chk", name: "Checking" },
      ],
      "acct_demo_bank",
    ),
    "chk",
  );
});

test("account growth stays finite, ordered, and behind a typed balance", () => {
  const today = "2026-03-03";
  const zero = accountGrowth(invest({ growth: { band: "typical", monthlyAdd: 0 } }), [point("roth", today, 0)], today);
  assert.equal(zero.estimateNow, 0);
  assert.equal(zero.path?.[0].likely, 0);
  const negative = accountGrowth(
    invest({ growth: { returnPercent: -5, monthlyAdd: -20 } }),
    [point("roth", "2025-03-03", -500)],
    today,
  );
  assert.equal(negative.lastTyped, -500);
  assert.equal(negative.ready, true);
  assert.ok(negative.estimateNow != null && Number.isFinite(negative.estimateNow));
  assert.ok((negative.estimateNow ?? 0) >= 0);
  const large = accountGrowth(
    invest({ growth: { band: "bold", monthlyAdd: 1_000_000 } }),
    [point("roth", "2024-03-03", 100_000_000)],
    today,
  );
  assert.ok(large.path);
  for (const row of large.path) {
    assert.ok(Number.isFinite(row.high));
    assert.ok(row.low <= row.likely && row.likely <= row.high);
  }
  const typed = invest({ growth: { band: "typical", monthlyAdd: 200, useEstimates: false } });
  const balances = [point("roth", "2025-03-03", 12_000)];
  assert.equal(shownBalance(typed, balances, today), 12_000);
  const estimate = accountGrowth(typed, balances, today);
  assert.ok((estimate.estimateNow ?? 0) > 12_000);
  const using = shownBalance({ ...typed, growth: { ...typed.growth, useEstimates: true } }, balances, today);
  assert.equal(using, estimate.estimateNow);
  const fee = accountGrowth(invest({ growth: { band: "typical", monthlyAdd: 100, yearlyFeePercent: 1 } }), balances, today);
  const free = accountGrowth(invest({ growth: { band: "typical", monthlyAdd: 100, yearlyFeePercent: 0 } }), balances, today);
  assert.ok((fee.path?.find((row) => row.years === 30)?.likely ?? 0) < (free.path?.find((row) => row.years === 30)?.likely ?? 0));
  const missing = accountGrowth(invest({ growth: null }), balances, today);
  assert.equal(missing.ready, false);
  assert.equal(missing.path, null);
});

test("cash and investment quick add, and home groups stay in order", () => {
  const cash = quickCash([], [], 40, "2026-04-01");
  assert.ok(cash);
  assert.equal(cash.accounts[0].kind, "cash");
  assert.equal(cash.balances[0].amount, 40);
  const again = quickCash(cash.accounts, cash.balances, 10, "2026-04-02");
  assert.equal(again?.accounts.length, 1);
  assert.equal(again?.balances.length, 2);
  const roth = quickInvestment([], [], { pick: "roth", amount: 1000, name: "My Roth" }, "2026-04-01");
  assert.equal(roth?.accounts[0].kind, "retirement");
  assert.equal(roth?.accounts[0].name, "My Roth");
  assert.equal(quickInvestment([], [], { pick: "brokerage", amount: 5 }, "nope"), null);
  const groups = groupAccounts([
    { id: "c", kind: "credit" as const, amount: -20 },
    { id: "s", kind: "savings" as const, amount: 50 },
    { id: "i", kind: "investment" as const, amount: 80 },
    { id: "k", kind: "checking" as const, amount: 10 },
    { id: "h", kind: "cash" as const, amount: 30 },
    { id: "r", kind: "retirement" as const, amount: 5 },
  ]);
  assert.deepEqual(
    groups.map((group) => group.id),
    ["bank", "savings", "investing", "owed"],
  );
  assert.deepEqual(
    groups[0].rows.map((row) => row.id),
    ["h", "k"],
  );
  assert.deepEqual(
    groups[2].rows.map((row) => row.id),
    ["i", "r"],
  );
});
