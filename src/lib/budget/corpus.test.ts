import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fileInsights,
  freshAccount,
  monthEndForecast,
  oneOffCharge,
  priceIncrease,
  quietMonth,
  stoppedBill,
  yearBoundary,
} from "./analytics.ts";
import { importNewRows, sortCharge } from "./auto-sort.ts";
import { matchBankLabel } from "./bank-label.ts";
import { parseBackup } from "./backup.ts";
import { parseCsvText } from "./csv.ts";
import { merchantKey } from "./merchant.ts";
import { buildPresetCategories } from "./presets.ts";
import type { Category, Profile, Transaction } from "./types.ts";

const categories: Category[] = [
  { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 400 },
  { id: "dining", slug: "dining", name: "Eating out", kind: "expense", plannedMonthly: 80 },
  { id: "housing", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 1400 },
  { id: "gas", slug: "gas", name: "Gas", kind: "expense", plannedMonthly: 120 },
  { id: "transport", slug: "transport", name: "Car and transit", kind: "expense", plannedMonthly: 160 },
  { id: "utilities", slug: "utilities", name: "Utilities", kind: "expense", plannedMonthly: 150 },
  { id: "health", slug: "health", name: "Health", kind: "expense", plannedMonthly: 40 },
  { id: "subscriptions", slug: "subscriptions", name: "Subscriptions", kind: "expense", plannedMonthly: 30 },
  { id: "entertainment", slug: "entertainment", name: "Entertainment", kind: "expense", plannedMonthly: 40 },
  { id: "personal", slug: "personal", name: "Personal", kind: "expense", plannedMonthly: 50 },
  { id: "pets", slug: "pets", name: "Pets", kind: "expense", plannedMonthly: 40 },
  { id: "travel", slug: "travel", name: "Travel", kind: "expense", plannedMonthly: 50 },
  { id: "giving", slug: "giving", name: "Giving", kind: "expense", plannedMonthly: 20 },
  { id: "childcare", slug: "childcare", name: "Childcare", kind: "expense", plannedMonthly: 0 },
  { id: "savings", slug: "savings", name: "Savings", kind: "expense", plannedMonthly: 100 },
  { id: "debt", slug: "debt", name: "Debt", kind: "expense", plannedMonthly: 0 },
  { id: "transfers-out", slug: "transfers-out", name: "Transfers out", kind: "expense", plannedMonthly: 0 },
  { id: "pay", slug: "paycheck", name: "Paycheck", kind: "income", plannedMonthly: 3000 },
  { id: "other-income", slug: "other-income", name: "Other income", kind: "income", plannedMonthly: 0 },
];

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction {
  return {
    description: partial.description ?? partial.merchantKey ?? "Charge",
    merchantKey: partial.merchantKey ?? "STORE",
    sourceLabel: "Bank",
    fingerprint: partial.id,
    categoryId: partial.categoryId ?? null,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    ...partial,
  };
}

const BANK_LABELS: { label: string; slug: string | null }[] = [
  { label: "Groceries", slug: "food" },
  { label: "Grocery", slug: "food" },
  { label: "Eating out", slug: "dining" },
  { label: "Restaurants", slug: "dining" },
  { label: "Fast Food", slug: "dining" },
  { label: "Rent", slug: "housing" },
  { label: "Mortgage", slug: "housing" },
  { label: "Rent or mortgage", slug: "housing" },
  { label: "Car Insurance", slug: "transport" },
  { label: "Auto Insurance", slug: "transport" },
  { label: "Gasoline", slug: "gas" },
  { label: "Gas & Fuel", slug: "gas" },
  { label: "Utilities", slug: "utilities" },
  { label: "Internet", slug: "utilities" },
  { label: "Pharmacy", slug: "health" },
  { label: "Health Insurance", slug: "health" },
  { label: "Subscriptions", slug: "subscriptions" },
  { label: "Streaming", slug: "subscriptions" },
  { label: "Entertainment", slug: "entertainment" },
  { label: "Pets", slug: "pets" },
  { label: "Pet food", slug: "pets" },
  { label: "Travel", slug: "travel" },
  { label: "Charity", slug: "giving" },
  { label: "Childcare", slug: "childcare" },
  { label: "Paycheck", slug: "paycheck" },
  { label: "Other income", slug: "other-income" },
  { label: "Uncategorized", slug: null },
  { label: "Other", slug: null },
  { label: "Miscellaneous", slug: null },
  { label: "", slug: null },
  { label: "Purchase", slug: null },
  { label: "Fuel", slug: "gas" },
  { label: "Electricity", slug: "utilities" },
  { label: "Phone", slug: "utilities" },
  { label: "Streaming", slug: "subscriptions" },
  { label: "Shopping", slug: "personal" },
  { label: "Parking", slug: "transport" },
  { label: "Transit", slug: "transport" },
  { label: "Hotel", slug: "travel" },
  { label: "Donation", slug: "giving" },
  { label: "Daycare", slug: "childcare" },
  { label: "Payroll", slug: "paycheck" },
  { label: "Student loan", slug: "debt" },
  { label: "Savings transfer", slug: "savings" },
  { label: "Coffee shop", slug: "dining" },
  { label: "Supermarket", slug: "food" },
  { label: "Medical", slug: "health" },
  { label: "Miscellaneous", slug: null },
];

