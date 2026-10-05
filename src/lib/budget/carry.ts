import { groupMonth } from "./month-view.ts";
import { monthLedger } from "./ledger-month.ts";
import { roundMoney } from "./money.ts";
import { shiftMonth } from "./parse-date.ts";
import { planAmount } from "./plans.ts";
import type { Category, MonthBudget, Transaction } from "./types.ts";

/** A surplus bigger than this many months of the plan is worth putting to work. */
export const SURPLUS_PLAN_MONTHS = 2;
const EVEN_BAND = 0.5;

export type CarryContext = {
  transactions: Transaction[];
  categories: Category[];
  budgets?: MonthBudget[];
  carryStartMonth: string;
  /** Balance already in the category when carry-over starts. Default 0. */
  opening?: number;
};

export type CarryMonth = {
  ym: string;
  planned: number;
  spent: number;
  carryIn: number;
  carryOut: number;
};

export type CarryStatus = "over" | "extra" | "even";

export type Allowance = { amount: number; cutBack: boolean };

export type CarrySummary = {
  extra: number;
  overspent: number;
  countOver: number;
  countExtra: number;
};

/** Spending the month view already counts for this category. Refunds lower it. Splits count their share. */
export function categorySpent(
  transactions: Transaction[],
  categories: Category[],
  categoryId: string,
  ym: string,
): number {
  const layout = groupMonth(transactions, categories, ym, []);
  const group = layout.expenses.find((g) => g.id === categoryId);
  return roundMoney(group?.total ?? 0);
}

function walk(category: Category, throughYm: string, ctx: CarryContext): CarryMonth[] {
  const start = ctx.carryStartMonth;
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(throughYm) || throughYm < start) return [];
  const rows: CarryMonth[] = [];
  let ym = start;
  let carryIn = roundMoney(ctx.opening ?? 0);
  let guard = 0;
  while (ym <= throughYm && guard < 360) {
    const planned = planAmount(category, ym, ctx.budgets ?? []);
    const spent = categorySpent(ctx.transactions, ctx.categories, category.id, ym);
    const carryOut = roundMoney(carryIn + planned - spent);
    rows.push({ ym, planned, spent, carryIn, carryOut });
    carryIn = carryOut;
    ym = shiftMonth(ym, 1);
    guard += 1;
  }
  return rows;
}

export function carryMonth(category: Category, ym: string, ctx: CarryContext): CarryMonth | null {
  return walk(category, ym, ctx).find((row) => row.ym === ym) ?? null;
}

export function carryIn(category: Category, ym: string, ctx: CarryContext): number {
  return carryMonth(category, ym, ctx)?.carryIn ?? 0;
}

export function carryOut(category: Category, ym: string, ctx: CarryContext): number {
  return carryMonth(category, ym, ctx)?.carryOut ?? 0;
}

export function statusFrom(carryOutAmount: number): CarryStatus {
  if (Math.abs(carryOutAmount) <= EVEN_BAND) return "even";
  return carryOutAmount < 0 ? "over" : "extra";
}

export function carryStatus(category: Category, ym: string, ctx: CarryContext): CarryStatus {
  const row = carryMonth(category, ym, ctx);
  if (!row) return "even";
  return statusFrom(row.carryOut);
}

export function nextMonthAllowance(category: Category, ym: string, ctx: CarryContext): Allowance {
  const row = carryMonth(category, ym, ctx);
  const next = shiftMonth(/^\d{4}-\d{2}$/.test(ym) ? ym : ctx.carryStartMonth, 1);
  const planned = planAmount(category, next, ctx.budgets ?? []);
  const raw = roundMoney(planned + (row?.carryOut ?? 0));
  if (raw < 0) return { amount: 0, cutBack: true };
  return { amount: raw, cutBack: false };
}

export function surplusToPutToWork(category: Category, ym: string, ctx: CarryContext): number {
  const row = carryMonth(category, ym, ctx);
  if (!row) return 0;
  return roundMoney(Math.max(0, row.carryOut - SURPLUS_PLAN_MONTHS * row.planned));
}

/** Up to 12 months ending at ym, never earlier than carryStartMonth. */
export function carryYear(category: Category, ym: string, ctx: CarryContext): CarryMonth[] {
  return walk(category, ym, ctx).slice(-12);
}

export function carrySummary(ym: string, ctx: CarryContext): CarrySummary {
  const ledger = monthLedger(
    {
      transactions: ctx.transactions,
      categories: ctx.categories,
      budgets: ctx.budgets,
      style: "buckets",
      carryStartMonth: ctx.carryStartMonth,
      opening: ctx.opening,
    },
    ym,
  );
  let extra = 0;
  let overspent = 0;
  let countOver = 0;
  let countExtra = 0;
  for (const line of ledger.spending) {
    if (!line.carries || line.carryOut === 0 && line.carryIn === 0 && ym < ctx.carryStartMonth) continue;
    if (!line.carries) continue;
    if (Math.abs(line.carryOut) <= EVEN_BAND) continue;
    if (line.carryOut > 0) {
      extra += line.carryOut;
      countExtra += 1;
    } else {
      overspent += Math.abs(line.carryOut);
      countOver += 1;
    }
  }
  return {
    extra: roundMoney(extra),
    overspent: roundMoney(overspent),
    countOver,
    countExtra,
  };
}
