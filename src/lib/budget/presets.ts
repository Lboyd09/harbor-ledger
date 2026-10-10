import { newId } from "./ids.ts";
import { expectedMonthlyOf } from "./income.ts";
import { roundPlan } from "./money.ts";
import type { BudgetGoal, Category, IncomeStream, Profile } from "./types.ts";

export const DEFAULT_PROFILE: Profile = {
  ledgerName: "",
  household: "single",
  dependents: 0,
  lifeStage: "early-career",
  housing: "rent",
  hasVehicle: true,
  usesTransit: false,
  hasPets: false,
  monthlyIncome: 0,
  incomeStreams: [{ id: "income_paycheck", name: "Paycheck", amount: 0, cadence: "monthly", matchHints: [] }],
  buckets: [],
  goals: ["track"],
  completedOnboarding: false,
  budgetPeriod: "month",
};

export type SpendBucket = {
  slug: string;
  label: string;
  hint: string;
  kind: "expense";
  rate: number;
  floor: number;
};

/** Fixed bills start fresh each month on a new budget. Existing budgets keep their own setting. */
export const FRESH_EACH_MONTH = new Set(["housing", "utilities", "subscriptions", "debt"]);

export const SPEND_BUCKETS: SpendBucket[] = [
  { slug: "housing", label: "Rent or mortgage", hint: "Skip if you do not pay housing", kind: "expense", rate: 0.3, floor: 800 },
  { slug: "food", label: "Groceries", hint: "Stores. Restaurants can be separate.", kind: "expense", rate: 0.08, floor: 160 },
  { slug: "dining", label: "Eating out", hint: "Keep restaurants off groceries", kind: "expense", rate: 0.04, floor: 60 },
  { slug: "gas", label: "Gas", hint: "If you drive", kind: "expense", rate: 0.06, floor: 90 },
  { slug: "transport", label: "Car, transit, parking, insurance", hint: "Everything that is not gas", kind: "expense", rate: 0.05, floor: 60 },
  { slug: "utilities", label: "Utilities, phone, internet", hint: "Skip if family covers these", kind: "expense", rate: 0.06, floor: 80 },
  { slug: "personal", label: "Personal and household", hint: "Amazon, Target, haircuts, supplies", kind: "expense", rate: 0.06, floor: 60 },
  { slug: "health", label: "Health and medical", hint: "Pharmacy, copays, dental", kind: "expense", rate: 0.03, floor: 20 },
  { slug: "subscriptions", label: "Subscriptions", hint: "Streaming, software, memberships", kind: "expense", rate: 0.02, floor: 20 },
  { slug: "entertainment", label: "Entertainment", hint: "Tickets, games, going out", kind: "expense", rate: 0.04, floor: 40 },
  { slug: "giving", label: "Giving and gifts", hint: "Church, donations, presents", kind: "expense", rate: 0.03, floor: 20 },
  { slug: "education", label: "Education", hint: "Tuition, books, courses", kind: "expense", rate: 0.08, floor: 50 },
  { slug: "childcare", label: "Kids and childcare", hint: "Daycare, activities", kind: "expense", rate: 0.1, floor: 200 },
  { slug: "pets", label: "Pets", hint: "Food, vet, supplies", kind: "expense", rate: 0.03, floor: 40 },
  { slug: "travel", label: "Travel", hint: "Flights, hotels, trips", kind: "expense", rate: 0.04, floor: 50 },
  { slug: "debt", label: "Debt payments", hint: "Loans, cards, buy-now-pay-later", kind: "expense", rate: 0.12, floor: 150 },
  { slug: "savings", label: "Savings transfers", hint: "What you move aside on purpose", kind: "expense", rate: 0.12, floor: 100 },
  { slug: "transfers-out", label: "Transfers out", hint: "Venmo, Zelle, cash to other people", kind: "expense", rate: 0.04, floor: 40 },
  { slug: "cash", label: "Cash", hint: "ATM withdrawals", kind: "expense", rate: 0.02, floor: 20 },
];

