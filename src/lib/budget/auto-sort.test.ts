import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accountHasActivity,
  createAccount,
  enteredBalanceAmount,
  nextAccountId,
  storedFileBalance,
  upsertFileBalance,
} from "./accounts.ts";
import { importNewRows, pairAccountTransfers, sortCharge } from "./auto-sort.ts";
import { parseBackup } from "./backup.ts";
import { parseCsvText } from "./csv.ts";
import { fingerprint } from "./fingerprint.ts";
import { merchantKey } from "./merchant.ts";
import { buildPresetCategories } from "./presets.ts";
import type { Category, IncomeStream, Profile, Transaction } from "./types.ts";

function profile(): Profile {
  return {
    ledgerName: "t",
    household: "single",
    dependents: 0,
    lifeStage: "early-career",
    housing: "rent",
    hasVehicle: true,
    usesTransit: true,
    hasPets: true,
    monthlyIncome: 4000,
    incomeStreams: [
      { id: "pay", name: "Paycheck", amount: 2000, cadence: "monthly", matchHints: ["northwind"], categoryId: null },
    ],
    buckets: [
      "housing",
      "food",
      "dining",
      "gas",
      "transport",
      "utilities",
      "personal",
      "health",
      "subscriptions",
      "entertainment",
      "giving",
      "education",
      "childcare",
      "pets",
      "travel",
      "debt",
    ],
    goals: ["track"],
    completedOnboarding: true,
    budgetPeriod: "month",
  };
}

function world() {
  const base = profile();
  const categories = buildPresetCategories(base);
  const pay = categories.find((c) => c.slug === "paycheck");
  assert.ok(pay);
  const streams: IncomeStream[] = [{ ...base.incomeStreams[0], categoryId: pay.id }];
  return { categories, streams, pay };
}

function slugOf(categories: Category[], id: string | null): string | null {
  if (!id) return null;
  return categories.find((c) => c.id === id)?.slug ?? null;
}

test("same transaction in two accounts is kept, and a repeat in one account is skipped", () => {
  const categories: Category[] = [
    { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 0 },
  ];
  const rows = [{ date: "2026-09-01", description: "CORNER MARKET", amount: -12.5 }];
  const first = importNewRows({
    rows,
    sourceLabel: "Chase",
    existing: [],
    categories,
    rules: [],
    accountId: "acct_chase",
    createId: () => "tx1",
  });
  assert.equal(first.added.length, 1);
  assert.equal(first.added[0].accountId, "acct_chase");
  const other = importNewRows({
    rows,
    sourceLabel: "Visa",
    existing: first.transactions,
    categories,
    rules: [],
    accountId: "acct_visa",
    createId: () => "tx2",
  });
  assert.equal(other.added.length, 1);
  assert.equal(other.transactions.filter((t) => t.fingerprint === first.added[0].fingerprint).length, 2);
  const again = importNewRows({
    rows,
    sourceLabel: "Chase",
    existing: other.transactions,
    categories,
    rules: [],
    accountId: "acct_chase",
    createId: () => "tx3",
  });
  assert.equal(again.added.length, 0);
  assert.equal(again.skipped, 1);
  const doubled = importNewRows({
    rows: [...rows, ...rows],
    sourceLabel: "Ally",
    existing: [],
    categories,
    rules: [],
    accountId: "acct_ally",
    createId: (() => {
      let n = 0;
      return () => `new_${n++}`;
    })(),
  });
  assert.equal(doubled.added.length, 1);
  assert.equal(doubled.skipped, 1);
});

test("a migrated accountId is skipped only when the re-import is that same account", () => {
  const categories: Category[] = [
    { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 0 },
  ];
  const description = "CORNER MARKET";
  const amount = -12.5;
  const date = "2026-09-01";
  const existing: Transaction[] = [
    {
      id: "old",
      date,
      description,
      merchantKey: merchantKey(description),
      amount,
      sourceLabel: "Chase",
      fingerprint: fingerprint(date, amount, description),
      categoryId: null,
      userSet: false,
      notes: "",
      excluded: false,
      status: "posted",
      accountId: "acct_chase",
    },
  ];
  const same = importNewRows({
    rows: [{ date, description, amount }],
    sourceLabel: "Chase",
    existing,
    categories,
    rules: [],
    accountId: "acct_chase",
    createId: () => "again",
  });
  assert.equal(same.added.length, 0);
  assert.equal(same.skipped, 1);
  const bare = importNewRows({
    rows: [{ date, description, amount }],
    sourceLabel: "Old",
    existing: [{ ...existing[0], accountId: null }],
    categories,
    rules: [],
    accountId: "acct_other",
    createId: () => "bare",
  });
  assert.equal(bare.added.length, 0);
});

