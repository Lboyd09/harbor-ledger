import assert from "node:assert/strict";
import { test } from "node:test";
import { amountDraft, monthAmountCommit, parseAmountInput, usualAmountCommit } from "./amount-input.ts";
import { monthLedger } from "./ledger-month.ts";
import { patchCategory, planAmount, withMonthPlan } from "./plans.ts";
import type { Category, MoneyBucket, MonthBudget, Transaction } from "./types.ts";

const groceries: Category = { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 400 };
const rent: Category = { id: "rent", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 1200 };

/** The demo links Groceries to a Groceries fund. That link used to turn any typed amount into 0. */
const groceryFund: MoneyBucket = {
  id: "bucket_groceries",
  name: "Groceries",
  monthly: 220,
  yearly: null,
  categoryIds: ["food"],
  target: null,
  by: null,
  startMonth: "2026-06",
  opening: 40,
};

const charge: Transaction = {
  id: "t1",
  date: "2026-09-12",
  amount: -120,
  description: "SAFEWAY",
  merchantKey: "SAFEWAY",
  sourceLabel: "Bank",
  fingerprint: "t1",
  categoryId: "food",
  userSet: true,
  notes: "",
  excluded: false,
  status: "posted",
};

/** What the Usual amount box does: keystrokes only change the draft; blur or Enter commits once. */
function typeThenCommit(categories: Category[], id: string, keystrokes: string[]): Category[] {
  const current = categories.find((c) => c.id === id)?.plannedMonthly ?? 0;
  const draft = keystrokes.at(-1) ?? "";
  const next = usualAmountCommit(draft, current);
  return next == null ? categories : patchCategory(categories, id, { plannedMonthly: next });
}

test("parseAmountInput reads typed amounts and refuses blanks and junk", () => {
  assert.equal(parseAmountInput("500"), 500);
  assert.equal(parseAmountInput(" $1,250.50 "), 1250.5);
  assert.equal(parseAmountInput("12."), 12);
  assert.equal(parseAmountInput(".5"), 0.5);
  assert.equal(parseAmountInput("0"), 0);
  assert.equal(parseAmountInput("19.999"), 20);
  assert.equal(parseAmountInput(""), null);
  assert.equal(parseAmountInput("   "), null);
  assert.equal(parseAmountInput("."), null);
  assert.equal(parseAmountInput("abc"), null);
  assert.equal(parseAmountInput("5a"), null);
  assert.equal(parseAmountInput("-20"), null);
  assert.equal(parseAmountInput("1.2.3"), null);
});

test("typing 500 over 400 in Usual amount stores 500, even when a fund is linked", () => {
  const categories = [groceries, rent];
  // Select-all then type, the way fill() and a real keyboard both do it: "" → "5" → "50" → "500".
  const after = typeThenCommit(categories, "food", ["", "5", "50", "500"]);
  assert.equal(after.find((c) => c.id === "food")?.plannedMonthly, 500);
  assert.equal(after.find((c) => c.id === "rent")?.plannedMonthly, 1200, "other categories untouched");

  const budgets: MonthBudget[] = [{ categoryId: "food", ym: "2026-08", amount: 650 }];
  const source = { transactions: [charge], categories: after, budgets, buckets: [groceryFund] };
  for (const ym of ["2026-07", "2026-09", "2026-10"]) {
    const line = monthLedger(source, ym).spending.find((row) => row.id === "food");
    assert.equal(line?.planned, 500, `${ym} uses the new usual amount`);
  }
  const august = monthLedger(source, "2026-08").spending.find((row) => row.id === "food");
  assert.equal(august?.planned, 650, "a month with its own amount keeps it");
  const september = monthLedger(source, "2026-09").spending.find((row) => row.id === "food");
  assert.equal(september?.left, 380, "Groceries is not shown as over budget");
});

test("clearing Usual amount and leaving the box does not save 0", () => {
  const categories = [groceries, rent];
  const after = typeThenCommit(categories, "food", [""]);
  assert.equal(after, categories, "nothing is written");
  assert.equal(after.find((c) => c.id === "food")?.plannedMonthly, 400);
  assert.equal(usualAmountCommit("   ", 400), null);
  assert.equal(usualAmountCommit("abc", 400), null);
  assert.equal(usualAmountCommit("400", 400), null, "same amount is not a change");
  assert.equal(usualAmountCommit("400.00", 400), null);
});

test("typing an explicit 0 still saves 0", () => {
  assert.equal(usualAmountCommit("0", 400), 0);
  const after = typeThenCommit([groceries], "food", ["0"]);
  assert.equal(after[0].plannedMonthly, 0);
});

test("This month only: blank means same as usual, junk keeps what was there", () => {
  assert.deepEqual(monthAmountCommit("", 650), { action: "clear" });
  assert.deepEqual(monthAmountCommit("", null), { action: "keep" });
  assert.deepEqual(monthAmountCommit("abc", 650), { action: "keep" });
  assert.deepEqual(monthAmountCommit("650", 650), { action: "keep" });
  assert.deepEqual(monthAmountCommit("$700", 650), { action: "set", amount: 700 });
  assert.deepEqual(monthAmountCommit("700", null), { action: "set", amount: 700 });
});

test("setting one month's amount leaves every other month alone", () => {
  const budgets: MonthBudget[] = [
    { categoryId: "food", ym: "2026-08", amount: 650 },
    { categoryId: "rent", ym: "2026-09", amount: 1300 },
  ];
  const set = withMonthPlan(budgets, "food", "2026-09", 450);
  assert.equal(planAmount(groceries, "2026-08", set), 650);
  assert.equal(planAmount(groceries, "2026-09", set), 450);
  assert.equal(planAmount(groceries, "2026-10", set), 400);
  assert.equal(planAmount(rent, "2026-09", set), 1300);
  const cleared = withMonthPlan(set, "food", "2026-09", null);
  assert.equal(planAmount(groceries, "2026-09", cleared), 400);
  assert.equal(planAmount(groceries, "2026-08", cleared), 650);
});

test("amountDraft shows saved amounts without noise", () => {
  assert.equal(amountDraft(500), "500");
  assert.equal(amountDraft(12.5), "12.5");
  assert.equal(amountDraft(0), "");
  assert.equal(amountDraft(undefined), "");
});
