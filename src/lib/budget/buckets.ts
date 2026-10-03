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

/** What this bucket adds in one month. Paused months add nothing. A rate change does not rewrite locked months. */
export function fundingForMonth(bucket: MoneyBucket, ym: string): number {
  if (!/^\d{4}-\d{2}$/.test(ym) || ym < bucket.startMonth) return 0;
  if (bucket.paused) {
    const from = bucket.pausedFrom && /^\d{4}-\d{2}$/.test(bucket.pausedFrom) ? bucket.pausedFrom : bucket.startMonth;
    if (ym >= from) return 0;
  }
  const locked = bucket.pastRates?.find((r) => r.ym === ym);
  if (locked) return roundMoney(Math.max(0, locked.monthly));
  return roundMoney(Math.max(0, bucket.monthly));
}

export function fundedThrough(bucket: MoneyBucket, throughYm: string): number {
  if (throughYm < bucket.startMonth) return 0;
  let sum = 0;
  let ym = bucket.startMonth;
  let guard = 0;
  while (ym <= throughYm && guard < 360) {
    sum += fundingForMonth(bucket, ym);
    ym = shiftMonth(ym, 1);
    guard += 1;
  }
  return roundMoney(sum);
}

/**
 * A new amount applies to future months only.
 * A bucket created this month, with no locked history, still uses the amount you just typed.
 */
export function withMonthlyChange(bucket: MoneyBucket, nextMonthly: number, asOf: string): MoneyBucket {
  const monthly = roundMoney(Math.max(0, nextMonthly));
  const asOfOk = /^\d{4}-\d{2}$/.test(asOf) ? asOf : bucket.startMonth;
  const fresh = bucket.startMonth === asOfOk && !(bucket.pastRates && bucket.pastRates.length) && !bucket.paused;
  if (fresh) return { ...bucket, monthly, monthlyFrom: asOfOk };
  const past = new Map((bucket.pastRates ?? []).map((r) => [r.ym, r.monthly]));
  let ym = bucket.startMonth;
  let guard = 0;
  while (ym <= asOfOk && guard < 360) {
    if (!past.has(ym)) past.set(ym, fundingForMonth(bucket, ym));
    ym = shiftMonth(ym, 1);
    guard += 1;
  }
  return {
    ...bucket,
    monthly,
    monthlyFrom: shiftMonth(asOfOk, 1),
    pastRates: [...past.entries()]
      .map(([m, amount]) => ({ ym: m, monthly: roundMoney(Math.max(0, amount)) }))
      .sort((a, b) => a.ym.localeCompare(b.ym)),
  };
}

/** Pausing stops funding from this month on. Unpausing does not go back and fill the months you skipped. */
export function withPaused(bucket: MoneyBucket, paused: boolean, asOf: string): MoneyBucket {
  const asOfOk = /^\d{4}-\d{2}$/.test(asOf) ? asOf : bucket.startMonth;
  if (paused) {
    if (bucket.paused) return bucket;
    return { ...bucket, paused: true, pausedFrom: asOfOk };
  }
  if (!bucket.paused) return { ...bucket, paused: false, pausedFrom: null };
  const past = new Map((bucket.pastRates ?? []).map((r) => [r.ym, r.monthly]));
  const start = bucket.pausedFrom && /^\d{4}-\d{2}$/.test(bucket.pausedFrom) ? bucket.pausedFrom : bucket.startMonth;
  const end = shiftMonth(asOfOk, -1);
  let ym = start;
  let guard = 0;
  while (ym <= end && guard < 360) {
    if (!past.has(ym)) past.set(ym, 0);
    ym = shiftMonth(ym, 1);
    guard += 1;
  }
  return {
    ...bucket,
    paused: false,
    pausedFrom: null,
    monthlyFrom: asOfOk,
    pastRates: [...past.entries()]
      .map(([m, amount]) => ({ ym: m, monthly: roundMoney(Math.max(0, amount)) }))
      .sort((a, b) => a.ym.localeCompare(b.ym)),
  };
}

/** The jar fills to this line. A target wins. Otherwise three months of the current amount. */
export function fullLineOf(bucket: MoneyBucket): number {
  if (bucket.fullLine != null && bucket.fullLine > 0) return roundMoney(bucket.fullLine);
  if (bucket.target != null && bucket.target > 0) return roundMoney(bucket.target);
  return roundMoney(Math.max(0, bucket.monthly) * 3);
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
  const funded = fundedThrough(bucket, throughYm);
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
 * Income so far, minus monthly-budget amounts, minus bucket funding, minus spending
 * that is not already inside those amounts. Spending inside a bucket is not subtracted
 * again — it comes out of the bucket.
 */
export function safeToSpend(input: {
  ym: string;
  transactions: Transaction[];
  categories: Category[];
  budgets?: MonthBudget[];
  buckets: MoneyBucket[];
  moves: BucketMove[];
}): { amount: number; funding: number; moved: number; spent: number; plans: number; income: number } {
  const layout = groupMonth(input.transactions, input.categories, input.ym, input.budgets ?? []);
  const linked = new Set(input.buckets.flatMap((b) => b.categoryIds));
  let plans = 0;
  let spent = 0;
  for (const group of layout.expenses) {
    if (group.id === "money-back" || linked.has(group.id)) continue;
    if (group.open || group.plan <= 0) {
      spent += group.total;
      continue;
    }
    plans += group.plan;
    if (group.total > group.plan) spent += group.total - group.plan;
  }
  const funding = roundMoney(
    input.buckets.filter((b) => b.startMonth <= input.ym).reduce((s, b) => s + fundingForMonth(b, input.ym), 0),
  );
  const moved = roundMoney(
    input.moves.filter((m) => m.ym === input.ym && m.fromId == null).reduce((s, m) => s + Math.abs(m.amount), 0),
  );
  plans = roundMoney(plans);
  spent = roundMoney(Math.max(0, spent));
  return {
    income: layout.incomeTotal,
    funding,
    moved,
    plans,
    spent,
    amount: roundMoney(layout.incomeTotal - plans - spent - funding - moved),
  };
}

export function bucketFunding(buckets: MoneyBucket[], ym: string) {
  return roundMoney(buckets.filter((b) => b.startMonth <= ym).reduce((s, b) => s + fundingForMonth(b, ym), 0));
}

export type BucketMonth = { ym: string; funded: number; spent: number; balance: number };

/** Funded versus spent for recent months, oldest first. */
export function bucketActivity(
  bucket: MoneyBucket,
  throughYm: string,
  transactions: Transaction[],
  categories: Category[],
  moves: BucketMove[],
  months = 12,
): BucketMonth[] {
  if (throughYm < bucket.startMonth) return [];
  const points: BucketMonth[] = [];
  let ym = bucket.startMonth;
  let guard = 0;
  while (ym <= throughYm && guard < 360) {
    const spent = roundMoney(
      bucket.categoryIds.reduce((s, id) => s + categorySpend(transactions, categories, id, ym, ym), 0),
    );
    points.push({
      ym,
      funded: fundingForMonth(bucket, ym),
      spent,
      balance: bucketBalance(bucket, ym, transactions, categories, moves),
    });
    ym = shiftMonth(ym, 1);
    guard += 1;
  }
  return points.length > months ? points.slice(-months) : points;
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
