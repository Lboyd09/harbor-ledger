import { roundMoney } from "./money.ts";
import { groupMonth } from "./month-view.ts";
import { monthKeyFromDate, shiftMonth } from "./parse-date.ts";
import { piecesOf } from "./splits.ts";
import type { BucketMove, Category, MoneyBucket, MonthBudget, SavingsGoal, Transaction } from "./types.ts";

export function monthsInclusive(start: string, end: string): number {
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || end < start) return 0;
  const [ys, ms] = start.split("-").map(Number);
  const [ye, me] = end.split("-").map(Number);
  return (ye - ys) * 12 + (me - ms) + 1;
}

/** Spending assigned to one expense category between two months, inclusive. */
export function categorySpend(
  transactions: Transaction[],
  categories: Category[],
  categoryId: string,
  fromYm: string,
  throughYm: string,
): number {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat || cat.kind !== "expense") return 0;
  let sum = 0;
  for (const t of transactions) {
    const ym = monthKeyFromDate(t.date);
    if (ym < fromYm || ym > throughYm) continue;
    if (t.excluded || t.status === "transfer" || t.status === "reimbursement") continue;
    if (t.status === "refund") {
      if (t.categoryId === categoryId) sum -= Math.abs(t.amount);
      continue;
    }
    const parts = piecesOf(t);
    if (parts) {
      for (const part of parts) {
        if (part.categoryId === categoryId) sum += part.amount;
      }
      continue;
    }
    if (t.categoryId === categoryId && t.amount < 0) sum += -t.amount;
  }
  return roundMoney(sum);
}

export function bucketBalance(
  bucket: MoneyBucket,
  throughYm: string,
  transactions: Transaction[],
  categories: Category[],
  moves: BucketMove[],
): number {
  if (throughYm < bucket.startMonth) return roundMoney(bucket.opening);
  const funded = roundMoney(bucket.monthly * monthsInclusive(bucket.startMonth, throughYm));
  let moved = 0;
  for (const move of moves) {
    if (move.ym < bucket.startMonth || move.ym > throughYm) continue;
    if (move.toId === bucket.id) moved += move.amount;
    if (move.fromId === bucket.id) moved -= move.amount;
  }
  let spent = 0;
  for (const id of bucket.categoryIds) {
    spent += categorySpend(transactions, categories, id, bucket.startMonth, throughYm);
  }
  return roundMoney(bucket.opening + funded + moved - spent);
}

export function balanceSeries(
  bucket: MoneyBucket,
  throughYm: string,
  transactions: Transaction[],
  categories: Category[],
  moves: BucketMove[],
): { ym: string; balance: number }[] {
  const end = throughYm < bucket.startMonth ? bucket.startMonth : throughYm;
  const points: { ym: string; balance: number }[] = [];
  let ym = bucket.startMonth;
  let guard = 0;
  while (ym <= end && guard < 240) {
    points.push({
      ym,
      balance: bucketBalance(bucket, ym, transactions, categories, moves),
    });
    ym = shiftMonth(ym, 1);
    guard += 1;
  }
  return points.length > 18 ? points.slice(-18) : points;
}

export function migrateGoals(goals: SavingsGoal[], buckets: MoneyBucket[], startMonth: string): MoneyBucket[] {
  const taken = new Set(buckets.map((b) => b.fromGoalId).filter((id): id is string => Boolean(id)));
  const missing = goals.filter((g) => !taken.has(g.id));
  if (!missing.length) return buckets;
  const ym = /^\d{4}-\d{2}$/.test(startMonth) ? startMonth : "2026-01";
  return [
    ...buckets,
    ...missing.map((g) => ({
      id: `bucket_goal_${g.id}`,
      name: g.name,
      monthly: 0,
      yearly: null,
      categoryIds: [] as string[],
      target: g.target,
      by: g.by,
      startMonth: ym,
      opening: g.saved,
      fromGoalId: g.id,
    })),
  ];
}

export function goalPace(bucket: MoneyBucket, balance: number, todayYm: string) {
  if (bucket.target == null || bucket.target <= 0) return null;
  const left = roundMoney(Math.max(0, bucket.target - balance));
  const span = bucket.by && /^\d{4}-\d{2}$/.test(bucket.by) ? monthsInclusive(todayYm, bucket.by) : null;
  const required = span && span > 0 && left > 0 ? Math.ceil((left / span) * 100) / 100 : left <= 0 ? 0 : null;
  let projected: string | null = null;
  if (left <= 0) projected = todayYm;
  else if (bucket.monthly > 0) {
    const need = Math.ceil(left / bucket.monthly);
    projected = shiftMonth(todayYm, Math.max(0, need - 1));
  }
  return { left, required, projected, span };
}

/**
 * Income this month, minus bucket funding, minus moves out of unassigned,
 * minus spending that is not inside a bucket.
 * A purchase in a linked category hits the bucket only, so it is not subtracted again.
 */
export function safeToSpend(input: {
  ym: string;
  transactions: Transaction[];
  categories: Category[];
  budgets?: MonthBudget[];
  buckets: MoneyBucket[];
  moves: BucketMove[];
}): { amount: number; funding: number; moved: number; spent: number; income: number } {
  const layout = groupMonth(input.transactions, input.categories, input.ym, input.budgets ?? []);
  const linked = new Set(input.buckets.flatMap((b) => b.categoryIds));
  const spent = roundMoney(layout.expenses.filter((g) => !linked.has(g.id)).reduce((s, g) => s + g.total, 0));
  const funding = roundMoney(
    input.buckets.filter((b) => b.startMonth <= input.ym).reduce((s, b) => s + b.monthly, 0),
  );
  const moved = roundMoney(
    input.moves.filter((m) => m.ym === input.ym && m.fromId == null).reduce((s, m) => s + Math.abs(m.amount), 0),
  );
  return {
    income: layout.incomeTotal,
    funding,
    moved,
    spent,
    amount: roundMoney(layout.incomeTotal - funding - moved - spent),
  };
}

export function bucketFunding(buckets: MoneyBucket[], ym: string) {
  return roundMoney(buckets.filter((b) => b.startMonth <= ym).reduce((s, b) => s + b.monthly, 0));
}

/** Linking clears the monthly plan and any one-month overrides so the category is not budgeted twice. */
export function linkCategoryState<T extends { id: string; plannedMonthly: number }>(input: {
  categories: T[];
  monthBudgets: MonthBudget[];
  buckets: MoneyBucket[];
  categoryId: string;
  bucketId: string;
}): { categories: T[]; monthBudgets: MonthBudget[]; buckets: MoneyBucket[] } | null {
  const bucket = input.buckets.find((b) => b.id === input.bucketId);
  const category = input.categories.find((c) => c.id === input.categoryId);
  if (!bucket || !category) return null;
  return {
    categories: input.categories.map((c) => (c.id === input.categoryId ? { ...c, plannedMonthly: 0 } : c)),
    monthBudgets: input.monthBudgets.filter((b) => b.categoryId !== input.categoryId),
    buckets: input.buckets.map((b) => ({
      ...b,
      categoryIds:
        b.id === input.bucketId
          ? [...new Set([...b.categoryIds, input.categoryId])]
          : b.categoryIds.filter((id) => id !== input.categoryId),
    })),
  };
}
