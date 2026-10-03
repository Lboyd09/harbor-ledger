import assert from "node:assert/strict";
import { test } from "node:test";
import { emptySnapshot } from "./normalize.ts";
import {
  answersFromLedger,
  answersToProfile,
  applyCompleteSetup,
  blankAnswers,
  buildSetup,
  fitToIncome,
  savingsPlanMonthly,
  suggestAmounts,
  suggestedCategorySlugs,
  type SetupAnswers,
} from "./onboarding-plan.ts";
import { roundPlan } from "./money.ts";
import { DEFAULT_PROFILE } from "./presets.ts";
import type { Category, Transaction } from "./types.ts";

function answers(patch: Partial<SetupAnswers> = {}): SetupAnswers {
  return { ...blankAnswers(), ...patch };
}

function slugs(patch: Partial<SetupAnswers> = {}): string[] {
  return suggestedCategorySlugs(answers(patch));
}

test("answersToProfile maps household, work, housing, and the yes or no chips", () => {
  const just = answersToProfile(answers({ householdChoice: "just-me", work: "working", housing: "rent" }));
  assert.equal(just.household, "single");
  assert.equal(just.dependents, 0);
  assert.equal(just.lifeStage, "early-career");
  assert.equal(just.housing, "rent");

  const partner = answersToProfile(answers({ householdChoice: "partner" }));
  assert.equal(partner.household, "partnered");
  assert.equal(partner.dependents, 0);
  const married = answersToProfile(answers({ householdChoice: "partner", keptHousehold: "married" }));
  assert.equal(married.household, "married");

  const kids = answersToProfile(answers({ householdChoice: "kids", dependents: 3, work: "student", housing: "own" }));
  assert.equal(kids.household, "single");
  assert.equal(kids.dependents, 3);
  assert.equal(kids.lifeStage, "student");
  assert.equal(kids.housing, "own");
  const kidsPartner = answersToProfile(answers({ householdChoice: "kids", dependents: 2, keptHousehold: "partnered" }));
  assert.equal(kidsPartner.household, "partnered");
  assert.equal(kidsPartner.dependents, 2);

  assert.equal(answersToProfile(answers({ work: "retired", housing: "family" })).lifeStage, "retired");
  assert.equal(answersToProfile(answers({ work: "retired", housing: "family" })).housing, "family");
  assert.equal(
    answersToProfile(answers({ work: "working", keptLifeStage: "established" })).lifeStage,
    "established",
  );
  assert.equal(answersToProfile(answers({ work: "student", keptLifeStage: "established" })).lifeStage, "student");

  const chips = answersToProfile(
    answers({ hasVehicle: true, usesTransit: true, hasPets: true, payingDebt: true, savingUp: true, keptGoals: ["track", "save"] }),
  );
  assert.equal(chips.hasVehicle, true);
  assert.equal(chips.usesTransit, true);
  assert.equal(chips.hasPets, true);
  assert.deepEqual(chips.goals, ["track", "debt", "purchase", "save"]);
  assert.equal(answersToProfile(answers()).goals.includes("debt"), false);
});

test("suggestedCategorySlugs follows housing, car, transit, pet, kids, and debt", () => {
  const rent = slugs({ housing: "rent" });
  const own = slugs({ housing: "own", hasVehicle: true });
  const family = slugs({ housing: "family" });
  assert.ok(rent.includes("housing"));
  assert.ok(rent.includes("utilities"));
  assert.equal(rent.includes("gas"), false);
  assert.ok(rent.includes("transport"));
  assert.ok(own.includes("housing"));
  assert.ok(own.includes("gas"));
  assert.ok(own.includes("transport"));
  assert.equal(family.includes("housing"), false);
  assert.equal(family.includes("utilities"), false);
  assert.ok(family.includes("transport"));

  assert.deepEqual(slugs({ usesTransit: true }), slugs({ usesTransit: false }));
  assert.ok(slugs({ hasPets: true }).includes("pets"));
  assert.equal(slugs({ hasPets: false }).includes("pets"), false);
  assert.ok(slugs({ householdChoice: "kids", dependents: 2 }).includes("childcare"));
  assert.equal(slugs({ householdChoice: "just-me" }).includes("childcare"), false);
  assert.ok(slugs({ payingDebt: true }).includes("debt"));
  assert.equal(slugs({ payingDebt: false }).includes("debt"), false);
  assert.ok(slugs({ savingUp: true }).includes("savings"));
  assert.ok(slugs({ work: "student" }).includes("education"));
  assert.ok(rent.includes("other"));
});

