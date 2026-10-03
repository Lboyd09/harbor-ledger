import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBackup } from "./backup.ts";
import { carryOut, carryYear, nextMonthAllowance, surplusToPutToWork, SURPLUS_PLAN_MONTHS } from "./carry.ts";
import { expectedIncomeForMonth, expectedMonthlyOf } from "./income.ts";
import { normalizeSnapshot } from "./normalize.ts";
import { setBudgetStyleState } from "./style.ts";
import type { Category, IncomeStream, Transaction } from "./types.ts";
import { DEFAULT_PROFILE } from "./presets.ts";

const food: Category = { id: "food", slug: "food", name: "Food", kind: "expense", plannedMonthly: 100, parentId: null };
const gas: Category = { id: "gas", slug: "gas", name: "Gas", kind: "expense", plannedMonthly: 40, parentId: null };

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction {
  return {
    description: partial.description ?? "Charge",
    merchantKey: "X",
    sourceLabel: "Chase",
    fingerprint: partial.id,
    categoryId: "food",
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...partial,
  };
}

test("an old ledger and an old backup gain accounts from source labels and lose nothing", () => {
  const old = {
    profile: {
      ledgerName: "Old",
      monthlyIncome: 2000,
      incomeStreams: [{ name: "Paycheck", monthly: 2000 }],
      completedOnboarding: true,
    },
    categories: [food, { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 2000 }],
    transactions: [
      tx({ id: "1", date: "2026-03-02", amount: -12, sourceLabel: "Chase", notes: "keep me", userSet: true }),
      tx({ id: "2", date: "2026-03-04", amount: -8, sourceLabel: "Visa", categoryId: "gas" }),
    ],
    merchantRules: [{ merchantKey: "X", categoryId: "food" }],
    monthBudgets: [{ categoryId: "food", ym: "2026-03", amount: 80 }],
    savingsGoals: [{ id: "car", name: "Car", target: 900, saved: 40, by: "2027-01" }],
    imports: [
      {
        id: "imp1",
        fileName: "chase.csv",
        importedAt: "2026-03-05T00:00:00.000Z",
        added: 1,
        skippedDuplicates: 0,
        sourceLabel: "Chase",
        endingBalance: { amount: 640, asOf: "2026-03-04" },
      },
    ],
  };
  const snap = normalizeSnapshot(old);
  assert.ok(snap);
  assert.deepEqual(
    snap.accounts.map((a) => a.name).sort(),
    ["Chase", "Visa"],
  );
  assert.equal(snap.accounts.every((a) => a.kind === "checking"), true);
  const chase = snap.accounts.find((a) => a.name === "Chase");
  const visa = snap.accounts.find((a) => a.name === "Visa");
  assert.equal(snap.transactions.find((t) => t.id === "1")?.accountId, chase?.id);
  assert.equal(snap.transactions.find((t) => t.id === "2")?.accountId, visa?.id);
  assert.equal(snap.transactions.find((t) => t.id === "1")?.notes, "keep me");
  assert.equal(snap.transactions.find((t) => t.id === "1")?.amount, -12);
  assert.equal(snap.imports[0]?.accountId, chase?.id);
  assert.equal(snap.balances.find((b) => b.accountId === chase?.id)?.amount, 640);
  assert.equal(snap.categories.find((c) => c.id === "food")?.plannedMonthly, 100);
  assert.equal(snap.monthBudgets[0]?.amount, 80);
  assert.equal(snap.merchantRules[0]?.categoryId, "food");
  assert.equal(snap.savingsGoals[0]?.saved, 40);
  assert.equal(snap.moneyBuckets[0]?.fromGoalId, "car");
  assert.equal(snap.profile.ledgerName, "Old");
  assert.equal(snap.profile.monthlyIncome, 2000);
  assert.equal(snap.profile.incomeStreams[0]?.cadence, "monthly");
  assert.equal(snap.profile.incomeStreams[0]?.amount, 2000);
  assert.equal(snap.profile.incomeStreams[0]?.matchHints.length, 0);
  assert.ok(snap.profile.incomeStreams[0]?.id);

  const again = normalizeSnapshot(snap);
  assert.deepEqual(
    again?.accounts.map((a) => a.id).sort(),
    snap.accounts.map((a) => a.id).sort(),
  );

  const blank = normalizeSnapshot({
    profile: { ledgerName: "Bare", completedOnboarding: true },
    categories: [food],
    transactions: [tx({ id: "m", date: "2026-01-02", amount: -3, sourceLabel: "" })],
  });
  assert.equal(blank?.accounts.length, 1);
  assert.equal(blank?.accounts[0]?.name, "Main account");
  assert.equal(blank?.transactions[0]?.accountId, blank?.accounts[0]?.id);

  const empty = normalizeSnapshot({ profile: { ledgerName: "Empty" }, categories: [], transactions: [] });
  assert.deepEqual(empty?.accounts, []);
  assert.deepEqual(empty?.balances, []);

  const backup = parseBackup(old);
  assert.equal(backup.ok, true);
  if (backup.ok) {
    assert.equal(backup.data.version, 2);
    assert.equal(backup.data.transactions.length, 2);
    assert.equal(backup.data.transactions.find((t) => t.id === "1")?.notes, "keep me");
    assert.equal(backup.data.savingsGoals[0]?.target, 900);
    assert.ok(backup.data.accounts.some((a) => a.name === "Chase"));
    assert.equal(backup.data.profile.completedOnboarding, true);
  }
});

