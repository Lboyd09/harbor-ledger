import assert from "node:assert/strict";
import { test } from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import * as XLSX from "xlsx";
import { DEFAULT_PROFILE } from "./presets.ts";
import { buildHarborWorkbook } from "./xlsx-book.ts";
import type { Category, Transaction } from "./types.ts";

const cats: Category[] = [
  { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 3000, parentId: null },
  { id: "rent", slug: "housing", name: "Housing", kind: "expense", plannedMonthly: 950, parentId: null },
  { id: "side", slug: "side", name: "Night shift", kind: "income", plannedMonthly: 200, parentId: "pay" },
];

const tx: Transaction = {
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
};

test("excel workbook opens in a spreadsheet and keeps charts", () => {
  const bytes = buildHarborWorkbook({
    profile: { ...DEFAULT_PROFILE, ledgerName: "Test", completedOnboarding: true },
    categories: cats,
    transactions: [tx],
    monthBudgets: [{ categoryId: "rent", ym: "2026-07", amount: 800 }],
  });
  const wb = XLSX.read(bytes, { type: "array" });
  for (const name of ["Transactions", "Charts", "Month budgets", "Categories", "Income merchants", "Spending merchants"]) {
    assert.ok(wb.SheetNames.includes(name), name);
  }
  const csv = XLSX.utils.sheet_to_csv(wb.Sheets["Transactions"]);
  assert.match(csv, /RENT JULY/);
  const files = unzipSync(bytes);
  assert.match(strFromU8(files["xl/charts/chart1.xml"]), /Income and spending/);
  assert.match(strFromU8(files["xl/charts/chart2.xml"]), /Spending by category/);
});