test("balance column is detected and the latest date follows file order", () => {
  const newest = parseCsvText(
    `Date,Description,Amount,Balance
09/10/2026,Rent,-100,500.00
09/10/2026,Coffee,-4,600.00
09/01/2026,Pay,1000,700.00
`,
    "newest.csv",
  );
  assert.equal(newest.columns.find((c) => c.header === "Balance")?.role, "balance");
  assert.deepEqual(newest.endingBalance, { amount: 500, asOf: "2026-09-10" });

  const oldest = parseCsvText(
    `Date,Description,Amount,Running Bal.
09/01/2026,Pay,1000,700.00
09/10/2026,Coffee,-4,600.00
09/10/2026,Rent,-100,500.25
`,
    "oldest.csv",
  );
  assert.equal(oldest.columns.find((c) => c.header.startsWith("Running"))?.role, "balance");
  assert.deepEqual(oldest.endingBalance, { amount: 500.25, asOf: "2026-09-10" });

  const none = parseCsvText("Date,Description,Amount\n09/01/2026,Coffee,-4.00\n", "plain.csv");
  assert.equal(none.endingBalance, null);
  assert.equal(none.columns.some((c) => c.role === "balance"), false);
});

test("a credit file balance is stored negative and an entered card balance is what is owed", () => {
  assert.equal(storedFileBalance("credit", 640), -640);
  assert.equal(storedFileBalance("credit", -640), -640);
  assert.equal(storedFileBalance("checking", 640), 640);
  const saved = upsertFileBalance([], {
    accountId: "acct_card",
    date: "2026-09-18",
    amount: storedFileBalance("credit", 640),
  });
  assert.equal(saved[0].amount, -640);
  assert.equal(saved[0].source, "file");
  const replaced = upsertFileBalance(saved, {
    accountId: "acct_card",
    date: "2026-09-18",
    amount: -500,
  });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].amount, -500);
  assert.equal(enteredBalanceAmount("credit", 80), -80);
  assert.equal(enteredBalanceAmount("credit", -80), -80);
  assert.equal(enteredBalanceAmount("checking", 80), 80);
});

test("removeAccount refuses when a transaction or import points at the account", () => {
  assert.equal(accountHasActivity("acct_a", [{ accountId: "acct_a" }], []), true);
  assert.equal(accountHasActivity("acct_a", [], [{ accountId: "acct_a" }]), true);
  assert.equal(accountHasActivity("acct_a", [{ accountId: "acct_b" }], []), false);
  assert.equal(nextAccountId("Chase", []), "acct_chase");
  assert.equal(nextAccountId("Chase", ["acct_chase"]), "acct_chase-2");
  const made = createAccount([], { name: "Roth IRA", kind: "retirement" }, "2026-10-03T00:00:00.000Z");
  assert.equal(made?.id, "acct_roth-ira");
  assert.equal(made?.kind, "retirement");
});

test("income hint is sure, a near payroll deposit is likely, and an expense keyword does not claim a deposit", () => {
  const { categories, streams } = world();
  const hinted = sortCharge(
    { description: "NORTHWIND PAYROLL", amount: 500, merchantKey: merchantKey("NORTHWIND PAYROLL") },
    { categories, rules: [], incomeStreams: streams },
  );
  assert.equal(hinted.auto.source, "income");
  assert.equal(hinted.auto.confidence, "sure");
  assert.equal(hinted.categoryId, streams[0].categoryId);

  const near = sortCharge(
    { description: "GUSTO PAYROLL", amount: 1960, merchantKey: merchantKey("GUSTO PAYROLL") },
    { categories, rules: [], incomeStreams: streams },
  );
  assert.equal(near.auto.source, "income");
  assert.equal(near.auto.confidence, "likely");
  assert.equal(near.categoryId, null);
  assert.equal(near.auto.suggestedCategoryId, streams[0].categoryId);

  const deposit = sortCharge(
    { description: "KROGER", amount: 22, merchantKey: merchantKey("KROGER") },
    { categories, rules: [], incomeStreams: streams },
  );
  assert.equal(deposit.status, "refund");
  assert.notEqual(slugOf(categories, deposit.categoryId), "paycheck");
  assert.equal(categories.find((c) => c.id === deposit.categoryId)?.kind, "expense");
});

