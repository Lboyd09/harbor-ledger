import { monthsInclusive, withMonthlyChange } from "./buckets.ts";
import { expectedMonthlyOf } from "./income.ts";
import { newId } from "./ids.ts";
import { roundMoney, roundPlan } from "./money.ts";
import { currentMonthKey } from "./parse-date.ts";
import { ageInYear, birthYearFromAge } from "./planner.ts";
import { buildPresetCategories, DEFAULT_PROFILE, defaultBuckets, SPEND_BUCKETS } from "./presets.ts";
import { withBudgetStyle } from "./style.ts";
import type {
  Account,
  AccountKind,
  BalancePoint,
  BudgetGoal,
  BudgetStyle,
  Category,
  Household,
  Housing,
  IncomeCadence,
  IncomeStream,
  LedgerSnapshot,
  LifeStage,
  MoneyBucket,
  Profile,
} from "./types.ts";

export type HouseholdChoice = "just-me" | "partner" | "kids";
export type WorkChoice = "student" | "working" | "retired";

export type SetupIncome = {
  id: string;
  name: string;
  amount: number;
  cadence: IncomeCadence;
  /** Words the bank shows on the deposit. Commas separate more than one. */
  depositWords: string;
};

export type SetupAccountDraft = {
  id: string;
  kind: AccountKind;
  name: string;
  institution: string;
  /** Empty means no balance yet. A credit card number is what is owed, still positive here. */
  balance: number | null;
  balanceId: string;
};

export type SetupSavingsDraft = {
  id: string;
  name: string;
  target: number;
  /** YYYY-MM, or null when no date was picked. */
  by: string | null;
};

export type SetupAnswers = {
  householdChoice: HouseholdChoice;
  dependents: number;
  work: WorkChoice;
  /** Kept so "working" does not wipe established or parent. */
  keptLifeStage: LifeStage | null;
  /** Kept so kids do not wipe partnered or married. */
  keptHousehold: Household | null;
  housing: Housing;
  housingAmount: number | null;
  hasVehicle: boolean;
  usesTransit: boolean;
  hasPets: boolean;
  payingDebt: boolean;
  savingUp: boolean;
  keptGoals: BudgetGoal[];
  categorySlugs: string[];
  categoriesTouched: boolean;
  customCategories: { slug: string; name: string }[];
  income: SetupIncome[];
  incomeUnknown: boolean;
  budgetStyle: BudgetStyle | null;
  keptCarryStartMonth: string | null;
  amounts: Record<string, number>;
  amountsTouched: boolean;
  accounts: SetupAccountDraft[];
  savings: SetupSavingsDraft | null;
  /** Optional. Skip stores null. A number becomes profile.birthYear. */
  age: number | null;
};

/** Profile fields collected in steps 1 to 4. Housing amount is not stored on the profile. */
export type SetupProfileFields = Pick<
  Profile,
  | "household"
  | "dependents"
  | "lifeStage"
  | "housing"
  | "hasVehicle"
  | "usesTransit"
  | "hasPets"
  | "goals"
  | "monthlyIncome"
  | "incomeStreams"
  | "buckets"
  | "carryStartMonth"
> & { budgetStyle?: BudgetStyle };

export type SetupExtras = {
  accounts?: Account[];
  balances?: BalancePoint[];
  savingsPlans?: MoneyBucket[];
};

export const CATEGORY_GROUPS: { title: string; slugs: string[] }[] = [
  { title: "Home", slugs: ["housing", "utilities"] },
  { title: "Food", slugs: ["food", "dining"] },
  { title: "Getting around", slugs: ["gas", "transport"] },
  { title: "Everyday", slugs: ["personal", "health", "subscriptions", "entertainment", "travel", "other"] },
  { title: "Family", slugs: ["childcare", "pets", "education"] },
  { title: "Money", slugs: ["giving", "debt", "savings", "transfers-out"] },
];

const OTHER_HINT = "Anything else you pay for";

export function categoryHint(slug: string): string {
  return SPEND_BUCKETS.find((b) => b.slug === slug)?.hint ?? (slug === "other" ? OTHER_HINT : "");
}

