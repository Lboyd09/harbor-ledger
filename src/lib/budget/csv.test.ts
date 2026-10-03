import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAmountFlip, parseCsvText, remapPreview, splitCsvLine } from "./csv.ts";
import { parseAmountToken } from "./money.ts";
import { parseDateToken } from "./parse-date.ts";
import { merchantKey } from "./merchant.ts";
import { matchKeywordSlug } from "./keywords.ts";
import { replaceMerchantRule, suggestCategory } from "./categorize.ts";
import { findRecurring } from "./recurring.ts";
import { SAMPLE_CSV } from "./sample.ts";
import { parseBackup } from "./backup.ts";
import { buildPresetCategories } from "./presets.ts";
import type { Transaction } from "./types.ts";

test("quoted csv fields", () => {
  assert.deepEqual(splitCsvLine('a,"b,c",d', ","), ["a", "b,c", "d"]);
  assert.deepEqual(splitCsvLine('a,"b""c",d', ","), ["a", 'b"c', "d"]);
});

test("amounts", () => {
  assert.equal(parseAmountToken("($12.30)"), -12.3);
  assert.equal(parseAmountToken("1,234.50"), 1234.5);
  assert.equal(parseAmountToken("12.50-"), -12.5);
  assert.equal(parseAmountToken("$9.00"), 9);
});

test("dates prefer US when ambiguous", () => {
  assert.equal(parseDateToken("09/14/2026"), "2026-09-14");
  assert.equal(parseDateToken("2026-09-14"), "2026-09-14");
  assert.equal(parseDateToken("14/09/2026"), "2026-09-14");
  assert.equal(parseDateToken("Sep 4, 2026"), "2026-09-04");
});

test("chase-like sample parses", () => {
  const p = parseCsvText(SAMPLE_CSV, "chase.csv");
  assert.equal(p.guessedSource, "Chase");
  assert.ok(p.rows.length > 40);
  const first = p.rows[0];
  assert.equal(first.date, "2026-06-02");
  assert.ok((first.amount ?? 0) < 0);
  assert.ok(first.description.includes("GROCERY"));
  assert.ok(!first.description.includes("DEBIT"));
  const details = p.columns.find((c) => c.header.toLowerCase() === "details");
  assert.equal(details?.role, "direction");
  const pay = p.rows.find((r) => r.description.includes("NORTHWIND"));
  assert.ok(pay && (pay.amount ?? 0) > 0);
});

test("keywords are universal", () => {
  assert.equal(matchKeywordSlug("COSTCO GAS ANYTOWN"), "gas");
  assert.equal(matchKeywordSlug("RIVERSIDE CITY DIR DEP"), "paycheck");
  assert.equal(matchKeywordSlug("NETFLIX.COM"), "subscriptions");
  assert.equal(matchKeywordSlug("Zelle payment to LAKESIDE PROPERTY MGMT"), "housing");
  assert.equal(matchKeywordSlug("MCDONALD'S"), "dining");
  assert.equal(matchKeywordSlug("TARGET STORE"), "personal");
  assert.equal(matchKeywordSlug("FIVE GUYS BURGERS"), "dining");
  assert.equal(matchKeywordSlug("PAYMENT TO CHASE CARD ENDING 4242"), "transfers-out");
  assert.equal(matchKeywordSlug("ZELLE PAYMENT FROM A PARENT"), "other-income");
});

test("refund stays in expense bucket", () => {
  const cats = buildPresetCategories({
    ledgerName: "t",
    household: "single",
    dependents: 0,
    lifeStage: "early-career",
    housing: "rent",
    hasVehicle: true,
    usesTransit: false,
    hasPets: false,
    monthlyIncome: 3000,
    incomeStreams: [{ name: "Paycheck", monthly: 3000 }],
    buckets: ["food", "dining", "other"],
    goals: ["track"],
    completedOnboarding: true,
    budgetPeriod: "month",
  });
  const hit = suggestCategory("MCDONALD'S REFUND", 8.12, cats, [], merchantKey("MCDONALD'S REFUND"));
  const dining = cats.find((c) => c.slug === "dining") ?? cats.find((c) => c.slug === "food");
  assert.equal(hit.reason, "refund");
  assert.equal(hit.categoryId, dining?.id);
  const unknown = suggestCategory("RANDOM PERSON ZILCH", 50, cats, [], "RANDOM");
  assert.equal(unknown.categoryId, null);
});

test("a merchant rule sticks, and income does not overwrite expenses", () => {
  const cats = buildPresetCategories({
    ledgerName: "t",
    household: "single",
    dependents: 0,
    lifeStage: "early-career",
    housing: "rent",
    hasVehicle: false,
    usesTransit: false,
    hasPets: false,
    monthlyIncome: 3000,
    incomeStreams: [{ name: "Paycheck", monthly: 3000 }],
    buckets: ["food", "other"],
    goals: ["track"],
    completedOnboarding: true,
    budgetPeriod: "month",
  });
  const food = cats.find((c) => c.slug === "food");
  const pay = cats.find((c) => c.kind === "income");
  assert.ok(food && pay);
  const rules = replaceMerchantRule(replaceMerchantRule([], "ACME", food.id, "out"), "ACME", pay.id, "in");
  const spend = suggestCategory("ACME", -20, cats, rules, "ACME");
  const deposit = suggestCategory("ACME", 20, cats, rules, "ACME");
  assert.equal(spend.categoryId, food.id);
  assert.equal(spend.reason, "rule");
  assert.equal(deposit.categoryId, pay.id);
  const changed = replaceMerchantRule(rules, "ACME", pay.id, "out");
  assert.equal(suggestCategory("ACME", -20, cats, changed, "ACME").categoryId, pay.id);
  assert.equal(suggestCategory("ACME", 20, cats, changed, "ACME").categoryId, pay.id);
});