export function defaultBuckets(profile: Pick<Profile, "housing" | "hasVehicle" | "usesTransit" | "hasPets" | "lifeStage" | "dependents" | "goals">): string[] {
  const set = new Set<string>(["food", "dining", "personal", "health", "subscriptions", "entertainment", "giving", "transfers-out", "other"]);
  if (profile.housing === "rent" || profile.housing === "own") set.add("housing");
  if (profile.housing !== "family") set.add("utilities");
  if (profile.hasVehicle) {
    set.add("gas");
    set.add("transport");
  } else {
    set.add("transport");
  }
  if (profile.hasPets) set.add("pets");
  if (profile.lifeStage === "student") set.add("education");
  if (profile.dependents > 0 || profile.lifeStage === "parent") set.add("childcare");
  if (profile.goals.includes("debt")) set.add("debt");
  if (profile.goals.includes("save") || profile.goals.includes("purchase")) set.add("savings");
  return SPEND_BUCKETS.map((b) => b.slug).filter((s) => set.has(s)).concat(["other"]);
}

function slugify(name: string, fallback: string) {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}

function incomeSlug(stream: IncomeStream, index: number): string {
  const n = stream.name.toLowerCase();
  if (index === 0 || /pay|salary|wage|job/.test(n)) return "paycheck";
  if (/side|freelance|gig|contract/.test(n)) return "side-work";
  if (/transfer/.test(n)) return "transfers-in";
  return slugify(stream.name, `income-${index + 1}`);
}

export function buildPresetCategories(profile: Profile): Category[] {
  const i = Math.max(0, profile.monthlyIncome || 0);
  const p = (rate: number, floor: number) => (i > 0 ? roundPlan(i * rate) : floor);
  const drafts: { slug: string; name: string; kind: "income" | "expense"; planned: number }[] = [];
  const used = new Set<string>();

  const streams: IncomeStream[] =
    profile.incomeStreams?.length > 0
      ? profile.incomeStreams
      : [{ id: "income_paycheck", name: "Paycheck", amount: i, cadence: "monthly", matchHints: [] }];

  streams.forEach((stream, index) => {
    let slug = incomeSlug(stream, index);
    if (used.has(slug)) slug = `${slug}-${index + 1}`;
    used.add(slug);
    const monthly = expectedMonthlyOf(stream);
    drafts.push({
      slug,
      name: stream.name.trim() || `Income ${index + 1}`,
      kind: "income",
      planned: monthly > 0 ? roundPlan(monthly) : 0,
    });
  });

  if (!used.has("transfers-in")) {
    drafts.push({ slug: "transfers-in", name: "Transfers in", kind: "income", planned: 0 });
  }
  if (!used.has("other-income")) {
    drafts.push({ slug: "other-income", name: "Other income", kind: "income", planned: 0 });
  }

  const buckets = profile.buckets?.length ? profile.buckets : defaultBuckets(profile);
  const splitDining = buckets.includes("dining");

  for (const slug of buckets) {
    if (slug === "other") continue;
    const def = SPEND_BUCKETS.find((b) => b.slug === slug);
    if (!def) continue;
    let name = def.label;
    if (slug === "food" && splitDining) name = "Groceries";
    if (slug === "housing" && profile.housing === "own") name = "Mortgage / housing";
    if (slug === "housing" && profile.housing === "rent") name = "Rent / housing";
    drafts.push({ slug, name, kind: "expense", planned: p(def.rate, def.floor) });
  }

  drafts.push({ slug: "other", name: "Other", kind: "expense", planned: p(0.04, 40) });

  return drafts.map((d) => ({
    id: newId("cat"),
    slug: d.slug,
    name: d.name,
    kind: d.kind,
    plannedMonthly: d.planned,
    ...(d.kind === "expense" && FRESH_EACH_MONTH.has(d.slug) ? { carry: false as const } : {}),
  }));
}

export const GOAL_LABELS: Record<BudgetGoal, string> = {
  track: "See where money actually goes",
  save: "Build savings",
  debt: "Pay down debt",
  purchase: "Save for a specific purchase",
  "live-within": "Stay inside a monthly ceiling",
};

export const STAGE_LABELS: Record<Profile["lifeStage"], string> = {
  student: "Student",
  "early-career": "Early career",
  established: "Established work",
  parent: "Parent / caregiver",
  retired: "Retired",
};

export const HOUSEHOLD_LABELS: Record<Profile["household"], string> = {
  single: "Single",
  partnered: "Partnered",
  married: "Married",
};

export const HOUSING_LABELS: Record<Profile["housing"], string> = {
  family: "Living with family (little or no rent)",
  rent: "Renting",
  own: "Own / paying a mortgage",
};