function paceFixture(): Transaction[] {
  const rows: Transaction[] = [];
  for (let day = 1; day <= 9; day++) {
    rows.push(
      tx({
        id: `g${day}`,
        date: `2026-03-${String(day).padStart(2, "0")}`,
        amount: -10,
        merchantKey: "GROCERY",
        description: "CITY GROCERY",
        categoryId: "food",
      }),
    );
  }
  rows.push(
    tx({
      id: "repair",
      date: "2026-03-10",
      amount: -400,
      merchantKey: "REPAIR",
      description: "ONE TIME REPAIR",
      categoryId: "transport",
    }),
  );
  return rows;
}

function oneMonth(): Transaction[] {
  return [
    tx({ id: "pay", date: "2026-03-01", amount: 2000, merchantKey: "ACME", description: "ACME PAYROLL", categoryId: "pay" }),
    tx({ id: "rent", date: "2026-03-02", amount: -1100, merchantKey: "LANDLORD", description: "MAPLE RENT", categoryId: "housing" }),
    tx({ id: "g1", date: "2026-03-03", amount: -40, merchantKey: "GROCERY", description: "CITY GROCERY", categoryId: "food" }),
    tx({ id: "g2", date: "2026-03-08", amount: -55, merchantKey: "GROCERY", description: "CITY GROCERY", categoryId: "food" }),
    tx({ id: "eat", date: "2026-03-09", amount: -22, merchantKey: "CAFE", description: "CORNER CAFE", categoryId: "dining" }),
    tx({ id: "once", date: "2026-03-11", amount: -260, merchantKey: "REPAIR", description: "ONE TIME REPAIR", categoryId: "transport" }),
  ];
}

