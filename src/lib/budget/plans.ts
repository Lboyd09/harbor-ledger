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
