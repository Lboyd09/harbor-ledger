import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBackup } from "./backup.ts";
import { carryIn, carryMonth, carryOut } from "./carry.ts";
import { normalizeSnapshot } from "./normalize.ts";
import {
  applyChange,
  previewChange,
  resetToDefault,
  restoreChanges,
  sideOf,
  type ChangeInput,
} from "./sorting.ts";
import type { Category, MerchantRule, Transaction } from "./types.ts";

const food: Category = { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 100 };

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction {
  return {
    description: partial.description ?? "AMAZON",
    merchantKey: partial.merchantKey ?? "AMAZON",
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

function input(partial: Partial<ChangeInput> & Pick<ChangeInput, "transactions" | "scope">): ChangeInput {
  return {
    merchantKey: "AMAZON",
    side: "out",
    categoryId: "gifts",
    merchantRules: [],
    ...partial,
  };
}

test("sideOf treats a refund as money out and a deposit as money in", () => {
  assert.equal(sideOf(tx({ id: "a", date: "2026-03-01", amount: -12 })), "out");
  assert.equal(sideOf(tx({ id: "b", date: "2026-03-01", amount: 12, status: "refund" })), "out");
  assert.equal(sideOf(tx({ id: "c", date: "2026-03-01", amount: 40 })), "in");
});

test("preview and apply cover one charge, one month, and the default, on both sides", () => {
  const rows = [
    tx({ id: "out-mar", date: "2026-03-02", amount: -10, categoryId: "food" }),
    tx({ id: "out-apr", date: "2026-04-02", amount: -11, categoryId: "food" }),
    tx({ id: "in-mar", date: "2026-03-03", amount: 20, categoryId: "pay", description: "AMAZON REFUND", merchantKey: "AMAZON" }),
    tx({ id: "in-apr", date: "2026-04-03", amount: 21, categoryId: "pay", description: "AMAZON REFUND", merchantKey: "AMAZON" }),
  ];

  const one = previewChange(input({ transactions: rows, scope: "charge", id: "out-mar", ym: "2026-03" }));
  assert.deepEqual(one, { changes: 1, keptByHand: 0, skippedDivided: 0 });
  const appliedOne = applyChange(input({ transactions: rows, scope: "charge", id: "out-mar" }));
  assert.equal(appliedOne.transactions.find((t) => t.id === "out-mar")?.categoryId, "gifts");
  assert.equal(appliedOne.transactions.find((t) => t.id === "out-mar")?.pinned, "charge");
  assert.equal(appliedOne.transactions.find((t) => t.id === "out-apr")?.categoryId, "food");
  assert.equal(appliedOne.merchantRules.length, 0);

  const month = previewChange(input({ transactions: rows, scope: "month", ym: "2026-03", side: "in", categoryId: "pay" }));
  assert.equal(month.changes, 1);
  const appliedMonth = applyChange(input({ transactions: rows, scope: "month", ym: "2026-03", side: "in", categoryId: "gifts" }));
  assert.equal(appliedMonth.transactions.find((t) => t.id === "in-mar")?.pinned, "month");
  assert.equal(appliedMonth.transactions.find((t) => t.id === "in-mar")?.categoryId, "gifts");
  assert.equal(appliedMonth.transactions.find((t) => t.id === "in-apr")?.categoryId, "pay");
  assert.equal(appliedMonth.merchantRules.length, 0);

  const rules: MerchantRule[] = [{ merchantKey: "AMAZON", categoryId: "food", side: "out" }];
  const def = applyChange(input({ transactions: rows, scope: "default", merchantRules: rules }));
  assert.equal(def.preview.changes, 2);
  assert.equal(def.merchantRules.find((r) => r.side === "out")?.categoryId, "gifts");
  assert.ok(def.transactions.filter((t) => t.amount < 0).every((t) => t.categoryId === "gifts" && t.pinned == null));
  assert.ok(def.transactions.filter((t) => t.amount > 0).every((t) => t.categoryId === "pay"));
});

test("a refund counts as money out, a divided row is skipped, and pinned rows stay unless included", () => {
  const rows = [
    tx({ id: "buy", date: "2026-03-02", amount: -10 }),
    tx({ id: "back", date: "2026-03-04", amount: 8, status: "refund" }),
    tx({
      id: "split",
      date: "2026-03-05",
      amount: -30,
      splits: [
        { categoryId: "food", amount: 10 },
        { categoryId: "gifts", amount: 20 },
      ],
    }),
    tx({ id: "hand", date: "2026-02-02", amount: -9, pinned: "charge", categoryId: "gifts", userSet: true }),
    tx({ id: "other", date: "2026-03-06", amount: 15, categoryId: "pay" }),
  ];
  const month = previewChange(input({ transactions: rows, scope: "month", ym: "2026-03" }));
  assert.deepEqual(month, { changes: 2, keptByHand: 0, skippedDivided: 1 });
  const applied = applyChange(input({ transactions: rows, scope: "month", ym: "2026-03" }));
  assert.equal(applied.transactions.find((t) => t.id === "split")?.splits?.length, 2);
  assert.equal(applied.transactions.find((t) => t.id === "split")?.categoryId, "food");
  assert.equal(applied.transactions.find((t) => t.id === "back")?.pinned, "month");
  assert.equal(applied.transactions.find((t) => t.id === "other")?.categoryId, "pay");

  const kept = previewChange(input({ transactions: rows, scope: "default" }));
  assert.equal(kept.changes, 3);
  assert.equal(kept.keptByHand, 1);
  assert.equal(kept.skippedDivided, 0);
  const left = applyChange(input({ transactions: rows, scope: "default" }));
  assert.equal(left.transactions.find((t) => t.id === "hand")?.categoryId, "gifts");
  assert.equal(left.transactions.find((t) => t.id === "hand")?.pinned, "charge");
  const forced = applyChange(input({ transactions: rows, scope: "default", includePinned: true }));
  assert.equal(forced.preview.keptByHand, 0);
  assert.equal(forced.preview.changes, 4);
  assert.equal(forced.transactions.find((t) => t.id === "hand")?.pinned, null);
  assert.equal(forced.transactions.find((t) => t.id === "hand")?.categoryId, "gifts");
});

test("restoreChanges puts back category, pinned, splits, and the import note", () => {
  const original = tx({
    id: "split",
    date: "2026-03-05",
    amount: -30,
    categoryId: "food",
    userSet: true,
    pinned: "charge",
    auto: { source: "keyword", confidence: "likely", suggestedCategoryId: "food" },
    splits: [
      { categoryId: "food", amount: 10 },
      { categoryId: "gifts", amount: 20 },
    ],
  });
  const applied = applyChange(input({ transactions: [original], scope: "charge", id: "split" }));
  const changed = applied.transactions.map((t) => ({ ...t, splits: null }));
  const restored = restoreChanges(changed, applied.before);
  const row = restored[0];
  assert.equal(row.categoryId, "food");
  assert.equal(row.userSet, true);
  assert.equal(row.pinned, "charge");
  assert.equal(row.auto?.confidence, "likely");
  assert.deepEqual(row.splits, original.splits);
});

test("resetToDefault uses the merchant rule, or clears the category when there is none", () => {
  const hand = tx({ id: "a", date: "2026-03-01", amount: -4, categoryId: "gifts", userSet: true, pinned: "month" });
  const back = resetToDefault(hand, [{ merchantKey: "AMAZON", categoryId: "food", side: "out" }]);
  assert.equal(back.categoryId, "food");
  assert.equal(back.userSet, false);
  assert.equal(back.pinned, null);
  const empty = resetToDefault(hand, []);
  assert.equal(empty.categoryId, null);
  assert.equal(empty.userSet, false);
});

test("a month change leaves other months and the rule alone, and a default leaves pinned rows alone", () => {
  const rules: MerchantRule[] = [{ merchantKey: "AMAZON", categoryId: "food", side: "out" }];
  const rows = [
    tx({ id: "mar", date: "2026-03-02", amount: -10 }),
    tx({ id: "apr", date: "2026-04-02", amount: -10 }),
    tx({ id: "pin", date: "2026-03-08", amount: -6, pinned: "charge", categoryId: "gifts", userSet: true }),
  ];
  const month = applyChange(input({ transactions: rows, scope: "month", ym: "2026-03", merchantRules: rules }));
  assert.equal(month.transactions.find((t) => t.id === "apr")?.categoryId, "food");
  assert.equal(month.transactions.find((t) => t.id === "apr")?.pinned, undefined);
  assert.deepEqual(month.merchantRules, rules);
  assert.equal(month.transactions.find((t) => t.id === "pin")?.pinned, "month");
  const def = applyChange(input({ transactions: rows, scope: "default", merchantRules: rules }));
  assert.equal(def.transactions.find((t) => t.id === "pin")?.categoryId, "gifts");
  assert.equal(def.transactions.find((t) => t.id === "pin")?.pinned, "charge");
  assert.equal(def.transactions.find((t) => t.id === "apr")?.categoryId, "gifts");
  assert.equal(def.rulesBefore?.[0]?.categoryId, "food");
});

test("a one-month amount flows into Left and into next month, and removing it restores the usual amount", () => {
  const spent = tx({ id: "gro", date: "2026-03-04", amount: -80, categoryId: "food", merchantKey: "KROGER", description: "KROGER" });
  const ctx = {
    transactions: [spent],
    categories: [food],
    carryStartMonth: "2026-03",
    budgets: [{ categoryId: "food", ym: "2026-03", amount: 50 }],
  };
  const march = carryMonth(food, "2026-03", ctx);
  assert.equal(march?.planned, 50);
  assert.equal(march?.spent, 80);
  assert.equal(carryOut(food, "2026-03", ctx), -30);
  assert.equal(carryIn(food, "2026-04", ctx), -30);
  const usual = carryMonth(food, "2026-03", { ...ctx, budgets: [] });
  assert.equal(usual?.planned, 100);
  assert.equal(carryOut(food, "2026-03", { ...ctx, budgets: [] }), 20);
  assert.equal(carryIn(food, "2026-04", { ...ctx, budgets: [] }), 20);
});

test("an old backup and an old ledger without pinned still load", () => {
  const old = {
    profile: { ledgerName: "Old", completedOnboarding: true, monthlyIncome: 10 },
    categories: [food],
    transactions: [
      {
        id: "t1",
        date: "2026-03-01",
        description: "AMAZON",
        merchantKey: "AMAZON",
        amount: -4,
        sourceLabel: "a",
        fingerprint: "f",
        categoryId: "food",
        userSet: true,
        notes: "",
      },
    ],
    merchantRules: [],
  };
  const snap = normalizeSnapshot(old);
  assert.equal(snap?.transactions[0]?.pinned, undefined);
  assert.equal(snap?.transactions[0]?.categoryId, "food");
  const backup = parseBackup(old);
  assert.equal(backup.ok, true);
  if (backup.ok) {
    assert.equal(backup.data.transactions[0]?.pinned, undefined);
    assert.equal(backup.data.transactions.length, 1);
  }
});
