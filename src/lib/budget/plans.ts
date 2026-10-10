import { roundMoney } from "./money.ts";
import { shiftMonth } from "./parse-date.ts";
import type { Category, CategoryKind, MonthBudget } from "./types.ts";

export function planAmount(category: Category, ym: string | null, budgets: MonthBudget[] = []): number {
  if (ym) {
    const hit = budgets.find((b) => b.categoryId === category.id && b.ym === ym);
    if (hit && Number.isFinite(hit.amount)) return Math.max(0, hit.amount);
  }
  return Math.max(0, category.plannedMonthly || 0);
}

export function hasMonthOverride(categoryId: string, ym: string, budgets: MonthBudget[] = []): boolean {
  return budgets.some((b) => b.categoryId === categoryId && b.ym === ym);
}

export function childrenOf(categories: Category[], parentId: string): Category[] {
  return categories.filter((c) => c.parentId === parentId);
}

/** A parent with splits does not add its own number again — the splits are the plan. */
export function countsTowardPlan(category: Category, categories: Category[]): boolean {
  return !categories.some((c) => c.parentId === category.id);
}

/** One plan total. Parents that have children are left out; the children are the plan. */
export function planTotal(categories: Category[], ym?: string | null, budgets: MonthBudget[] = []): number {
  let total = 0;
  for (const category of categories) {
    if (category.kind !== "expense" || !countsTowardPlan(category, categories)) continue;
    total += planAmount(category, ym ?? null, budgets);
  }
  return roundMoney(total);
}

export function categoryLabel(categories: Category[], id: string | null): string {
  if (!id) return "Needs a category";
  const cat = categories.find((c) => c.id === id);
  if (!cat) return "Needs a category";
  const parent = cat.parentId ? categories.find((c) => c.id === cat.parentId) : undefined;
  return parent ? `${parent.name} · ${cat.name}` : cat.name;
}

export function orderedCategories(categories: Category[], kind?: CategoryKind): Category[] {
  const list = categories.filter((c) => !kind || c.kind === kind);
  const roots = list.filter((c) => !c.parentId || !list.some((p) => p.id === c.parentId));
  const out: Category[] = [];
  for (const root of roots) {
    out.push(root);
    out.push(...list.filter((c) => c.parentId === root.id));
  }
  return out;
}

/** Apply a change to one category. A fund link never changes what was typed. */
export function patchCategory(categories: Category[], id: string, patch: Partial<Category>): Category[] {
  return categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

/** Set or clear one month's own amount for a category. Other months are left alone. */
export function withMonthPlan(budgets: MonthBudget[], categoryId: string, ym: string, amount: number | null): MonthBudget[] {
  const rest = budgets.filter((b) => !(b.categoryId === categoryId && b.ym === ym));
  if (amount == null || !Number.isFinite(amount)) return rest;
  return [...rest, { categoryId, ym, amount: Math.max(0, amount) }];
}

/**
 * A new usual amount applies from the current month forward.
 * Earlier months keep the amount they already had.
 */
export function freezePastUsual(
  budgets: MonthBudget[],
  categoryId: string,
  previousUsual: number,
  activeYm: string,
  startYm: string | null,
): MonthBudget[] {
  if (!startYm || !/^\d{4}-\d{2}$/.test(startYm) || !/^\d{4}-\d{2}$/.test(activeYm) || startYm >= activeYm) return budgets;
  let next = budgets;
  let cursor = startYm;
  let guard = 0;
  const amount = Math.max(0, previousUsual || 0);
  while (cursor < activeYm && guard < 240) {
    if (!hasMonthOverride(categoryId, cursor, next)) next = withMonthPlan(next, categoryId, cursor, amount);
    cursor = shiftMonth(cursor, 1);
    guard += 1;
  }
  return next;
}