test("recurring netflix monthly", () => {
  const desc = "NETFLIX.COM";
  const txs: Transaction[] = [1, 2, 3].map((n) => ({
    id: String(n),
    date: `2026-0${n + 5}-10`,
    description: desc,
    merchantKey: merchantKey(desc),
    amount: -15.49,
    sourceLabel: "x",
    fingerprint: String(n),
    categoryId: null,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
  }));
  const g = findRecurring(txs);
  assert.equal(g.length, 1);
  assert.equal(g[0].interval, "monthly");
  assert.equal(g[0].count, 3);
});

test("debit credit columns", () => {
  const csv = `Date,Description,Debit,Credit
09/01/2026,Payroll,,1200.00
09/02/2026,Grocer,54.10,
`;
  const p = parseCsvText(csv, "citi.csv");
  assert.equal(p.rows[0].amount, 1200);
  assert.equal(p.rows[1].amount, -54.1);
});

test("unsigned amounts take direction", () => {
  const csv = `date,amount,direction,name
2026-09-14,191.08,out,Dicks Sporting Goods
2026-09-11,33.81,in,STRIPE TRANSFER
`;
  const p = parseCsvText(csv, "generic.csv");
  const out = p.rows.find((r) => r.description.includes("Dicks"));
  const inn = p.rows.find((r) => r.description.includes("STRIPE"));
  assert.equal(out?.amount, -191.08);
  assert.equal(inn?.amount, 33.81);
});

test("wells fargo headerless", () => {
  const csv = `09/14/2026,-191.08,*,,DICKS SPORTING GOODS
09/11/2026,33.81,*,,STRIPE TRANSFER
`;
  const p = parseCsvText(csv, "Checking.csv");
  assert.equal(p.rows[0].date, "2026-09-14");
  assert.equal(p.rows[0].amount, -191.08);
  assert.ok(p.rows[0].description.includes("DICKS"));
});

test("flip signs", () => {
  const p = parseCsvText("Date,Description,Amount\n09/01/2026,Coffee,4.50\n", "x.csv");
  const flipped = applyAmountFlip(p, true);
  assert.equal(flipped[0].amount, -4.5);
});

test("remap description column", () => {
  const p = parseCsvText("Date,Foo,Amount\n09/01/2026,Coffee,4.50\n", "x.csv");
  const foo = p.columns.find((c) => c.header === "Foo")!;
  const remapped = remapPreview(
    p,
    p.columns.map((c) => (c.index === foo.index ? { ...c, role: "description" as const } : c)),
  );
  assert.equal(remapped.rows[0].description, "Coffee");
});

test("semicolon european", () => {
  const csv = "Date;Description;Amount\n14/09/2026;Cafe;-8,50\n";
  const p = parseCsvText(csv, "bank.csv");
  assert.equal(p.delimiter, ";");
  assert.equal(p.rows[0].date, "2026-09-14");
  assert.equal(p.rows[0].amount, -8.5);
});

test("backup parse", () => {
  const parsed = parseBackup({
    profile: { household: "single", dependents: 0, lifeStage: "student", housing: "rent", hasVehicle: false, monthlyIncome: 10, goals: ["track"] },
    categories: [{ id: "c1", slug: "food", name: "Food", kind: "expense", plannedMonthly: 40 }],
    transactions: [{ id: "t1", date: "2026-09-01", description: "x", merchantKey: "X", amount: -4, sourceLabel: "a", fingerprint: "f", categoryId: "c1", userSet: true, notes: "" }],
    merchantRules: [],
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.transactions.length, 1);
    assert.equal(parsed.data.transactions[0].excluded, false);
    assert.equal(parsed.data.transactions[0].status, "posted");
    assert.equal(parsed.data.profile.budgetPeriod, "month");
  }
});

test("week keys are ISO", async () => {
  const { weekKeyFromDate, weekStartFromKey } = await import("./parse-date.ts");
  assert.equal(weekKeyFromDate("2026-09-14"), "2026-W38");
  assert.equal(weekStartFromKey("2026-W38"), "2026-09-14");
});

test("excluded and transfers skip cashflow", async () => {
  const { monthCash } = await import("./totals.ts");
  const cats = [
    { id: "food", slug: "food", name: "Food", kind: "expense" as const, plannedMonthly: 100 },
    { id: "pay", slug: "paycheck", name: "Pay", kind: "income" as const, plannedMonthly: 1000 },
  ];
  const base = {
    description: "x",
    merchantKey: "X",
    sourceLabel: "t",
    userSet: false,
    notes: "",
    categoryId: "food" as string | null,
  };
  const txs = [
    { ...base, id: "1", date: "2026-09-01", amount: -40, fingerprint: "1", excluded: false, status: "posted" as const },
    { ...base, id: "2", date: "2026-09-02", amount: -12, fingerprint: "2", excluded: true, status: "posted" as const },
    { ...base, id: "3", date: "2026-09-03", amount: -200, fingerprint: "3", excluded: false, status: "transfer" as const },
    { ...base, id: "4", date: "2026-09-04", amount: 12, fingerprint: "4", excluded: false, status: "refund" as const, description: "refund" },
  ];
  const cash = monthCash(txs, "2026-09", cats);
  assert.equal(cash.expenses, 28);
  assert.equal(cash.excluded, 1);
  assert.equal(cash.transfers, 1);
  assert.equal(cash.refunds, 1);
});
