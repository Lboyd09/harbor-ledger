import assert from "node:assert/strict";
import { test } from "node:test";
import { coverSentence, queueStats, reviewQueue } from "./review-queue.ts";
import type { Category, Transaction } from "./types.ts";

const categories: Category[] = [
  { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 0 },
  { id: "gas", slug: "gas", name: "Gas", kind: "expense", plannedMonthly: 0 },
  { id: "dining", slug: "dining", name: "Eating out", kind: "expense", plannedMonthly: 0 },
];

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "amount" | "description">): Transaction {
  return {
    date: "2026-09-02",
    merchantKey: partial.merchantKey ?? partial.description,
    sourceLabel: "Bank",
    fingerprint: partial.id,
    categoryId: null,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...partial,
  };
}

test("the queue is biggest dollars first and names a cover line", () => {
  const rows = [
    tx({ id: "a", description: "MYSTERY SHOP", amount: -10, merchantKey: "MYSTERY SHOP" }),
    tx({ id: "b", description: "MYSTERY SHOP", amount: -15, merchantKey: "MYSTERY SHOP" }),
    tx({ id: "c", description: "BIG UNKNOWN", amount: -400, merchantKey: "BIG UNKNOWN" }),
    tx({
      id: "d",
      description: "SHELL OIL",
      amount: -40,
      merchantKey: "SHELL OIL",
      categoryId: "gas",
      auto: { source: "keyword", confidence: "likely", suggestedCategoryId: "gas", provisional: true },
    }),
    tx({ id: "e", description: "KROGER", amount: -20, merchantKey: "KROGER", categoryId: "food", userSet: true }),
  ];
  const queue = reviewQueue(rows, categories);
  assert.equal(queue[0].displayName.includes("Big") || queue[0].family.includes("BIG"), true);
  assert.ok(queue[0].impact >= 400);
  assert.ok(queue.some((group) => group.ids.includes("d")));
  assert.ok(!queue.some((group) => group.ids.includes("e")));
  const stats = queueStats(queue);
  assert.equal(stats.groups, queue.length);
  assert.ok(stats.coveredShareOfFirstN >= 0.6 || stats.names === stats.groups);
  assert.match(coverSentence(stats), /cover/);
  const shell = queue.find((group) => group.ids.includes("d"));
  assert.ok(shell?.candidates.some((item) => item.categoryId === "gas"));
});