function percent(passed: number, total: number): string {
  if (!total) return "0";
  const value = Math.round((passed / total) * 1000) / 10;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

test("bank-label corpus", () => {
  const misses: string[] = [];
  let passed = 0;
  for (const row of BANK_LABELS) {
    const hit = matchBankLabel(row.label, categories);
    const slug = hit?.slug ?? null;
    if (slug === row.slug) passed += 1;
    else misses.push(`${JSON.stringify(row.label)} expected ${row.slug ?? "null"} got ${slug ?? "null"}`);
  }
  const total = BANK_LABELS.length;
  console.log(`bank-label corpus: ${passed}/${total} (${percent(passed, total)}%)`);
  for (const miss of misses) console.log(`  miss: ${miss}`);
  assert.equal(passed, total);
});

test("analytics corpus", () => {
  const pace = paceFixture();
  const forecast = monthEndForecast({ transactions: pace, categories, ym: "2026-03", today: "2026-03-10" });
  const forecastAgain = monthEndForecast({ transactions: pace, categories, ym: "2026-03", today: "2026-03-10" });
  const quietForecast = monthEndForecast({
    transactions: pace,
    categories,
    ym: "2026-04",
    today: "2026-04-08",
  });
  const freshRows = oneMonth();
  const freshForecast = monthEndForecast({ transactions: freshRows, categories, ym: "2026-03", today: "2026-03-15" });
  const boundaryRows = [
    tx({ id: "d", date: "2025-12-20", amount: -80, merchantKey: "GROCERY", description: "GROCERY", categoryId: "food" }),
    tx({ id: "j", date: "2026-01-12", amount: -30, merchantKey: "GROCERY", description: "GROCERY", categoryId: "food" }),
  ];
  const januaryForecast = monthEndForecast({ transactions: boundaryRows, categories, ym: "2026-01", today: "2026-01-16" });
  const raised = [
    tx({ id: "n1", date: "2026-01-05", amount: -9.99, merchantKey: "NETFLIX", description: "NETFLIX", categoryId: "subscriptions" }),
    tx({ id: "n2", date: "2026-02-05", amount: -9.99, merchantKey: "NETFLIX", description: "NETFLIX", categoryId: "subscriptions" }),
    tx({ id: "n3", date: "2026-03-05", amount: -15.99, merchantKey: "NETFLIX", description: "NETFLIX", categoryId: "subscriptions" }),
  ];
  const stopped = [
    tx({ id: "s1", date: "2026-01-01", amount: -10.99, merchantKey: "SPOTIFY", description: "SPOTIFY", categoryId: "subscriptions" }),
    tx({ id: "s2", date: "2026-02-01", amount: -10.99, merchantKey: "SPOTIFY", description: "SPOTIFY", categoryId: "subscriptions" }),
    tx({ id: "s3", date: "2026-03-01", amount: -10.99, merchantKey: "SPOTIFY", description: "SPOTIFY", categoryId: "subscriptions" }),
  ];
  const acrossYear = [
    tx({ id: "b1", date: "2025-12-15", amount: -15.99, merchantKey: "NETFLIX", description: "NETFLIX", categoryId: "subscriptions" }),
    tx({ id: "b2", date: "2026-01-15", amount: -15.99, merchantKey: "NETFLIX", description: "NETFLIX", categoryId: "subscriptions" }),
  ];
  const quietRows = [
    tx({ id: "q1", date: "2026-01-04", amount: -40, merchantKey: "GROCERY", description: "GROCERY", categoryId: "food" }),
    tx({ id: "q2", date: "2026-02-02", amount: 1800, merchantKey: "ACME", description: "PAYROLL", categoryId: "pay" }),
  ];
  const oneOffRows = [
    tx({ id: "o1", date: "2026-05-02", amount: -12, merchantKey: "GROCERY", description: "GROCERY", categoryId: "food" }),
    tx({ id: "o2", date: "2026-05-03", amount: -14, merchantKey: "CAFE", description: "CAFE", categoryId: "dining" }),
    tx({ id: "o3", date: "2026-05-04", amount: -11, merchantKey: "GAS", description: "SHELL", categoryId: "gas" }),
    tx({ id: "o4", date: "2026-05-05", amount: -18, merchantKey: "STORE", description: "TARGET", categoryId: "personal" }),
    tx({ id: "o5", date: "2026-05-06", amount: -250, merchantKey: "REPAIR", description: "ONE TIME REPAIR", categoryId: "transport" }),
  ];
  const read = fileInsights(freshRows, categories, "2026-03-15");
  const cases: { name: string; ok: boolean }[] = [
    { name: "forecast enough", ok: forecast?.projectedSpend === 679 && forecast.spentSoFar === 490 },
    { name: "forecast deterministic", ok: JSON.stringify(forecast) === JSON.stringify(forecastAgain) },
    { name: "forecast outside the month", ok: monthEndForecast({ transactions: pace, categories, ym: "2026-03", today: "2026-04-01" }) === null },
    { name: "forecast empty account", ok: monthEndForecast({ transactions: [], categories: categories.map((c) => ({ ...c, plannedMonthly: 0 })), ym: "2026-03", today: "2026-03-10" }) === null },
    { name: "forecast month with no spending", ok: quietForecast?.projectedSpend === 0 && /nothing has gone out/i.test(quietForecast?.sentence ?? "") },
    { name: "forecast one-off is not a daily habit", ok: (forecast?.projectedSpend ?? 0) < 900 },
    { name: "forecast year boundary date", ok: januaryForecast != null && januaryForecast.today === "2026-01-16" },
    { name: "forecast fresh month", ok: freshForecast != null && freshForecast.spentSoFar > 0 },
    { name: "price increase enough", ok: priceIncrease(raised)?.delta === 6 },
    { name: "price increase too little", ok: priceIncrease(raised.slice(0, 2)) === null },
    { name: "stopped bill enough", ok: (stoppedBill(stopped, "2026-06-15")?.quietDays ?? 0) > 40 },
    { name: "stopped bill too little", ok: stoppedBill(stopped.slice(0, 1), "2026-06-15") === null },
    { name: "bill across the year is not stopped", ok: stoppedBill(acrossYear, "2026-01-20") === null && yearBoundary(acrossYear, categories, 2026) != null },
    { name: "one-off enough", ok: oneOffCharge(oneOffRows, "2026-05")?.amount === 250 },
    { name: "one-off too little", ok: oneOffCharge(oneOffRows.slice(0, 3), "2026-05") === null },
    { name: "year boundary enough", ok: yearBoundary(boundaryRows, categories, 2026)?.delta === -50 },
    { name: "year boundary too little", ok: yearBoundary(boundaryRows.slice(1), categories, 2026) === null },
    { name: "december with no spending", ok: /no spending/i.test(yearBoundary([tx({ id: "in", date: "2025-12-15", amount: 100, categoryId: "pay" }), ...boundaryRows.slice(1)], categories, 2026)?.sentence ?? "") },
    { name: "quiet month", ok: quietMonth(quietRows, categories)?.ym === "2026-02" },
    { name: "quiet month too little", ok: quietMonth([], categories) === null && quietMonth(freshRows, categories) === null },
    { name: "fresh account", ok: freshAccount(freshRows, categories)?.ym === "2026-03" },
    { name: "fresh account too little", ok: freshAccount([], categories) === null && freshAccount([...freshRows, tx({ id: "next", date: "2026-04-02", amount: -5, categoryId: "food" })], categories) === null },
    { name: "file insights one month", ok: (read?.items.length ?? 0) >= 4 && (read?.waiting.length ?? 0) >= 1 && (read?.items.every((item) => item.title.length > 2 && item.detail.length > 8) ?? false) },
    { name: "file insights empty", ok: fileInsights([], categories) === null },
  ];
  const passed = cases.filter((row) => row.ok).length;
  console.log(`analytics corpus: ${passed}/${cases.length} (${percent(passed, cases.length)}%)`);
  for (const row of cases) if (!row.ok) console.log(`  miss: ${row.name}`);
  assert.equal(passed, cases.length);
});

test("a category column is read, a memo does not replace the description, and vague labels stay unsorted", () => {
  const csv = `Date,Description,Amount,Category,Memo
03/02/2026,ACME STORE 99,-42.10,Groceries,weekly shop
03/03/2026,MYSTERY SHOP,-18.00,Eating out,lunch
03/04/2026,LANDLORD LLC,-1400.00,Rent,march rent
03/05/2026,GEICO PAYMENT,-155.00,Car Insurance,policy
03/06/2026,RANDOM PLACE,-12.00,Other,no idea
03/08/2026,UNIT 4B,-1400.00,Rent or mortgage,march
03/09/2026,POLICY 88,-90.00,Car insurance,policy
03/07/2026,CARD PURCHASE 4411,-15.49,,NETFLIX.COM
`;
  const preview = parseCsvText(csv, "labeled.csv");
  assert.equal(preview.columns.find((col) => col.header === "Category")?.role, "category");
  assert.equal(preview.columns.find((col) => col.header === "Memo")?.role, "memo");
  assert.equal(preview.columns.find((col) => col.header === "Description")?.role, "description");
  const acme = preview.rows.find((row) => row.description.includes("ACME"));
  assert.equal(acme?.description, "ACME STORE 99");
  assert.equal(acme?.bankCategory, "Groceries");
  assert.equal(acme?.memo, "weekly shop");
  const imported = importNewRows({
    rows: preview.rows,
    sourceLabel: "Bank",
    existing: [],
    categories,
    rules: [],
    createId: () => `tx_${Math.random().toString(36).slice(2, 8)}`,
  });
  const byDesc = (needle: string) => imported.added.find((row) => row.description.includes(needle));
  for (const needle of ["ACME", "MYSTERY"]) {
    const row = byDesc(needle);
    assert.equal(row?.auto?.source, "bank", needle);
    assert.equal(row?.auto?.confidence, "sure", needle);
    assert.match(row?.auto?.reason ?? "", /bank called this/i, needle);
    assert.ok(row?.categoryId, needle);
  }
  for (const needle of ["LANDLORD", "GEICO"]) {
    const row = byDesc(needle);
    assert.equal(row?.auto?.source, "keyword", needle);
    assert.equal(row?.auto?.confidence, "sure", needle);
    assert.ok(row?.categoryId, needle);
  }
  const other = byDesc("RANDOM");
  assert.notEqual(other?.auto?.confidence, "sure");
  assert.equal(other?.categoryId, null);
  const memo = byDesc("CARD PURCHASE");
  assert.equal(memo?.description, "CARD PURCHASE 4411");
  assert.equal(memo?.notes, "NETFLIX.COM");
  assert.equal(categories.find((category) => category.id === memo?.categoryId)?.slug, "subscriptions");
  const important = ["food", "dining", "housing", "transport"];
  for (const slug of important) {
    assert.ok(
      imported.added.some((row) => categories.find((category) => category.id === row.categoryId)?.slug === slug && row.auto?.source === "bank"),
      slug,
    );
  }
});

test("a person's earlier choice beats the bank label", () => {
  const sorted = sortCharge(
    { description: "ACME STORE 99", amount: -12, merchantKey: merchantKey("ACME STORE 99"), bankCategory: "Gas" },
    {
      categories,
      rules: [],
      history: [{ merchantKey: merchantKey("ACME STORE 99"), categoryId: "food", userSet: true, date: "2026-02-01", amount: -8 }],
    },
  );
  assert.equal(sorted.auto.source, "history");
  assert.equal(sorted.categoryId, "food");
});

test("old backups without the new fields still load, and new fields restore", () => {
  const old = parseBackup({
    categories: [{ id: "c1", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 200 }],
    transactions: [
      {
        id: "t1",
        date: "2026-01-02",
        description: "STORE",
        amount: -10,
        merchantKey: "STORE",
        fingerprint: "x",
        categoryId: "c1",
        userSet: true,
        notes: "keep",
        auto: { source: "magic", confidence: "sure", suggestedCategoryId: "c1" },
      },
    ],
    monthBudgets: [{ categoryId: "c1", ym: "2026-01", amount: 40 }],
    profile: { ledgerName: "Old", completedOnboarding: true },
  });
  assert.equal(old.ok, true);
  if (!old.ok) return;
  assert.equal(old.data.categories[0].plannedMonthly, 200);
  assert.equal(old.data.categories[0].carry, undefined);
  assert.equal(old.data.transactions[0].notes, "keep");
  assert.equal(old.data.transactions[0].categoryId, "c1");
  assert.equal(old.data.transactions[0].auto?.source, "none");
  assert.equal(old.data.monthBudgets[0].amount, 40);

  const next = parseBackup({
    categories: [{ id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 220, carry: true }],
    transactions: [
      {
        id: "t2",
        date: "2026-03-02",
        description: "ACME",
        amount: -10,
        merchantKey: "ACME",
        fingerprint: "y",
        auto: {
          source: "bank",
          confidence: "sure",
          suggestedCategoryId: "food",
          reason: "The bank called this Groceries, so it is Groceries.",
        },
      },
    ],
    monthBudgets: [{ categoryId: "food", ym: "2026-03", amount: 50 }],
  });
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.data.categories[0].carry, true);
  assert.equal(next.data.categories[0].plannedMonthly, 220);
  assert.equal(next.data.transactions[0].auto?.source, "bank");
  assert.match(next.data.transactions[0].auto?.reason ?? "", /Groceries/);
  assert.equal(next.data.monthBudgets[0].amount, 50);
});