test("suggestAmounts uses a housing override, and fitToIncome never goes over income", () => {
  const picked = answers({
    housing: "rent",
    housingAmount: 1400,
    categoriesTouched: true,
    categorySlugs: ["housing", "food"],
    income: [{ id: "income_paycheck", name: "Paycheck", amount: 4000, cadence: "monthly", depositWords: "" }],
  });
  const amounts = suggestAmounts(picked, 4000);
  assert.equal(amounts.housing, 1400);
  assert.equal(amounts.food, roundPlan(4000 * 0.08));

  const floors = suggestAmounts(
    answers({ housing: "rent", categoriesTouched: true, categorySlugs: ["housing"], incomeUnknown: true }),
    0,
  );
  assert.equal(floors.housing, 800);

  const fitted = fitToIncome({ housing: 3000, food: 2000 }, 4000);
  const sum = Object.values(fitted).reduce((total, amount) => total + amount, 0);
  assert.ok(sum <= 4000);
  assert.ok(sum > 0);
  assert.equal(fitToIncome({ food: 100 }, 4000).food, 100);
  assert.equal(fitToIncome({ housing: 800 }, 0).housing, 800);
});

test("every cadence feeds the monthly total and each stream links to its income category", () => {
  const income = [
    { id: "w", name: "Weekly", amount: 12, cadence: "weekly" as const, depositWords: "ACME" },
    { id: "b", name: "Biweekly", amount: 6, cadence: "biweekly" as const, depositWords: "" },
    { id: "t", name: "Twice", amount: 10, cadence: "twice-monthly" as const, depositWords: "SHIFT" },
    { id: "m", name: "Monthly", amount: 9, cadence: "monthly" as const, depositWords: "" },
    { id: "i", name: "Varies", amount: 7, cadence: "irregular" as const, depositWords: "BONUS, GIFT" },
  ];
  const fields = answersToProfile(answers({ income, budgetStyle: "monthly" }), { today: "2026-10-03" });
  assert.equal(fields.monthlyIncome, 52 + 13 + 20 + 9 + 7);
  assert.deepEqual(fields.incomeStreams[0]?.matchHints, ["ACME"]);
  assert.deepEqual(fields.incomeStreams[4]?.matchHints, ["BONUS", "GIFT"]);

  const built = buildSetup(answers({ income, budgetStyle: "monthly", housing: "rent" }), DEFAULT_PROFILE, { today: "2026-10-03" });
  for (const stream of built.profile.incomeStreams) {
    const category = built.categories.find((c) => c.id === stream.categoryId);
    assert.equal(category?.kind, "income");
    assert.equal(category?.name, stream.name);
  }
  assert.equal(built.profile.incomeStreams.length, 5);
});

test("carry-over sets the start month and starting fresh does not clear one already saved", () => {
  const carry = answersToProfile(answers({ budgetStyle: "buckets" }), { today: "2026-10-03" });
  assert.equal(carry.budgetStyle, "buckets");
  assert.equal(carry.carryStartMonth, "2026-10");

  const fresh = answersToProfile(answers({ budgetStyle: "monthly" }), { today: "2026-10-03" });
  assert.equal(fresh.budgetStyle, "monthly");
  assert.equal(fresh.carryStartMonth, null);

  const kept = answersToProfile(answers({ budgetStyle: "monthly", keptCarryStartMonth: "2026-04" }), { today: "2026-10-03" });
  assert.equal(kept.budgetStyle, "monthly");
  assert.equal(kept.carryStartMonth, "2026-04");
});

