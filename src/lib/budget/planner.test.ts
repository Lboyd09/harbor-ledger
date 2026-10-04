import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeProfile } from "./normalize.ts";
import { answersFromLedger, blankAnswers, buildSetup } from "./onboarding-plan.ts";
import { ageInYear, birthYearFromAge, plannerFacts } from "./planner.ts";
import { DEFAULT_PROFILE } from "./presets.ts";
import type { Account, BalancePoint, Category, Transaction } from "./types.ts";

test("an old profile without a birth year still loads", () => {
  const loaded = normalizeProfile({ ledgerName: "Old", monthlyIncome: 10, completedOnboarding: true });
  assert.equal(loaded.birthYear, undefined);
  assert.equal(loaded.retireAge, undefined);
  assert.equal(loaded.plannerInflation, undefined);
  assert.equal(loaded.ledgerName, "Old");
  const kept = normalizeProfile({ ledgerName: "Aged", birthYear: 1990, retireAge: 65, plannerInflation: 0.02, withdrawalRate: 0.04 });
  assert.equal(kept.birthYear, 1990);
  assert.equal(kept.retireAge, 65);
  assert.equal(ageInYear(kept.birthYear, 2026), 36);
  assert.equal(birthYearFromAge(36, 2026), 1990);
});

test("setup stores a birth year from the age, and skip leaves it off", () => {
  const withAge = buildSetup({ ...blankAnswers(), age: 40 }, DEFAULT_PROFILE, { today: "2026-10-04" });
  assert.equal(withAge.profile.birthYear, 1986);
  const skipped = buildSetup({ ...blankAnswers(), age: null }, { ...DEFAULT_PROFILE, birthYear: 1980 }, { today: "2026-10-04" });
  assert.equal(skipped.profile.birthYear, undefined);
  const again = answersFromLedger({
    profile: withAge.profile,
    categories: withAge.categories,
    accounts: [],
    balances: [],
    moneyBuckets: [],
    year: 2026,
  });
  assert.equal(again.age, 40);
});

test("planner facts come from accounts and spending, not invented balances", () => {
  const categories: Category[] = [
    { id: "pay", slug: "paycheck", name: "Pay", kind: "income", plannedMonthly: 4000 },
    { id: "rent", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 1000 },
  ];
  const transactions: Transaction[] = [];
  for (const ym of ["2026-01", "2026-02", "2026-03"]) {
    transactions.push(
      {
        id: `in-${ym}`,
        date: `${ym}-02`,
        description: "PAYROLL",
        merchantKey: "PAYROLL",
        amount: 4000,
        sourceLabel: "Bank",
        fingerprint: `in-${ym}`,
        categoryId: "pay",
        userSet: true,
        notes: "",
        excluded: false,
        status: "posted",
      },
      {
        id: `out-${ym}`,
        date: `${ym}-03`,
        description: "RENT",
        merchantKey: "RENT",
        amount: -2000,
        sourceLabel: "Bank",
        fingerprint: `out-${ym}`,
        categoryId: "rent",
        userSet: true,
        notes: "",
        excluded: false,
        status: "posted",
      },
    );
  }
  const accounts: Account[] = [{ id: "ira", name: "IRA", kind: "retirement", createdAt: "2026-01-01" }];
  const balances: BalancePoint[] = [{ id: "b1", accountId: "ira", date: "2026-03-01", amount: 12000, source: "entered" }];
  const facts = plannerFacts({
    profile: { ...DEFAULT_PROFILE, monthlyIncome: 4000, birthYear: 1991 },
    accounts,
    balances,
    transactions,
    categories,
    year: 2026,
  });
  assert.equal(facts.age.value, 35);
  assert.equal(facts.age.source, "typed");
  assert.equal(facts.saved.value, 12000);
  assert.equal(facts.saved.source, "from your accounts");
  assert.equal(facts.incomeWantedYearly.source, "from your spending");
  assert.equal(facts.incomeWantedYearly.value, 2000 * 12 * 0.8);
  assert.equal(facts.saved.value != null && facts.incomeWantedYearly.value !== 0, true);
});