test("merchant corpus of everyday descriptions", () => {
  const profile: Profile = {
    ledgerName: "t", household: "single", dependents: 0, lifeStage: "early-career", housing: "rent",
    hasVehicle: true, usesTransit: true, hasPets: true, monthlyIncome: 4000,
    incomeStreams: [],
    buckets: ["housing","food","dining","gas","transport","utilities","personal","health","subscriptions","entertainment","giving","education","childcare","pets","travel","debt"],
    goals: ["track"], completedOnboarding: true, budgetPeriod: "month",
  };
  const categories = buildPresetCategories(profile);
  const cases: { description: string; amount: number; slug: string | null; confidence: "sure" | "likely" | "unsure"; gate: boolean }[] = [
    { description: 'SQ *CHIPOTLE 5521 PHOENIX, AZ', amount: -14, slug: "dining", confidence: "sure", gate: true },
    { description: 'TST* STARBUCKS STORE 88 AUSTIN, TX', amount: -6.5, slug: "dining", confidence: "sure", gate: true },
    { description: "MCDONALD'S #4412", amount: -8, slug: "dining", confidence: "sure", gate: true },
    { description: 'BURGER KING 12', amount: -9, slug: "dining", confidence: "sure", gate: true },
    { description: 'TACO BELL 009', amount: -7, slug: "dining", confidence: "sure", gate: true },
    { description: 'CHICK-FIL-A #0123', amount: -11, slug: "dining", confidence: "sure", gate: true },
    { description: 'OLIVE GARDEN 441', amount: -32, slug: "dining", confidence: "sure", gate: true },
    { description: "DOMINO'S PIZZA", amount: -18, slug: "dining", confidence: "sure", gate: true },
    { description: 'PIZZA HUT 19', amount: -16, slug: "dining", confidence: "sure", gate: true },
    { description: 'PANERA BREAD 3', amount: -13, slug: "dining", confidence: "sure", gate: true },
    { description: 'DUNKIN 220', amount: -4, slug: "dining", confidence: "sure", gate: true },
    { description: 'DOORDASH*DASHPASS', amount: -24, slug: "dining", confidence: "sure", gate: true },
    { description: 'GRUBHUB ORDER', amount: -21, slug: "dining", confidence: "sure", gate: true },
    { description: 'KROGER #441 PHOENIX AZ', amount: -62, slug: "food", confidence: "sure", gate: true },
    { description: 'PUBLIX 1234', amount: -48, slug: "food", confidence: "sure", gate: true },
    { description: "TRADER JOE'S 551", amount: -36, slug: "food", confidence: "sure", gate: true },
    { description: 'WHOLE FOODS MKT', amount: -70, slug: "food", confidence: "sure", gate: true },
    { description: 'ALDI 8821', amount: -33, slug: "food", confidence: "sure", gate: true },
    { description: 'FOOD LION 12', amount: -29, slug: "food", confidence: "sure", gate: true },
    { description: 'H MART AUSTIN', amount: -44, slug: "food", confidence: "sure", gate: true },
    { description: '99 RANCH MARKET', amount: -38, slug: "food", confidence: "sure", gate: true },
    { description: 'WINCO FOODS', amount: -41, slug: "food", confidence: "sure", gate: true },
    { description: 'SHELL OIL 1221 XXXX4411', amount: -40, slug: "gas", confidence: "sure", gate: true },
    { description: 'CHEVRON 0099881', amount: -36, slug: "gas", confidence: "sure", gate: true },
    { description: 'CIRCLE K 441', amount: -28, slug: "gas", confidence: "sure", gate: true },
    { description: 'COSTCO GAS 119', amount: -44, slug: "gas", confidence: "sure", gate: true },
    { description: 'EXXON 7761', amount: -31, slug: "gas", confidence: "sure", gate: true },
    { description: 'WAWA 552 FUEL', amount: -27, slug: "gas", confidence: "sure", gate: true },
    { description: 'UBER TRIP XXXX2291', amount: -18, slug: "transport", confidence: "sure", gate: true },
    { description: 'LYFT RIDE 0091', amount: -16, slug: "transport", confidence: "sure", gate: true },
    { description: 'EZPASS REPLENISH', amount: -25, slug: "transport", confidence: "sure", gate: true },
    { description: 'GEICO AUTO', amount: -120, slug: "transport", confidence: "sure", gate: true },
    { description: 'STATE FARM INS', amount: -140, slug: "transport", confidence: "sure", gate: true },
    { description: 'JIFFY LUBE 19', amount: -49, slug: "transport", confidence: "sure", gate: true },
    { description: 'AUTOZONE 332', amount: -22, slug: "transport", confidence: "sure", gate: true },
    { description: 'DUKE ENERGY BILL', amount: -88, slug: "utilities", confidence: "sure", gate: true },
    { description: 'VERIZON WIRELESS', amount: -75, slug: "utilities", confidence: "sure", gate: true },
    { description: 'COMCAST CABLE', amount: -70, slug: "utilities", confidence: "sure", gate: true },
    { description: 'NATIONAL GRID', amount: -64, slug: "utilities", confidence: "sure", gate: true },
    { description: 'PG&E ENERGY', amount: -91, slug: "utilities", confidence: "sure", gate: true },
    { description: 'T-MOBILE PCS', amount: -50, slug: "utilities", confidence: "sure", gate: true },
    { description: 'NETFLIX.COM', amount: -15.49, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'SPOTIFY USA', amount: -11.99, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'HULU 8801', amount: -17.99, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'ADOBE CREATIVE', amount: -54.99, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'SLACK TECH', amount: -8, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'CVS/PHARMACY 221', amount: -12, slug: "health", confidence: "sure", gate: true },
    { description: 'WALGREENS 4412', amount: -9, slug: "health", confidence: "sure", gate: true },
    { description: 'BLUE CROSS', amount: -210, slug: "health", confidence: "sure", gate: true },
    { description: 'PLANET FITNESS', amount: -24, slug: "health", confidence: "sure", gate: true },
    { description: 'CHEWY.COM', amount: -42, slug: "pets", confidence: "sure", gate: true },
    { description: 'PETCO 118', amount: -28, slug: "pets", confidence: "sure", gate: true },
    { description: 'KINDERCARE', amount: -800, slug: "childcare", confidence: "sure", gate: true },
    { description: 'TUITION PAYMENT', amount: -500, slug: "education", confidence: "sure", gate: true },
    { description: 'DELTA AIR 006', amount: -280, slug: "travel", confidence: "sure", gate: true },
    { description: 'MARRIOTT HOTELS', amount: -190, slug: "travel", confidence: "sure", gate: true },
    { description: 'AIRBNB * STAY', amount: -140, slug: "travel", confidence: "sure", gate: true },
    { description: 'HOME DEPOT 441', amount: -46, slug: "personal", confidence: "sure", gate: true },
    { description: 'BEST BUY 009', amount: -80, slug: "personal", confidence: "sure", gate: true },
    { description: 'NORDSTROM 12', amount: -60, slug: "personal", confidence: "sure", gate: true },
    { description: 'USPS PO 441', amount: -8, slug: "personal", confidence: "sure", gate: true },
    { description: 'GOODWILL DONATION', amount: -20, slug: "giving", confidence: "sure", gate: true },
    { description: 'RED CROSS', amount: -25, slug: "giving", confidence: "sure", gate: true },
    { description: 'ATM FEE', amount: -3, slug: "other", confidence: "sure", gate: true },
    { description: 'NSF FEE', amount: -35, slug: "other", confidence: "sure", gate: true },
    { description: 'OVERDRAFT FEE', amount: -34, slug: "other", confidence: "sure", gate: true },
    { description: 'WALMART SUPERCENTER', amount: -60, slug: "food", confidence: "likely", gate: true },
    { description: 'TARGET STORE 112', amount: -22, slug: "personal", confidence: "likely", gate: true },
    { description: 'AMAZON MKTPL', amount: -19, slug: "personal", confidence: "likely", gate: true },
    { description: 'COSTCO WHSE', amount: -110, slug: "food", confidence: "likely", gate: true },
    { description: "SAM'S CLUB", amount: -70, slug: "food", confidence: "likely", gate: true },
    { description: 'EBAY SALE', amount: -15, slug: "personal", confidence: "likely", gate: true },
    { description: "WENDY'S 441", amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'FIVE GUYS 2', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'SHAKE SHACK', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'IN-N-OUT 18', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'DAIRY QUEEN', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'WHITE CASTLE', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'PAPA JOHNS', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'LITTLE CAESARS', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'CHIPOTLE 0091', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'RAISING CANES', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'WINGSTOP 14', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'PANDA EXPRESS', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'QDOBA 3', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'JERSEY MIKES', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'FIREHOUSE SUBS', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'WHATABURGER 8', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'PEETS COFFEE', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'DUTCH BROS', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'CARIBOU COFFEE', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'TIM HORTONS', amount: -20, slug: "dining", confidence: "sure", gate: true },
    { description: 'HARRIS TEETER', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'KING SOOPERS', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'SPROUTS FARMERS', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'GELSONS MARKET', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'SAVE A LOT', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'SMART AND FINAL', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'BROOKSHIRE BROS', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'CUB FOODS', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'GIANT EAGLE', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'FOODMAXX 2', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'CARDENAS 9', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'VALLARTA SUPERMERCADO', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'PATEL BROTHERS', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'FAREWAY STORE', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'MEIJER 441', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'WEGMANS 12', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'SAFEWAY 229', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'ALBERTSONS 10', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'HYVEE 441', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'STATER BROS', amount: -20, slug: "food", confidence: "sure", gate: true },
    { description: 'QUIKTRIP 441', amount: -20, slug: "gas", confidence: "sure", gate: true },
    { description: 'SHEETZ 118', amount: -20, slug: "gas", confidence: "sure", gate: true },
    { description: 'BUCCEES 12', amount: -20, slug: "gas", confidence: "sure", gate: true },
    { description: 'CASEYS GEN', amount: -20, slug: "gas", confidence: "sure", gate: true },
    { description: 'SUNOCO 77', amount: -20, slug: "gas", confidence: "sure", gate: true },
    { description: 'VALERO 19', amount: -20, slug: "gas", confidence: "sure", gate: true },
    { description: 'KUM & GO', amount: -20, slug: "gas", confidence: "sure", gate: true },
    { description: 'PILOT TRAVEL CENTER', amount: -20, slug: "gas", confidence: "sure", gate: true },
    { description: 'CHARGEPOINT', amount: -20, slug: "transport", confidence: "sure", gate: true },
    { description: 'PARKWHIZ', amount: -20, slug: "transport", confidence: "sure", gate: true },
    { description: 'SPOTHERO PARK', amount: -20, slug: "transport", confidence: "sure", gate: true },
    { description: 'DISCOUNT TIRE', amount: -20, slug: "transport", confidence: "sure", gate: true },
    { description: "O'REILLY AUTO", amount: -20, slug: "transport", confidence: "sure", gate: true },
    { description: 'ALLSTATE INS', amount: -20, slug: "transport", confidence: "sure", gate: true },
    { description: 'PROGRESSIVE INS', amount: -20, slug: "transport", confidence: "sure", gate: true },
    { description: 'LIBERTY MUTUAL', amount: -20, slug: "transport", confidence: "sure", gate: true },
    { description: 'XCEL ENERGY', amount: -20, slug: "utilities", confidence: "sure", gate: true },
    { description: 'DOMINION ENERGY', amount: -20, slug: "utilities", confidence: "sure", gate: true },
    { description: 'AMEREN ILLINOIS', amount: -20, slug: "utilities", confidence: "sure", gate: true },
    { description: 'WASTE MANAGEMENT', amount: -20, slug: "utilities", confidence: "sure", gate: true },
    { description: 'SPECTRUM 441', amount: -20, slug: "utilities", confidence: "sure", gate: true },
    { description: 'XFINITY', amount: -20, slug: "utilities", confidence: "sure", gate: true },
    { description: 'CRICKET WIRELESS', amount: -20, slug: "utilities", confidence: "sure", gate: true },
    { description: 'MINT MOBILE', amount: -20, slug: "utilities", confidence: "sure", gate: true },
    { description: 'YOUTUBE TV', amount: -20, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'APPLE TV PLUS', amount: -20, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'DROPBOX', amount: -20, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'ZOOM.US', amount: -20, slug: "subscriptions", confidence: "sure", gate: true },
    { description: '1PASSWORD', amount: -20, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'PEACOCK TV', amount: -20, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'HBO MAX', amount: -20, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'PARAMOUNT PLUS', amount: -20, slug: "subscriptions", confidence: "sure", gate: true },
    { description: 'ANYTIME FITNESS', amount: -20, slug: "health", confidence: "sure", gate: true },
    { description: 'LA FITNESS', amount: -20, slug: "health", confidence: "sure", gate: true },
    { description: 'ASPEN DENTAL', amount: -20, slug: "health", confidence: "sure", gate: true },
    { description: 'WARBY PARKER', amount: -20, slug: "health", confidence: "sure", gate: true },
    { description: 'PETSMART 441', amount: -20, slug: "pets", confidence: "sure", gate: true },
    { description: 'BANFIELD PET', amount: -20, slug: "pets", confidence: "sure", gate: true },
    { description: 'BRIGHT HORIZONS', amount: -20, slug: "childcare", confidence: "sure", gate: true },
    { description: 'GODDARD SCHOOL', amount: -20, slug: "childcare", confidence: "sure", gate: true },
    { description: 'MOHELA STUDENT', amount: -20, slug: "debt", confidence: "sure", gate: true },
    { description: 'NELNET LOAN', amount: -20, slug: "debt", confidence: "sure", gate: true },
    { description: 'NAVIENT PAYMENT', amount: -20, slug: "debt", confidence: "sure", gate: true },
    { description: 'SALLIE MAE', amount: -20, slug: "debt", confidence: "sure", gate: true },
    { description: 'UNITED AIRLINES', amount: -20, slug: "travel", confidence: "sure", gate: true },
    { description: 'SOUTHWEST AIR', amount: -20, slug: "travel", confidence: "sure", gate: true },
    { description: 'JETBLUE 441', amount: -20, slug: "travel", confidence: "sure", gate: true },
    { description: 'HILTON HOTELS', amount: -20, slug: "travel", confidence: "sure", gate: true },
    { description: 'HYATT REGENCY', amount: -20, slug: "travel", confidence: "sure", gate: true },
    { description: 'HERTZ RENT', amount: -20, slug: "travel", confidence: "sure", gate: true },
    { description: 'AIRBNB HM', amount: -20, slug: "travel", confidence: "sure", gate: true },
    { description: 'EXPEDIA HOTEL', amount: -20, slug: "travel", confidence: "sure", gate: true },
    { description: 'LOWES 441', amount: -20, slug: "personal", confidence: "sure", gate: true },
    { description: 'IKEA STORE', amount: -20, slug: "personal", confidence: "sure", gate: true },
    { description: 'WAYFAIR.COM', amount: -20, slug: "personal", confidence: "sure", gate: true },
    { description: 'MACYS 12', amount: -20, slug: "personal", confidence: "sure", gate: true },
    { description: 'KOHLS 441', amount: -20, slug: "personal", confidence: "sure", gate: true },
    { description: 'OLD NAVY', amount: -20, slug: "personal", confidence: "sure", gate: true },
    { description: 'SEPHORA', amount: -20, slug: "personal", confidence: "sure", gate: true },
    { description: 'ULTA BEAUTY', amount: -20, slug: "personal", confidence: "sure", gate: true },
    { description: 'UNITED WAY', amount: -20, slug: "giving", confidence: "sure", gate: true },
    { description: 'SALVATION ARMY', amount: -20, slug: "giving", confidence: "sure", gate: true },
    { description: 'GOFUNDME', amount: -20, slug: "giving", confidence: "sure", gate: true },
    { description: 'GOODWILL STORE', amount: -20, slug: "giving", confidence: "sure", gate: true },
    { description: 'IRS USATAXPYMT', amount: -20, slug: "other", confidence: "sure", gate: true },
    { description: 'DMV FEE', amount: -20, slug: "other", confidence: "sure", gate: true },
    { description: 'FOREIGN TRANSACTION FEE', amount: -20, slug: "other", confidence: "sure", gate: true },
    { description: 'WIRE FEE', amount: -20, slug: "other", confidence: "sure", gate: true },
    { description: 'VENMO CASHOUT', amount: -30, slug: "transfers-out", confidence: "unsure", gate: false },
    { description: 'ZELLE TO A FRIEND', amount: -25, slug: null, confidence: "unsure", gate: false },
    { description: 'CASH APP PAYMENT', amount: -15, slug: null, confidence: "unsure", gate: false },
    { description: 'ACME WIDGETS UNKNOWN', amount: -12, slug: null, confidence: "unsure", gate: false },
    { description: 'MYSTERY MERCHANT', amount: -9, slug: null, confidence: "unsure", gate: false },
  ];
  assert.ok(cases.length >= 150);
  let sortable = 0, right = 0, sureN = 0, sureBad = 0, likelyN = 0, likelyBad = 0, unsureSure = 0;
  const misses: string[] = [];
  for (const item of cases) {
    const sorted = sortCharge(
      { description: item.description, amount: item.amount, merchantKey: merchantKey(item.description) },
      { categories, rules: [] },
    );
    const slug = categories.find((c) => c.id === sorted.categoryId)?.slug ?? null;
    if (item.confidence === "unsure" && sorted.auto.confidence === "sure") {
      unsureSure += 1;
      misses.push(`${item.description} was sure`);
    }
    if (!item.gate || !item.slug) continue;
    sortable += 1;
    const ok = (sorted.auto.confidence === "sure" || sorted.auto.confidence === "likely") && slug === item.slug;
    if (ok) right += 1;
    else misses.push(`${item.description} expected ${item.slug}/${item.confidence} got ${slug}/${sorted.auto.confidence}`);
    if (sorted.auto.confidence === "sure") { sureN += 1; if (slug !== item.slug) sureBad += 1; }
    if (sorted.auto.confidence === "likely") { likelyN += 1; if (slug !== item.slug) likelyBad += 1; }
  }
  const rate = sortable ? right / sortable : 0;
  const sureRate = sureN ? sureBad / sureN : 0;
  const likelyRate = likelyN ? likelyBad / likelyN : 0;
  console.log(`merchant corpus: ${right}/${sortable} (${percent(right, sortable)}%) sure-wrong ${percent(sureBad, Math.max(sureN, 1))}% likely-wrong ${percent(likelyBad, Math.max(likelyN, 1))}%`);
  for (const miss of misses.slice(0, 25)) console.log(`  miss: ${miss}`);
  assert.equal(unsureSure, 0);
  assert.ok(rate >= 0.8, `sortable pass rate ${rate}`);
  assert.ok(sureRate <= 0.03, `sure wrong ${sureRate}`);
  assert.ok(likelyRate <= 0.08, `likely wrong ${likelyRate}`);
});