test("expectedMonthlyOf covers every cadence and a month budget wins for one month", () => {
  const streams: Record<IncomeStream["cadence"], IncomeStream> = {
    weekly: { id: "w", name: "Week", amount: 12, cadence: "weekly", matchHints: [] },
    biweekly: { id: "b", name: "Two weeks", amount: 6, cadence: "biweekly", matchHints: [] },
    "twice-monthly": { id: "t", name: "Twice", amount: 10, cadence: "twice-monthly", matchHints: [] },
    irregular: { id: "i", name: "Sometimes", amount: 7, cadence: "irregular", matchHints: [] },
    monthly: { id: "m", name: "Month", amount: 9, cadence: "monthly", matchHints: ["ACME"], categoryId: "pay" },
  };
  assert.equal(expectedMonthlyOf(streams.weekly), 52);
  assert.equal(expectedMonthlyOf(streams.biweekly), 13);
  assert.equal(expectedMonthlyOf(streams["twice-monthly"]), 20);
  assert.equal(expectedMonthlyOf(streams.irregular), 7);
  assert.equal(expectedMonthlyOf(streams.monthly), 9);
  const profile = { ...DEFAULT_PROFILE, incomeStreams: [streams.monthly, streams.weekly] };
  assert.equal(expectedIncomeForMonth(profile, "2026-07"), 61);
  assert.equal(
    expectedIncomeForMonth(profile, "2026-08", [{ categoryId: "pay", ym: "2026-08", amount: 40 }]),
    92,
  );
  assert.equal(expectedIncomeForMonth(profile, "2026-09", [{ categoryId: "pay", ym: "2026-08", amount: 40 }]), 61);
});

