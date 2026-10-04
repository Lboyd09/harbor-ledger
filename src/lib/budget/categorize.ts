import { sortCharge, type SortHistory } from "./auto-sort.ts";
import { matchKeyword } from "./keywords.ts";
import type { Category, IncomeStream, MerchantRule, Transaction } from "./types.ts";

export type SuggestResult = {
  categoryId: string | null;
  reason: "rule" | "history" | "keyword" | "refund" | null;
  pattern: string | null;
};

/** Replace the standing category for a merchant. A side keeps income and expenses apart. */
export function replaceMerchantRule(
  rules: MerchantRule[],
  key: string,
  categoryId: string | null,
  side?: "in" | "out",
): MerchantRule[] {
  const rest = rules.filter((r) => {
    if (r.merchantKey !== key) return true;
    if (!side) return false;
    return Boolean(r.side) && r.side !== side;
  });
  if (!categoryId) return rest;
  return [...rest, side ? { merchantKey: key, categoryId, side } : { merchantKey: key, categoryId }];
}

export function suggestCategory(
  description: string,
  amount: number,
  categories: Category[],
  rules: MerchantRule[],
  merchantKeyValue: string,
  history: SortHistory[] = [],
  incomeStreams: IncomeStream[] = [],
): SuggestResult {
  const sorted = sortCharge(
    { description, amount, merchantKey: merchantKeyValue },
    { categories, rules, history, incomeStreams },
  );
  let reason: SuggestResult["reason"] = null;
  if (sorted.auto.source === "rule" && sorted.categoryId) reason = "rule";
  else if (sorted.auto.source === "history" && sorted.categoryId) reason = "history";
  else if (sorted.status === "refund") reason = "refund";
  else if (sorted.auto.source === "keyword" && sorted.categoryId) reason = "keyword";
  const hit = reason === "keyword" || reason === "refund" ? matchKeyword(description) : null;
  return { categoryId: sorted.categoryId, reason, pattern: hit?.pattern ?? null };
}

export function suggestCategoryId(
  description: string,
  amount: number,
  categories: Category[],
  rules: MerchantRule[],
  merchantKeyValue: string,
  history: Pick<Transaction, "merchantKey" | "categoryId" | "userSet" | "date">[] = [],
): string | null {
  return suggestCategory(description, amount, categories, rules, merchantKeyValue, history).categoryId;
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