test("history agreement is sure and a conflict stays unsure with the most common suggestion", () => {
  const { categories } = world();
  const food = categories.find((c) => c.slug === "food");
  const dining = categories.find((c) => c.slug === "dining");
  assert.ok(food && dining);
  const agreed = sortCharge(
    { description: "CORNER MARKET", amount: -12, merchantKey: "CORNER MARKET" },
    {
      categories,
      rules: [],
      history: [
        { merchantKey: "CORNER MARKET", categoryId: food.id, userSet: true, date: "2026-07-02", amount: -8 },
        { merchantKey: "CORNER MARKET", categoryId: food.id, userSet: true, date: "2026-08-02", amount: -9 },
      ],
    },
  );
  assert.equal(agreed.auto.confidence, "sure");
  assert.equal(agreed.auto.source, "history");
  assert.equal(agreed.categoryId, food.id);

  const conflict = sortCharge(
    { description: "CORNER MARKET", amount: -12, merchantKey: "CORNER MARKET" },
    {
      categories,
      rules: [],
      history: [
        { merchantKey: "CORNER MARKET", categoryId: food.id, userSet: true, date: "2026-07-02", amount: -8 },
        { merchantKey: "CORNER MARKET", categoryId: food.id, userSet: true, date: "2026-08-02", amount: -9 },
        { merchantKey: "CORNER MARKET", categoryId: dining.id, userSet: true, date: "2026-09-02", amount: -11 },
      ],
    },
  );
  assert.equal(conflict.auto.confidence, "unsure");
  assert.equal(conflict.categoryId, null);
  assert.equal(conflict.auto.suggestedCategoryId, food.id);
});

test("a weak keyword is only a suggestion, a strong one is sure, and a missing category falls back or stays unsure", () => {
  const { categories } = world();
  const weak = sortCharge(
    { description: "TARGET STORE", amount: -40, merchantKey: merchantKey("TARGET STORE") },
    { categories, rules: [] },
  );
  assert.equal(weak.auto.confidence, "likely");
  assert.equal(weak.categoryId, null);
  assert.equal(slugOf(categories, weak.auto.suggestedCategoryId), "personal");

  const strong = sortCharge(
    { description: "SHELL OIL", amount: -32, merchantKey: merchantKey("SHELL OIL") },
    { categories, rules: [] },
  );
  assert.equal(strong.auto.confidence, "sure");
  assert.equal(slugOf(categories, strong.categoryId), "gas");

  const food = categories.find((c) => c.slug === "food");
  const other = categories.find((c) => c.slug === "other");
  assert.ok(food && other);
  const narrowed = [food, other];
  const fell = sortCharge(
    { description: "CHIPOTLE", amount: -14, merchantKey: merchantKey("CHIPOTLE") },
    { categories: narrowed, rules: [] },
  );
  assert.equal(fell.auto.confidence, "sure");
  assert.equal(fell.categoryId, food.id);
  const missing = sortCharge(
    { description: "TUITION PAYMENT", amount: -500, merchantKey: merchantKey("TUITION PAYMENT") },
    { categories: narrowed, rules: [] },
  );
  assert.equal(missing.auto.confidence, "unsure");
  assert.equal(missing.categoryId, null);
  assert.equal(missing.auto.suggestedCategoryId, other.id);
});