export function categoryLabel(slug: string, housing: Housing, splitDining: boolean): string {
  const def = SPEND_BUCKETS.find((b) => b.slug === slug);
  if (!def) return slug === "other" ? "Other" : slug;
  if (slug === "food" && splitDining) return "Groceries";
  if (slug === "housing" && housing === "own") return "Mortgage / housing";
  if (slug === "housing" && housing === "rent") return "Rent / housing";
  return def.label;
}

export function blankAnswers(): SetupAnswers {
  return {
    householdChoice: "just-me",
    dependents: 1,
    work: "working",
    keptLifeStage: null,
    keptHousehold: null,
    housing: "rent",
    housingAmount: null,
    hasVehicle: false,
    usesTransit: false,
    hasPets: false,
    payingDebt: false,
    savingUp: false,
    keptGoals: ["track"],
    categorySlugs: [],
    categoriesTouched: false,
    customCategories: [],
    income: [{ id: "income_paycheck", name: "Paycheck", amount: 0, cadence: "monthly", depositWords: "" }],
    incomeUnknown: false,
    budgetStyle: null,
    keptCarryStartMonth: null,
    amounts: {},
    amountsTouched: false,
    accounts: [],
    savings: null,
    age: null,
  };
}

function dedupe(slugs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const slug of slugs) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

