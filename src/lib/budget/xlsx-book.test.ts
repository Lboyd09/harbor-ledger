import assert from "node:assert/strict";
import { test } from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import * as XLSX from "xlsx";
import { yearLedger } from "./ledger-month.ts";
import { DEFAULT_PROFILE } from "./presets.ts";
import { buildHarborWorkbook, WORKBOOK_SHEETS } from "./xlsx-book.ts";
import type { Category, Transaction } from "./types.ts";

const cats: Category[] = [
  { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 3000, parentId: null },
  { id: "rent", slug: "housing", name: "Housing", kind: "expense", plannedMonthly: 950, parentId: null },
  { id: "side", slug: "side", name: "Night shift", kind: "income", plannedMonthly: 200, parentId: "pay" },
];

const tx: Transaction[] = [
  {
    id: "1",
    date: "2026-07-04",
    description: "RENT JULY",
    merchantKey: "RENT",
    amount: -950,
    sourceLabel: "Demo",
    fingerprint: "1",
    categoryId: "rent",
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
  },
  {
    id: "2",
    date: "2026-07-01",
    description: "PAY",
    merchantKey: "PAY",
    amount: 3000,
    sourceLabel: "Demo",
    fingerprint: "2",
    categoryId: "pay",
    userSet: true,
    notes: "",
    excluded: false,
    status: "posted",
  },
];

test("workbook sheets follow the app and match the year ledger", () => {
  const profile = { ...DEFAULT_PROFILE, ledgerName: "Test", completedOnboarding: true };
  const bytes = buildHarborWorkbook({
    profile,
    categories: cats,
    transactions: tx,
    monthBudgets: [{ categoryId: "rent", ym: "2026-07", amount: 800 }],
  });
  const wb = XLSX.read(bytes, { type: "array" });
  assert.deepEqual(wb.SheetNames, [...WORKBOOK_SHEETS]);
  assert.equal((wb.SheetNames as string[]).includes("Saving for"), false);
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets["Home year"], { header: 1 });
  const total = rows.find((row) => row[1] === "Year total");
  const book = yearLedger({ transactions: tx, categories: cats, budgets: [{ categoryId: "rent", ym: "2026-07", amount: 800 }], style: "monthly" }, "2026");
  assert.ok(total);
  assert.equal(total[2], book.totals.received);
  assert.equal(total[3], book.totals.spent);
  assert.equal(total[4], book.totals.savedToFunds);
  assert.equal(total[5], book.totals.leftOver);
  const budget = wb.Sheets["Budget month"];
  const formula = Object.values(budget).find((cell) => cell && typeof cell === "object" && "f" in cell && String(cell.f).startsWith("=IF("));
  assert.ok(formula);
  const files = unzipSync(bytes);
  assert.match(strFromU8(files["xl/charts/chart1.xml"]), /Money in and out/);
  assert.match(strFromU8(files["xl/charts/chart2.xml"]), /Spending by category/);
  assert.match(strFromU8(files["xl/charts/chart3.xml"]), /Balances by account/);
  const csv = XLSX.utils.sheet_to_csv(wb.Sheets.Transactions);
  assert.match(csv, /RENT JULY/);
});

test("an empty ledger still exports every sheet", () => {
  const bytes = buildHarborWorkbook({
    profile: { ...DEFAULT_PROFILE, ledgerName: "Empty" },
    categories: [],
    transactions: [],
  });
  const wb = XLSX.read(bytes, { type: "array" });
  assert.deepEqual(wb.SheetNames, [...WORKBOOK_SHEETS]);
});
