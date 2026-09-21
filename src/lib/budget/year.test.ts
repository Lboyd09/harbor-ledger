import assert from "node:assert/strict";
import { test } from "node:test";
import { merchantKey } from "./merchant.ts";
import { buildYearWorkbook, recommendMonthly, recommendedPlans, yearInsights, yearSheetCsv } from "./year.ts";
import { groupPayees } from "./payees.ts";
import type { Category, Transaction } from "./types.ts";

const cats: Category[] = [
  { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 3000 },
  { id: "side", slug: "side-work", name: "Side work", kind: "income", plannedMonthly: 500 },
  { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 200 },
  { id: "rent", slug: "housing", name: "Housing", kind: "expense", plannedMonthly: 950 },
  { id: "save", slug: "savings", name: "Savings", kind: "expense", plannedMonthly: 100 },
];

function tx(
  id: string,
  date: string,
  description: string,
  amount: number,
  categoryId: string | null,
  extra?: Partial<Transaction>,
): Transaction {
  return {
    id,
    date,
    description,
    merchantKey: merchantKey(description),
    amount,
    sourceLabel: "t",
    fingerprint: id,
    categoryId,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...extra,
  };
}

test("recommend monthly uses median of active months", () => {
  assert.equal(recommendMonthly([100, 200, 300]), 200);
  assert.equal(recommendMonthly([12, 0, 0, 48]), 30);
  assert.equal(recommendMonthly([]), 0);
});

test("year workbook lists income sources and monthly totals", () => {
  const txs = [
    tx("1", "2026-01-05", "DIR DEP", 1840, "pay"),
    tx("2", "2026-01-19", "DIR DEP", 1840, "pay"),
    tx("3", "2026-01-12", "STUDIO PAYROLL", 620, "side"),
    tx("4", "2026-01-01", "RENT", -950, "rent"),
    tx("5", "2026-01-03", "TRADER JOE", -48, "food"),
    tx("6", "2026-02-05", "DIR DEP", 1840, "pay"),
    tx("7", "2026-02-01", "RENT", -950, "rent"),
    tx("8", "2026-02-04", "UNKNOWN CAFE", -12, null),
    tx("9", "2025-12-01", "OLD RENT", -950, "rent"),
  ];
  const book = buildYearWorkbook(txs, cats, "2026");
  assert.equal(book.year, "2026");
  assert.equal(book.months.length, 12);
  const pay = book.incomeRows.find((r) => r.id === "pay");
  assert.ok(pay);
  assert.equal(pay.yearTotal, 5520);
  assert.equal(pay.months[0], 3680);
  assert.equal(pay.months[1], 1840);
  const side = book.incomeRows.find((r) => r.id === "side");
  assert.equal(side?.yearTotal, 620);
  assert.equal(book.income, 6140);
  assert.equal(book.expenses, 1960);
  assert.equal(book.net, 4180);
  assert.ok(book.savingsRate > 0.6);
  assert.equal(book.monthSummaries[0].status, "on-track");
  assert.equal(book.uncategorized, 1);
  assert.ok(book.uncategorizedRow);
  assert.equal(book.uncategorizedRow?.months[1], 12);
});

test("month over plan is flagged", () => {
  const txs = [
    tx("1", "2026-03-01", "PAY", 100, "pay"),
    tx("2", "2026-03-02", "RENT", -2000, "rent"),
  ];
  const book = buildYearWorkbook(txs, cats, "2026");
  assert.equal(book.monthSummaries[2].status, "over");
  const rent = book.expenseRows.find((r) => r.id === "rent");
  assert.equal(rent?.status, "over");
});

test("recommended plans follow typical months", () => {
  const txs = [
    tx("1", "2026-01-01", "RENT", -950, "rent"),
    tx("2", "2026-02-01", "RENT", -950, "rent"),
    tx("3", "2026-03-01", "RENT", -1000, "rent"),
  ];
  const rec = recommendedPlans(txs, cats, "2026");
  const rent = rec.find((r) => r.id === "rent");
  assert.equal(rent?.plannedMonthly, 950);
});

test("payees most repeated first and mixed categories", () => {
  const txs = [
    tx("1", "2026-01-01", "NETFLIX.COM", -15.49, "food"),
    tx("2", "2026-02-01", "NETFLIX.COM", -15.49, "food"),
    tx("3", "2026-03-01", "NETFLIX.COM", -15.49, null),
    tx("4", "2026-01-02", "SHELL OIL", -40, null),
  ];
  const groups = groupPayees(txs);
  assert.equal(groups[0].count, 3);
  assert.equal(groups[0].unassigned, 1);
  assert.equal(groups[0].mixed, false);
  assert.ok(groups[0].categoryId);
  assert.equal(groups[1].count, 1);
  assert.equal(groups[0].likelyBill, true);
  assert.equal(groups[1].likelyBill, false);
});

test("blank plans use typical months for on-track", () => {
  const open: Category[] = cats.map((c) => ({ ...c, plannedMonthly: 0 }));
  const txs = [
    tx("1", "2026-01-01", "RENT", -950, "rent"),
    tx("2", "2026-02-01", "RENT", -950, "rent"),
    tx("3", "2026-03-01", "RENT", -2000, "rent"),
    tx("4", "2026-01-05", "PAY", 3000, "pay"),
    tx("5", "2026-02-05", "PAY", 3000, "pay"),
    tx("6", "2026-03-05", "PAY", 3000, "pay"),
  ];
  const book = buildYearWorkbook(txs, open, "2026");
  const rent = book.expenseRows.find((r) => r.id === "rent");
  assert.equal(rent?.typical, 950);
  assert.equal(rent?.usingSuggested, true);
  assert.equal(rent?.effectivePlan, 950);
  assert.equal(book.monthSummaries[2].status, "over");
  assert.equal(book.monthSummaries[0].status, "on-track");
  assert.ok(book.usingSuggestedPlan);
});

test("year sheet csv includes income and leftover", () => {
  const txs = [tx("1", "2026-01-05", "DIR DEP", 1000, "pay"), tx("2", "2026-01-01", "RENT", -400, "rent")];
  const csv = yearSheetCsv(buildYearWorkbook(txs, cats, "2026"));
  assert.ok(csv.startsWith("Category,Jan,Feb"));
  assert.ok(csv.includes("Paycheck"));
  assert.ok(csv.includes("Net leftover"));
});

test("year insights mention savings rate", () => {
  const txs = [tx("1", "2026-01-05", "DIR DEP", 2000, "pay"), tx("2", "2026-01-01", "RENT", -400, "rent")];
  const items = yearInsights(buildYearWorkbook(txs, cats, "2026"));
  assert.ok(items.some((i) => i.id === "rate"));
});