function monthOf(today?: string): string {
  if (today && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today.slice(0, 7);
  if (today && /^\d{4}-\d{2}$/.test(today)) return today;
  return currentMonthKey();
}

function dayOf(today?: string): string {
  if (today && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function hintsOf(words: string): string[] {
  return words
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function streamFromDraft(draft: SetupIncome, index: number): IncomeStream {
  return {
    id: draft.id || `income_${index + 1}`,
    name: draft.name.trim() || (index === 0 ? "Paycheck" : `Income ${index + 1}`),
    amount: Math.max(0, Number(draft.amount) || 0),
    cadence: draft.cadence,
    matchHints: hintsOf(draft.depositWords),
  };
}

export function answersToProfile(answers: SetupAnswers, options?: { today?: string }): SetupProfileFields {
  const dependents = answers.householdChoice === "kids" ? Math.max(1, Math.round(Number(answers.dependents) || 1)) : 0;
  let household: Household = "single";
  if (answers.householdChoice === "partner") household = answers.keptHousehold === "married" ? "married" : "partnered";
  else if (answers.householdChoice === "kids" && (answers.keptHousehold === "partnered" || answers.keptHousehold === "married")) {
    household = answers.keptHousehold;
  }

  let lifeStage: LifeStage = "early-career";
  if (answers.work === "student") lifeStage = "student";
  else if (answers.work === "retired") lifeStage = "retired";
  else if (answers.keptLifeStage === "established" || answers.keptLifeStage === "parent") lifeStage = answers.keptLifeStage;

  const goals: BudgetGoal[] = ["track"];
  if (answers.payingDebt) goals.push("debt");
  if (answers.savingUp) {
    goals.push("purchase");
    if (answers.keptGoals.includes("save")) goals.push("save");
  }
  if (answers.keptGoals.includes("live-within")) goals.push("live-within");

  const incomeStreams = answers.incomeUnknown ? [] : answers.income.map(streamFromDraft);
  const monthlyIncome = roundMoney(incomeStreams.reduce((sum, stream) => sum + expectedMonthlyOf(stream), 0));
  const buckets = answers.categoriesTouched
    ? dedupe(answers.categorySlugs)
    : defaultBuckets({ housing: answers.housing, hasVehicle: answers.hasVehicle, usesTransit: answers.usesTransit, hasPets: answers.hasPets, lifeStage, dependents, goals });

  let budgetStyle: BudgetStyle | undefined;
  let carryStartMonth = answers.keptCarryStartMonth && /^\d{4}-\d{2}$/.test(answers.keptCarryStartMonth) ? answers.keptCarryStartMonth : null;
  if (answers.budgetStyle) {
    const styled = withBudgetStyle(
      {
        household,
        dependents,
        lifeStage,
        housing: answers.housing,
        hasVehicle: answers.hasVehicle,
        usesTransit: answers.usesTransit,
        hasPets: answers.hasPets,
        monthlyIncome,
        incomeStreams,
        buckets,
        goals,
        ledgerName: "",
        completedOnboarding: false,
        budgetPeriod: "month",
        carryStartMonth,
      },
      answers.budgetStyle,
      { today: monthOf(options?.today) },
    );
    budgetStyle = styled.budgetStyle;
    carryStartMonth = styled.carryStartMonth ?? null;
  }

  return {
    household,
    dependents,
    lifeStage,
    housing: answers.housing,
    hasVehicle: answers.hasVehicle,
    usesTransit: answers.usesTransit,
    hasPets: answers.hasPets,
    goals,
    monthlyIncome,
    incomeStreams,
    buckets,
    budgetStyle,
    carryStartMonth,
  };
}

export function suggestedCategorySlugs(answers: SetupAnswers): string[] {
  return answersToProfile({ ...answers, categoriesTouched: false }).buckets;
}

export function selectedSlugs(answers: SetupAnswers): string[] {
  return answers.categoriesTouched ? dedupe(answers.categorySlugs) : suggestedCategorySlugs(answers);
}

function rateFor(slug: string): { rate: number; floor: number } | null {
  if (slug === "other") return { rate: 0.04, floor: 40 };
  const def = SPEND_BUCKETS.find((b) => b.slug === slug);
  return def ? { rate: def.rate, floor: def.floor } : null;
}

/** Suggested monthly amount for each chosen category. Housing uses the step 1 amount when they gave one. */
export function suggestAmounts(answers: SetupAnswers, expectedMonthlyIncome: number): Record<string, number> {
  const income = Math.max(0, expectedMonthlyIncome || 0);
  const amounts: Record<string, number> = {};
  for (const slug of selectedSlugs(answers)) {
    if (slug === "housing" && answers.housing !== "family" && answers.housingAmount != null && answers.housingAmount > 0) {
      amounts[slug] = roundMoney(answers.housingAmount);
      continue;
    }
    const rate = rateFor(slug);
    if (!rate) {
      amounts[slug] = 0;
      continue;
    }
    amounts[slug] = income > 0 ? roundPlan(income * rate.rate) : rate.floor;
  }
  return amounts;
}

/** Scales amounts down when the plan is over income. A zero income leaves the amounts alone. */
export function fitToIncome(amounts: Record<string, number>, income: number): Record<string, number> {
  const keys = Object.keys(amounts);
  const copy: Record<string, number> = {};
  for (const key of keys) copy[key] = roundMoney(Math.max(0, Number(amounts[key]) || 0));
  const total = roundMoney(keys.reduce((sum, key) => sum + copy[key], 0));
  if (!(income > 0) || total <= income + 0.001) return copy;
  const ratio = income / total;
  for (const key of keys) copy[key] = roundPlan(copy[key] * ratio);
  let sum = roundMoney(keys.reduce((s, key) => s + copy[key], 0));
  let guard = 0;
  while (sum > income + 0.001 && guard < 10000) {
    let biggest = keys[0] ?? "";
    for (const key of keys) if ((copy[key] ?? 0) > (copy[biggest] ?? 0)) biggest = key;
    if (!biggest || (copy[biggest] ?? 0) <= 0) break;
    const step = (copy[biggest] ?? 0) >= 20 ? 5 : 1;
    copy[biggest] = roundMoney(Math.max(0, (copy[biggest] ?? 0) - step));
    sum = roundMoney(keys.reduce((s, key) => s + copy[key], 0));
    guard += 1;
  }
  return copy;
}

/** About how much a month to reach a purchase by the chosen month. Null when there is no date. */
export function savingsPlanMonthly(target: number, by: string | null, startMonth: string): number | null {
  if (!(target > 0) || !by || !/^\d{4}-\d{2}$/.test(by) || !/^\d{4}-\d{2}$/.test(startMonth) || by < startMonth) return null;
  const span = monthsInclusive(startMonth, by);
  if (span <= 0) return null;
  return Math.ceil((target / span) * 100) / 100;
}

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "custom";
}

export function customSlug(name: string, taken: string[]): string {
  const base = `custom-${slugify(name)}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function amountsFor(answers: SetupAnswers, income: number): Record<string, number> {
  const suggested = suggestAmounts(answers, income);
  if (!answers.amountsTouched) return suggested;
  const slugs = new Set(selectedSlugs(answers));
  const next = { ...suggested };
  for (const [slug, amount] of Object.entries(answers.amounts)) {
    if (!slugs.has(slug) || !Number.isFinite(amount)) continue;
    next[slug] = roundMoney(Math.max(0, amount));
  }
  return next;
}

function linkStreams(streams: IncomeStream[], categories: Category[]): IncomeStream[] {
  const used = new Set<string>();
  return streams.map((stream, index) => {
    const name = stream.name.trim() || `Income ${index + 1}`;
    const cat = categories.find((c) => c.kind === "income" && c.name === name && !used.has(c.id));
    if (cat) used.add(cat.id);
    return { ...stream, name, categoryId: cat?.id ?? null };
  });
}

function normalizePlan(plan: MoneyBucket, activeMonth: string): MoneyBucket {
  const yearly = plan.yearly && plan.yearly > 0 ? plan.yearly : null;
  const monthly = yearly ? roundMoney(yearly / 12) : Math.max(0, plan.monthly || 0);
  const startMonth = /^\d{4}-\d{2}$/.test(plan.startMonth) ? plan.startMonth : activeMonth;
  return {
    id: plan.id || newId("bucket"),
    name: plan.name.trim(),
    monthly,
    yearly,
    categoryIds: plan.categoryIds ?? [],
    target: plan.target && plan.target > 0 ? plan.target : null,
    by: plan.by && /^\d{4}-\d{2}$/.test(plan.by) ? plan.by : null,
    startMonth,
    opening: Math.max(0, plan.opening || 0),
    fromGoalId: plan.fromGoalId ?? null,
    monthlyFrom: plan.monthlyFrom && /^\d{4}-\d{2}$/.test(plan.monthlyFrom) ? plan.monthlyFrom : startMonth,
    pastRates: plan.pastRates ?? [],
    paused: Boolean(plan.paused),
    pausedFrom: plan.pausedFrom ?? null,
    fullLine: plan.fullLine && plan.fullLine > 0 ? plan.fullLine : null,
    nudgeDismissedYm: plan.nudgeDismissedYm ?? null,
  };
}

export function buildSetup(
  answers: SetupAnswers,
  base?: Profile,
  options?: { today?: string },
): { profile: Profile; categories: Category[]; extras: SetupExtras } {
  const fields = answersToProfile(answers, options);
  const month = monthOf(options?.today);
  const day = dayOf(options?.today);
  const selected = new Set(fields.buckets);
  const streamsForPresets =
    fields.incomeStreams.length > 0
      ? fields.incomeStreams
      : [{ id: "income_none", name: "Paycheck", amount: 0, cadence: "monthly" as const, matchHints: [] }];
  const draft: Profile = {
    ...DEFAULT_PROFILE,
    ...(base ?? {}),
    ...fields,
    ledgerName: base?.ledgerName || "My ledger",
    budgetPeriod: base?.budgetPeriod || "month",
    incomeStreams: streamsForPresets,
    buckets: fields.buckets,
    completedOnboarding: true,
    budgetStyle: fields.budgetStyle ?? base?.budgetStyle ?? "monthly",
    carryStartMonth: fields.budgetStyle ? fields.carryStartMonth : (fields.carryStartMonth ?? base?.carryStartMonth ?? null),
    detail: base?.detail ?? "simple",
    detailChosen: true,
    monthlyIncome: fields.monthlyIncome,
  };
  const todayYear = Number((options?.today ?? "").slice(0, 4));
  if (answers.age != null && Number.isFinite(todayYear)) {
    const born = birthYearFromAge(answers.age, todayYear);
    if (born != null) draft.birthYear = born;
  } else if (answers.age == null) {
    delete draft.birthYear;
  }

  let categories = buildPresetCategories(draft);
  if (answers.incomeUnknown) {
    categories = categories.filter((c) => !(c.kind === "income" && (c.slug === "paycheck" || c.name === "Paycheck")));
  }
  if (!selected.has("other")) categories = categories.filter((c) => c.slug !== "other");

  const planned = amountsFor(answers, fields.monthlyIncome);
  categories = categories.map((category) => {
    if (category.kind !== "expense" || planned[category.slug] == null || !selected.has(category.slug)) return category;
    return { ...category, plannedMonthly: planned[category.slug] ?? 0 };
  });

  for (const custom of answers.customCategories) {
    if (!selected.has(custom.slug) || categories.some((c) => c.slug === custom.slug)) continue;
    categories.push({
      id: newId("cat"),
      slug: custom.slug,
      name: custom.name.trim() || "Custom",
      kind: "expense",
      plannedMonthly: planned[custom.slug] ?? 0,
    });
  }

  const incomeStreams = answers.incomeUnknown ? [] : linkStreams(fields.incomeStreams, categories);
  const profile: Profile = { ...draft, monthlyIncome: fields.monthlyIncome, incomeStreams };

  const accounts: Account[] = [];
  const balances: BalancePoint[] = [];
  for (const account of answers.accounts) {
    const name = account.name.trim();
    if (!name || !account.id) continue;
    accounts.push({
      id: account.id,
      name,
      kind: account.kind,
      institution: account.institution.trim() || null,
      createdAt: `${day}T00:00:00.000Z`,
    });
    if (account.balance != null && Number.isFinite(account.balance)) {
      const owed = account.kind === "credit" ? -Math.abs(account.balance) : account.balance;
      balances.push({
        id: account.balanceId || `bal_${account.id}`,
        accountId: account.id,
        date: day,
        amount: roundMoney(owed),
        source: "entered",
      });
    }
  }

  const savingsPlans: MoneyBucket[] = [];
  if (answers.savings && answers.savings.name.trim() && answers.savings.target > 0) {
    const by = answers.savings.by && /^\d{4}-\d{2}$/.test(answers.savings.by) ? answers.savings.by : null;
    const monthly = savingsPlanMonthly(answers.savings.target, by, month) ?? 0;
    savingsPlans.push(
      normalizePlan(
        {
          id: answers.savings.id || newId("bucket"),
          name: answers.savings.name.trim(),
          monthly,
          yearly: null,
          categoryIds: [],
          target: answers.savings.target,
          by,
          startMonth: month,
          opening: 0,
        },
        month,
      ),
    );
  }

  return { profile, categories, extras: { accounts, balances, savingsPlans } };
}

export function mergeAccounts(existing: Account[], incoming: Account[]): Account[] {
  const next = existing.map((account) => ({ ...account }));
  for (const account of incoming) {
    const name = account.name.trim();
    if (!account.id || !name) continue;
    const index = next.findIndex((row) => row.id === account.id);
    const saved = { ...account, name, institution: account.institution?.trim() || null };
    if (index >= 0) next[index] = { ...next[index], ...saved };
    else next.push(saved);
  }
  return next;
}

export function mergeBalances(existing: BalancePoint[], incoming: BalancePoint[]): BalancePoint[] {
  const next = existing.map((point) => ({ ...point }));
  for (const point of incoming) {
    if (!point.id || !point.accountId || !/^\d{4}-\d{2}-\d{2}$/.test(point.date)) continue;
    const byId = next.findIndex((row) => row.id === point.id);
    if (byId >= 0) {
      next[byId] = { ...next[byId], ...point };
      continue;
    }
    const same = next.findIndex((row) => row.accountId === point.accountId && row.date === point.date && row.source === point.source);
    if (same >= 0) next[same] = { ...next[same], amount: point.amount };
    else next.push({ ...point });
  }
  return next;
}

export function mergeSavingsPlans(existing: MoneyBucket[], incoming: MoneyBucket[], activeMonth: string): MoneyBucket[] {
  const next = existing.map((plan) => ({ ...plan }));
  const month = /^\d{4}-\d{2}$/.test(activeMonth) ? activeMonth : currentMonthKey();
  for (const plan of incoming) {
    const normalized = normalizePlan(plan, month);
    if (!normalized.name) continue;
    const index = next.findIndex((row) => row.id === normalized.id);
    if (index < 0) {
      next.push(normalized);
      continue;
    }
    const prev = next[index];
    if (!prev) continue;
    let updated: MoneyBucket = {
      ...prev,
      name: normalized.name,
      target: normalized.target,
      by: normalized.by,
      yearly: normalized.yearly,
    };
    if (normalized.monthly !== prev.monthly) {
      updated = { ...withMonthlyChange(updated, normalized.monthly, month), yearly: normalized.yearly };
    }
    next[index] = updated;
  }
  return next;
}

/** What completeSetup writes. One object, so the store can apply it in one update. */
export function isDemoLedger(state: {
  profile: { demo?: boolean; ledgerName?: string };
  debts?: { id: string }[];
  netWorth?: { id: string }[];
  imports?: { sourceLabel?: string | null; fileName?: string }[];
  moneyBuckets?: { id: string }[];
}): boolean {
  if (state.profile.demo) return true;
  if ((state.debts ?? []).some((debt) => debt.id === "debt_demo_card")) return true;
  if ((state.netWorth ?? []).some((point) => point.id.startsWith("nw_demo"))) return true;
  if ((state.imports ?? []).some((batch) => batch.fileName === "sample-demo.csv" || batch.sourceLabel === "Demo bank file")) return true;
  if ((state.moneyBuckets ?? []).some((bucket) => bucket.id === "bucket_demo_groceries")) return true;
  return state.profile.ledgerName === "Demo household";
}

export function applyCompleteSetup(
  state: LedgerSnapshot,
  profile: Profile,
  categories: Category[],
  extras?: SetupExtras,
): LedgerSnapshot {
  const demo = isDemoLedger(state);
  const idMap = new Map<string, string>();
  for (const old of state.categories) {
    const match = categories.find((c) => c.slug === old.slug) ?? categories.find((c) => c.name === old.name);
    if (match) idMap.set(old.id, match.id);
  }
  const known = new Set(categories.map((c) => c.id));
  const streamCategory = (id: string | null | undefined) => {
    if (!id) return null;
    if (known.has(id)) return id;
    return idMap.get(id) ?? null;
  };
  const keptBuckets = demo
    ? []
    : (state.moneyBuckets ?? []).map((bucket) => ({
        ...bucket,
        categoryIds: bucket.categoryIds.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id)),
      }));
  const moneyBuckets = mergeSavingsPlans(keptBuckets, extras?.savingsPlans ?? [], state.activeMonth);
  return {
    profile: {
      ...state.profile,
      ...profile,
      incomeStreams: (profile.incomeStreams ?? []).map((stream) => ({ ...stream, categoryId: streamCategory(stream.categoryId) })),
      completedOnboarding: true,
      detail: profile.detail ?? state.profile.detail ?? "simple",
      detailChosen: true,
      demo: false,
    },
    categories,
    transactions: demo
      ? []
      : state.transactions.map((tx) => ({
          ...tx,
          categoryId: tx.categoryId ? (idMap.get(tx.categoryId) ?? null) : null,
          splits: tx.splits?.map((part) => ({ ...part, categoryId: idMap.get(part.categoryId) ?? part.categoryId })) ?? null,
        })),
    merchantRules: demo
      ? []
      : state.merchantRules
          .map((rule) => ({ ...rule, categoryId: idMap.get(rule.categoryId) ?? "" }))
          .filter((rule) => rule.categoryId),
    imports: demo ? [] : state.imports,
    monthBudgets: demo ? [] : (state.monthBudgets ?? []),
    savingsGoals: demo ? [] : (state.savingsGoals ?? []),
    moneyBuckets,
    bucketMoves: demo ? [] : (state.bucketMoves ?? []),
    netWorth: demo ? [] : (state.netWorth ?? []),
    debts: demo ? [] : (state.debts ?? []),
    ira: state.ira,
    accounts: mergeAccounts(demo ? [] : (state.accounts ?? []), extras?.accounts ?? []),
    balances: mergeBalances(demo ? [] : (state.balances ?? []), extras?.balances ?? []),
    activeMonth: state.activeMonth,
    activeWeek: state.activeWeek,
    setAsides: demo ? [] : (state.setAsides ?? []),
  };
}

function wordsOf(hints: string[]): string {
  return hints.join(", ");
}

/** Prefill every step from a ledger that was already set up. */
export function answersFromLedger(input: {
  profile: Profile;
  categories: Category[];
  accounts: Account[];
  balances: BalancePoint[];
  moneyBuckets: MoneyBucket[];
  /** Calendar year used to turn a stored birth year back into an age. */
  year?: number;
}): SetupAnswers {
  const profile = input.profile;
  const householdChoice: HouseholdChoice =
    profile.dependents > 0 ? "kids" : profile.household === "partnered" || profile.household === "married" ? "partner" : "just-me";
  const work: WorkChoice = profile.lifeStage === "student" ? "student" : profile.lifeStage === "retired" ? "retired" : "working";
  const known = new Set<string>([...SPEND_BUCKETS.map((b) => b.slug), "other"]);
  const expenses = input.categories.filter((c) => c.kind === "expense" && !c.parentId);
  const categorySlugs = expenses.map((c) => c.slug);
  const customCategories = expenses
    .filter((c) => !known.has(c.slug))
    .map((c) => ({ slug: c.slug, name: c.name }));
  const housingCategory = expenses.find((c) => c.slug === "housing");
  const income =
    profile.incomeStreams?.length > 0
      ? profile.incomeStreams.map((stream) => ({
          id: stream.id,
          name: stream.name,
          amount: stream.amount,
          cadence: stream.cadence,
          depositWords: wordsOf(stream.matchHints ?? []),
        }))
      : blankAnswers().income;
  const amounts: Record<string, number> = {};
  for (const category of expenses) amounts[category.slug] = category.plannedMonthly;
  const plan =
    (input.moneyBuckets ?? []).find((bucket) => bucket.target && bucket.target > 0) ?? (input.moneyBuckets ?? [])[0] ?? null;
  const accounts = (input.accounts ?? []).map((account) => {
    const rows = (input.balances ?? []).filter((row) => row.accountId === account.id);
    const latest = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];
    const entered = [...rows].filter((row) => row.source === "entered").sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];
    const shown = latest ?? entered;
    const balance = shown == null ? null : account.kind === "credit" ? roundMoney(Math.abs(shown.amount)) : shown.amount;
    return {
      id: account.id,
      kind: account.kind,
      name: account.name,
      institution: account.institution ?? "",
      balance,
      balanceId: entered?.id || `bal_${account.id}`,
    };
  });
  return {
    householdChoice,
    dependents: Math.max(1, profile.dependents || 1),
    work,
    keptLifeStage: profile.lifeStage,
    keptHousehold: profile.household,
    housing: profile.housing,
    housingAmount: profile.housing !== "family" && housingCategory && housingCategory.plannedMonthly > 0 ? housingCategory.plannedMonthly : null,
    hasVehicle: profile.hasVehicle,
    usesTransit: profile.usesTransit,
    hasPets: profile.hasPets,
    payingDebt: profile.goals.includes("debt"),
    savingUp: profile.goals.includes("purchase") || profile.goals.includes("save"),
    keptGoals: profile.goals,
    categorySlugs,
    categoriesTouched: categorySlugs.length > 0,
    customCategories,
    income,
    incomeUnknown: profile.monthlyIncome <= 0 && (profile.incomeStreams ?? []).every((stream) => stream.amount <= 0),
    budgetStyle: profile.budgetStyle === "buckets" ? "buckets" : profile.budgetStyle === "monthly" ? "monthly" : null,
    keptCarryStartMonth: profile.carryStartMonth ?? null,
    amounts,
    amountsTouched: expenses.length > 0,
    accounts,
    savings: plan
      ? { id: plan.id, name: plan.name, target: plan.target && plan.target > 0 ? plan.target : 0, by: plan.by }
      : null,
    age: input.year != null ? ageInYear(profile.birthYear, input.year) : null,
  };
}

export function householdSentence(answers: SetupAnswers): string {
  const count = Math.max(1, Math.round(answers.dependents || 1));
  const who =
    answers.householdChoice === "just-me"
      ? "Just you"
      : answers.householdChoice === "partner"
        ? "You and your partner"
        : `You, with ${count} ${count === 1 ? "child" : "kids"} at home`;
  const work = answers.work === "student" ? "You are a student" : answers.work === "retired" ? "You are retired" : "You are working";
  const house =
    answers.housing === "rent" ? "You rent" : answers.housing === "own" ? "You own and pay a mortgage" : "Someone else covers housing";
  return `${who}. ${work}. ${house}.`;
}