test("completeSetup extras apply once and a second run does not duplicate them", () => {
  const built = buildSetup(
    answers({
      budgetStyle: "monthly",
      income: [{ id: "income_paycheck", name: "Paycheck", amount: 3000, cadence: "monthly", depositWords: "ACME" }],
      accounts: [
        { id: "acct_checking", kind: "checking", name: "Checking", institution: "Chase", balance: 250, balanceId: "bal_checking" },
        { id: "acct_card", kind: "credit", name: "Credit card", institution: "", balance: 80, balanceId: "bal_card" },
      ],
      savings: { id: "plan_trip", name: "Trip", target: 1200, by: "2027-04" },
    }),
    DEFAULT_PROFILE,
    { today: "2026-10-03" },
  );
  assert.equal(built.extras.balances?.find((b) => b.accountId === "acct_card")?.amount, -80);
  assert.equal(savingsPlanMonthly(1200, "2027-04", "2026-10"), built.extras.savingsPlans?.[0]?.monthly);

  const start = emptySnapshot();
  start.activeMonth = "2026-10";
  const once = applyCompleteSetup(start, built.profile, built.categories, built.extras);
  const twice = applyCompleteSetup(once, built.profile, built.categories, built.extras);
  assert.equal(once.accounts.length, 2);
  assert.equal(twice.accounts.length, 2);
  assert.equal(twice.balances.length, once.balances.length);
  assert.equal(twice.moneyBuckets.length, 1);
  assert.equal(twice.moneyBuckets[0]?.id, "plan_trip");
  assert.equal(twice.accounts[0]?.id, "acct_checking");
  assert.equal(twice.profile.completedOnboarding, true);

  const again = buildSetup(
    answersFromLedger({
      profile: twice.profile,
      categories: twice.categories,
      accounts: twice.accounts,
      balances: twice.balances,
      moneyBuckets: twice.moneyBuckets,
    }),
    twice.profile,
    { today: "2026-10-03" },
  );
  const third = applyCompleteSetup(twice, again.profile, again.categories, again.extras);
  assert.equal(third.accounts.length, 2);
  assert.equal(third.balances.length, twice.balances.length);
  assert.equal(third.moneyBuckets.length, 1);
  assert.equal(third.moneyBuckets[0]?.name, "Trip");
});

test("an old ledger keeps category links after setup", () => {
  const oldFood: Category = { id: "old_food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 40 };
  const tx: Transaction = {
    id: "t1",
    date: "2026-09-02",
    description: "Market",
    merchantKey: "MARKET",
    amount: -22,
    sourceLabel: "Chase",
    fingerprint: "t1",
    categoryId: "old_food",
    userSet: true,
    notes: "keep me",
    excluded: false,
    status: "posted",
  };
  const built = buildSetup(
    answers({
      budgetStyle: "buckets",
      categoriesTouched: true,
      categorySlugs: ["food", "dining"],
      income: [{ id: "income_paycheck", name: "Paycheck", amount: 2000, cadence: "monthly", depositWords: "" }],
    }),
    DEFAULT_PROFILE,
    { today: "2026-10-03" },
  );
  const start = emptySnapshot();
  start.categories = [oldFood];
  start.transactions = [tx];
  start.merchantRules = [{ merchantKey: "MARKET", categoryId: "old_food" }];
  start.activeMonth = "2026-10";
  const next = applyCompleteSetup(start, built.profile, built.categories, built.extras);
  const food = next.categories.find((c) => c.slug === "food");
  assert.ok(food);
  assert.notEqual(food?.id, "old_food");
  assert.equal(next.transactions[0]?.categoryId, food?.id);
  assert.equal(next.transactions[0]?.notes, "keep me");
  assert.equal(next.transactions[0]?.userSet, true);
  assert.equal(next.merchantRules[0]?.categoryId, food?.id);
  assert.equal(next.transactions.length, 1);
});
