import { matchKeyword, SLUG_FALLBACKS } from "./keywords.ts";
import type { Category, MerchantRule } from "./types.ts";

export type SuggestResult = {
  categoryId: string | null;
  reason: "rule" | "keyword" | "refund" | null;
  pattern: string | null;
};

function resolveSlug(slug: string, categories: Category[]): Category | undefined {
  const direct = categories.find((c) => c.slug === slug);
  if (direct) return direct;
  for (const alt of SLUG_FALLBACKS[slug] ?? []) {
    const hit = categories.find((c) => c.slug === alt);
    if (hit) return hit;
  }
  return undefined;
}

export function suggestCategory(
  description: string,
  amount: number,
  categories: Category[],
  rules: MerchantRule[],
  merchantKeyValue: string,
): SuggestResult {
  const rule = rules.find((r) => r.merchantKey === merchantKeyValue);
  if (rule && categories.some((c) => c.id === rule.categoryId)) {
    return { categoryId: rule.categoryId, reason: "rule", pattern: null };
  }

  const hit = matchKeyword(description);
  if (hit) {
    const cat = resolveSlug(hit.slug, categories);
    if (cat) {
      if (amount > 0 && cat.kind === "expense") {
        return { categoryId: cat.id, reason: "refund", pattern: hit.pattern };
      }
      if (amount < 0 && cat.kind === "income") {
        const spend = resolveSlug("personal", categories) ?? resolveSlug("other", categories);
        return spend
          ? { categoryId: spend.id, reason: "keyword", pattern: hit.pattern }
          : { categoryId: null, reason: null, pattern: null };
      }
      return { categoryId: cat.id, reason: "keyword", pattern: hit.pattern };
    }
  }

  return { categoryId: null, reason: null, pattern: null };
}

export function suggestCategoryId(
  description: string,
  amount: number,
  categories: Category[],
  rules: MerchantRule[],
  merchantKeyValue: string,
): string | null {
  return suggestCategory(description, amount, categories, rules, merchantKeyValue).categoryId;
}

export function explainMatch(
  description: string,
  categoryId: string | null,
  userSet: boolean,
  rules: MerchantRule[],
  merchantKeyValue: string,
): string {
  if (!categoryId) return "Unassigned";
  if (userSet) return "Set by you";
  const rule = rules.find((r) => r.merchantKey === merchantKeyValue && r.categoryId === categoryId);
  if (rule) return "Saved merchant rule";
  const hit = matchKeyword(description);
  if (hit) return `Matched “${hit.pattern.trim()}”`;
  return "Assigned";
}