test("carry-over moves leftovers, overspending, refunds, splits, and one-month plans", () => {
  const ctx = {
    transactions: [
      tx({ id: "jan", date: "2026-01-10", amount: -40 }),
      tx({ id: "feb", date: "2026-02-10", amount: -150 }),
      tx({ id: "back", date: "2026-03-12", amount: 25, status: "refund" }),
      tx({
        id: "split",
        date: "2026-04-04",
        amount: -100,
        splits: [
          { categoryId: "food", amount: 30 },
          { categoryId: "gas", amount: 70 },
        ],
      }),
    ],
    categories: [food, gas],
    budgets: [{ categoryId: "food", ym: "2026-05", amount: 40 }],
    carryStartMonth: "2026-01",
  };
  assert.equal(carryOut(food, "2026-01", ctx), 60);
  assert.equal(carryOut(food, "2026-02", ctx), 10);
  const beforeRefund = carryOut(food, "2026-02", ctx);
  const afterRefund = carryOut(food, "2026-03", ctx);
  assert.ok(afterRefund > beforeRefund + food.plannedMonthly - 0.01);
  assert.equal(afterRefund, 135);
  const april = carryYear(food, "2026-04", ctx).find((row) => row.ym === "2026-04");
  const gasApril = carryYear(gas, "2026-04", ctx).find((row) => row.ym === "2026-04");
  assert.equal(april?.spent, 30);
  assert.equal(gasApril?.spent, 70);
  assert.equal(carryOut(food, "2026-04", ctx), 205);
  const may = carryYear(food, "2026-05", ctx).find((row) => row.ym === "2026-05");
  const june = carryYear(food, "2026-06", ctx).find((row) => row.ym === "2026-06");
  assert.equal(may?.planned, 40);
  assert.equal(june?.planned, 100);

  const mid = { ...ctx, carryStartMonth: "2026-06", transactions: [tx({ id: "early", date: "2026-01-02", amount: -400 })] };
  const year = carryYear(food, "2026-08", mid);
  assert.deepEqual(
    year.map((row) => row.ym),
    ["2026-06", "2026-07", "2026-08"],
  );
  assert.equal(year[0]?.carryIn, 0);
  assert.equal(year[0]?.spent, 0);

  const young = carryYear(food, "2026-12", { ...ctx, transactions: [], carryStartMonth: "2026-11" });
  assert.equal(young.length < 12, true);
  assert.equal(young[0]?.ym, "2026-11");
});

test("surplus is zero at two months of plan, and next month's allowance does not go below zero", () => {
  assert.equal(SURPLUS_PLAN_MONTHS, 2);
  const base = { transactions: [] as Transaction[], categories: [food], carryStartMonth: "2026-01", opening: 100 };
  assert.equal(carryOut(food, "2026-01", base), 200);
  assert.equal(surplusToPutToWork(food, "2026-01", base), 0);
  assert.equal(surplusToPutToWork(food, "2026-01", { ...base, opening: 101 }), 1);
  const broke = { ...base, opening: -250 };
  assert.equal(carryOut(food, "2026-01", broke), -150);
  assert.deepEqual(nextMonthAllowance(food, "2026-01", broke), { amount: 0, cutBack: true });
  const exact = { ...base, opening: -200 };
  assert.equal(carryOut(food, "2026-01", exact), -100);
  assert.deepEqual(nextMonthAllowance(food, "2026-01", exact), { amount: 0, cutBack: false });
});

test("setBudgetStyle round trip loses nothing", () => {
  const bucket = {
    id: "b",
    name: "Car",
    monthly: 50,
    yearly: null,
    categoryIds: [] as string[],
    target: 1000,
    by: null,
    startMonth: "2026-01",
    opening: 20,
  };
  const start = {
    profile: { ...DEFAULT_PROFILE, ledgerName: "Kept", budgetStyle: "monthly" as const, carryStartMonth: null },
    transactions: [tx({ id: "1", date: "2026-02-02", amount: -5 })],
    moneyBuckets: [bucket],
    accounts: [{ id: "acct_chase", name: "Chase", kind: "checking" as const, createdAt: "2026-01-01T00:00:00.000Z" }],
  };
  const on = setBudgetStyleState(start, "buckets", { today: "2026-04" });
  assert.equal(on.profile.budgetStyle, "buckets");
  assert.equal(on.profile.carryStartMonth, "2026-04");
  assert.equal(on.profile.ledgerName, "Kept");
  assert.equal(on.transactions, start.transactions);
  assert.equal(on.moneyBuckets, start.moneyBuckets);
  assert.equal(on.accounts, start.accounts);
  const back = setBudgetStyleState(on, "monthly");
  assert.equal(back.profile.budgetStyle, "monthly");
  assert.equal(back.profile.carryStartMonth, "2026-04");
  assert.equal(back.transactions, start.transactions);
  assert.equal(back.moneyBuckets, start.moneyBuckets);
  assert.equal(back.accounts, start.accounts);
  assert.equal(back.profile.monthlyIncome, start.profile.monthlyIncome);
  assert.deepEqual(back.profile.incomeStreams, start.profile.incomeStreams);
});