test("a transfer pairs across two accounts once per row", () => {
  const categories: Category[] = [
    { id: "out", slug: "transfers-out", name: "Transfers out", kind: "expense", plannedMonthly: 0 },
  ];
  const rows: Transaction[] = [
    {
      id: "a",
      date: "2026-09-01",
      description: "ONLINE TRANSFER TO SAVINGS",
      merchantKey: "ONLINE TRANSFER TO SAVINGS",
      amount: -100,
      sourceLabel: "Checking",
      fingerprint: "a",
      categoryId: null,
      userSet: false,
      notes: "",
      excluded: false,
      status: "posted",
      accountId: "acct_checking",
    },
    {
      id: "b",
      date: "2026-09-02",
      description: "TRANSFER FROM CHECKING",
      merchantKey: "TRANSFER FROM CHECKING",
      amount: 100,
      sourceLabel: "Savings",
      fingerprint: "b",
      categoryId: null,
      userSet: false,
      notes: "",
      excluded: false,
      status: "posted",
      accountId: "acct_savings",
    },
    {
      id: "c",
      date: "2026-09-02",
      description: "TRANSFER FROM CHECKING",
      merchantKey: "TRANSFER FROM CHECKING",
      amount: 100,
      sourceLabel: "Savings",
      fingerprint: "c",
      categoryId: null,
      userSet: false,
      notes: "",
      excluded: false,
      status: "posted",
      accountId: "acct_savings",
    },
  ];
  const paired = pairAccountTransfers(rows, new Set(["a"]), categories);
  const moved = paired.filter((t) => t.status === "transfer");
  assert.equal(moved.length, 2);
  assert.ok(moved.every((t) => t.auto?.confidence === "sure" && t.auto.source === "transfer"));
  assert.equal(paired.find((t) => t.id === "c")?.status, "posted");
});

test("a merchant seen for three months with no category stays unsure", () => {
  const categories: Category[] = [
    { id: "other", slug: "other", name: "Other", kind: "expense", plannedMonthly: 0 },
  ];
  const history = ["2026-06-02", "2026-07-02", "2026-08-02"].map((date) => ({
    merchantKey: "ACME WIDGETS",
    categoryId: null,
    userSet: false,
    date,
    amount: -15,
  }));
  const hit = sortCharge(
    { description: "ACME WIDGETS", amount: -15, merchantKey: "ACME WIDGETS", date: "2026-09-02" },
    { categories, rules: [], history },
  );
  assert.equal(hit.auto.source, "repeat");
  assert.equal(hit.auto.confidence, "unsure");
  assert.equal(hit.auto.suggestedCategoryId, null);
  assert.equal(hit.categoryId, null);
});

