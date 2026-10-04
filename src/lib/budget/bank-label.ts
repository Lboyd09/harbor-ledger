import type { Category } from "./types.ts";

export type BankMatch = {
  categoryId: string;
  slug: string;
  reason: string;
};

/** The whole label is too vague to sort a charge. */
const VAGUE = new Set([
  "other",
  "others",
  "uncategorized",
  "uncategorised",
  "miscellaneous",
  "misc",
  "general",
  "unknown",
  "n a",
  "na",
  "none",
  "debit",
  "credit",
  "sale",
  "purchase",
  "payment",
  "withdrawal",
  "deposit",
  "pos",
  "check",
  "card",
]);

/** Longer phrases first so "fast food" does not become groceries. */
const ALIASES: [string, string][] = (
  [
  ["rent or mortgage", "housing"],
  ["rent mortgage", "housing"],
  ["car insurance", "transport"],
  ["auto insurance", "transport"],
  ["vehicle insurance", "transport"],
  ["health insurance", "health"],
  ["renters insurance", "housing"],
  ["home insurance", "housing"],
  ["eating out", "dining"],
  ["fast food", "dining"],
  ["coffee shop", "dining"],
  ["coffee shops", "dining"],
  ["car payment", "transport"],
  ["auto payment", "transport"],
  ["student loan", "debt"],
  ["credit card payment", "debt"],
  ["debt payment", "debt"],
  ["savings transfer", "savings"],
  ["pet food", "pets"],
  ["groceries", "food"],
  ["grocery", "food"],
  ["supermarket", "food"],
  ["mortgage", "housing"],
  ["housing", "housing"],
  ["rent", "housing"],
  ["restaurants", "dining"],
  ["restaurant", "dining"],
  ["dining", "dining"],
  ["gasoline", "gas"],
  ["fuel", "gas"],
  ["gas", "gas"],
  ["utilities", "utilities"],
  ["utility", "utilities"],
  ["internet", "utilities"],
  ["electric", "utilities"],
  ["electricity", "utilities"],
  ["phone", "utilities"],
  ["pharmacy", "health"],
  ["medical", "health"],
  ["health", "health"],
  ["subscriptions", "subscriptions"],
  ["subscription", "subscriptions"],
  ["streaming", "subscriptions"],
  ["entertainment", "entertainment"],
  ["shopping", "personal"],
  ["merchandise", "personal"],
  ["household", "personal"],
  ["personal", "personal"],
  ["childcare", "childcare"],
  ["daycare", "childcare"],
  ["education", "education"],
  ["tuition", "education"],
  ["charity", "giving"],
  ["donation", "giving"],
  ["donations", "giving"],
  ["giving", "giving"],
  ["gifts", "giving"],
  ["airfare", "travel"],
  ["hotel", "travel"],
  ["travel", "travel"],
  ["parking", "transport"],
  ["transit", "transport"],
  ["transportation", "transport"],
  ["transport", "transport"],
  ["pets", "pets"],
  ["pet", "pets"],
  ["paycheck", "paycheck"],
  ["payroll", "paycheck"],
  ["salary", "paycheck"],
  ["income", "paycheck"],
  ["other income", "other-income"],
  ["side hustle", "side-work"],
  ["freelance", "side-work"],
  ["transfer", "transfers-out"],
  ["transfers", "transfers-out"],
  ["savings", "savings"],
  ["loan", "debt"],
  ["food", "food"],
] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

function normLabel(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function bankLabelKey(label: string): string {
  return normLabel(label);
}

function hasPhrase(label: string, phrase: string): boolean {
  return ` ${label} `.includes(` ${phrase} `);
}

function reasonFor(label: string, name: string): string {
  const shown = label.trim().replace(/\s+/g, " ");
  return `The bank called this ${shown}, so it is ${name}.`;
}

/** Match a bank's category cell to a ledger category. Vague labels return null. */
export function matchBankLabel(label: string, categories: Category[]): BankMatch | null {
  const n = normLabel(label);
  if (!n || VAGUE.has(n)) return null;
  const usable = categories.filter((category) => category.id && category.name);

  const named = usable.find((category) => normLabel(category.name) === n);
  if (named) return { categoryId: named.id, slug: named.slug, reason: reasonFor(label, named.name) };

  const slugged = usable.find((category) => normLabel(category.slug.replace(/-/g, " ")) === n);
  if (slugged) return { categoryId: slugged.id, slug: slugged.slug, reason: reasonFor(label, slugged.name) };

  const alias = ALIASES.find(([phrase]) => phrase === n || hasPhrase(n, phrase));
  if (alias) {
    const category = usable.find((item) => item.slug === alias[1]);
    if (category) return { categoryId: category.id, slug: category.slug, reason: reasonFor(label, category.name) };
  }

  const byName = usable
    .map((category) => ({ category, phrase: normLabel(category.name) }))
    .filter((item) => item.phrase.length >= 3 && hasPhrase(n, item.phrase))
    .sort((a, b) => b.phrase.length - a.phrase.length);
  if (byName[0]) {
    const category = byName[0].category;
    return { categoryId: category.id, slug: category.slug, reason: reasonFor(label, category.name) };
  }
  return null;
}