test("about 40 everyday descriptions sort to the expected category", () => {
  const cases: { description: string; amount: number; slug: string; confidence: "sure" | "likely" }[] = [
    { description: "DUKE ENERGY BILL", amount: -88, slug: "utilities", confidence: "sure" },
    { description: "VERIZON WIRELESS", amount: -75, slug: "utilities", confidence: "sure" },
    { description: "COMCAST CABLE", amount: -70, slug: "utilities", confidence: "sure" },
    { description: "NATIONAL GRID", amount: -64, slug: "utilities", confidence: "sure" },
    { description: "CRICKET WIRELESS", amount: -40, slug: "utilities", confidence: "sure" },
    { description: "GEICO AUTO", amount: -120, slug: "transport", confidence: "sure" },
    { description: "STATE FARM", amount: -140, slug: "transport", confidence: "sure" },
    { description: "FARMERS INS", amount: -95, slug: "transport", confidence: "sure" },
    { description: "NETFLIX.COM", amount: -15.49, slug: "subscriptions", confidence: "sure" },
    { description: "SPOTIFY USA", amount: -11.99, slug: "subscriptions", confidence: "sure" },
    { description: "ADOBE CREATIVE", amount: -54.99, slug: "subscriptions", confidence: "sure" },
    { description: "SLACK TECH", amount: -8, slug: "subscriptions", confidence: "sure" },
    { description: "SHELL OIL", amount: -41, slug: "gas", confidence: "sure" },
    { description: "CHEVRON", amount: -36, slug: "gas", confidence: "sure" },
    { description: "SHEETZ", amount: -28, slug: "gas", confidence: "sure" },
    { description: "COSTCO GAS", amount: -44, slug: "gas", confidence: "sure" },
    { description: "CVS/PHARMACY", amount: -12, slug: "health", confidence: "sure" },
    { description: "WALGREENS", amount: -9, slug: "health", confidence: "sure" },
    { description: "BLUE CROSS", amount: -210, slug: "health", confidence: "sure" },
    { description: "KROGER", amount: -62, slug: "food", confidence: "sure" },
    { description: "TRADER JOE'S", amount: -48, slug: "food", confidence: "sure" },
    { description: "PUBLIX", amount: -55, slug: "food", confidence: "sure" },
    { description: "HY-VEE", amount: -33, slug: "food", confidence: "sure" },
    { description: "CHIPOTLE", amount: -13, slug: "dining", confidence: "sure" },
    { description: "MCDONALD'S", amount: -8, slug: "dining", confidence: "sure" },
    { description: "STARBUCKS", amount: -6, slug: "dining", confidence: "sure" },
    { description: "DOORDASH", amount: -24, slug: "dining", confidence: "sure" },
    { description: "UBER TRIP", amount: -18, slug: "transport", confidence: "sure" },
    { description: "LYFT RIDE", amount: -16, slug: "transport", confidence: "sure" },
    { description: "EZPASS REPLENISH", amount: -25, slug: "transport", confidence: "sure" },
    { description: "FASTRAK", amount: -6, slug: "transport", confidence: "sure" },
    { description: "TUITION PAYMENT", amount: -500, slug: "education", confidence: "sure" },
    { description: "SCHOOL DISTRICT", amount: -40, slug: "education", confidence: "sure" },
    { description: "ATM FEE", amount: -3, slug: "other", confidence: "sure" },
    { description: "NSF FEE", amount: -35, slug: "other", confidence: "sure" },
    { description: "MAPLE RENT", amount: -1100, slug: "housing", confidence: "sure" },
    { description: "DELTA AIR", amount: -280, slug: "travel", confidence: "sure" },
    { description: "CHEWY.COM", amount: -42, slug: "pets", confidence: "sure" },
    { description: "KINDERCARE", amount: -800, slug: "childcare", confidence: "sure" },
    { description: "PLANET FITNESS", amount: -25, slug: "health", confidence: "sure" },
    { description: "WALMART", amount: -60, slug: "food", confidence: "likely" },
    { description: "TARGET", amount: -22, slug: "personal", confidence: "likely" },
    { description: "AMAZON MKTPL", amount: -19, slug: "personal", confidence: "likely" },
    { description: "COSTCO WHSE", amount: -110, slug: "food", confidence: "likely" },
  ];
  assert.ok(cases.length >= 40);
  const { categories } = world();
  for (const item of cases) {
    const sorted = sortCharge(
      { description: item.description, amount: item.amount, merchantKey: merchantKey(item.description) },
      { categories, rules: [] },
    );
    assert.equal(sorted.auto.confidence, item.confidence, item.description);
    if (item.confidence === "sure") {
      assert.equal(slugOf(categories, sorted.categoryId), item.slug, item.description);
    } else {
      assert.equal(sorted.categoryId, null, item.description);
      assert.equal(slugOf(categories, sorted.auto.suggestedCategoryId), item.slug, item.description);
    }
  }
});

test("an old backup without auto fields still restores", () => {
  const parsed = parseBackup({
    profile: {
      household: "single",
      dependents: 0,
      lifeStage: "student",
      housing: "rent",
      hasVehicle: false,
      monthlyIncome: 10,
      goals: ["track"],
    },
    categories: [{ id: "c1", slug: "food", name: "Food", kind: "expense", plannedMonthly: 40 }],
    transactions: [
      {
        id: "t1",
        date: "2026-09-01",
        description: "x",
        merchantKey: "X",
        amount: -4,
        sourceLabel: "a",
        fingerprint: "f",
        categoryId: "c1",
        userSet: true,
        notes: "",
      },
    ],
    merchantRules: [],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.data.transactions.length, 1);
  assert.equal(parsed.data.transactions[0].auto, undefined);
  assert.equal(parsed.data.transactions[0].categoryId, "c1");
});
