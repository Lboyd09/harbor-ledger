import { bucketBalance } from "./buckets.ts";
import { roundMoney } from "./money.ts";
import { groupMonth } from "./month-view.ts";
import { monthKeyFromDate, shiftMonth } from "./parse-date.ts";
import { findRecurring } from "./recurring.ts";
import type { Category, MoneyBucket, BucketMove, MonthBudget, Transaction } from "./types.ts";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayHeat(transactions: Transaction[], year: string) {
  const sums = [0, 0, 0, 0, 0, 0, 0];
  for (const t of transactions) {
    if (!t.date.startsWith(year)) continue;
    if (t.excluded || t.status === "transfer" || t.status === "reimbursement" || t.status === "refund") continue;
    if (t.amount >= 0) continue;
    const day = new Date(`${t.date}T12:00:00`).getDay();
    sums[day] += -t.amount;
  }
  const max = Math.max(1, ...sums);
  return WEEKDAYS.map((label, i) => ({ label, amount: roundMoney(sums[i]), level: sums[i] / max }));
}

export function categoryDrift(
  transactions: Transaction[],
  categories: Category[],
  ym: string,
  budgets: MonthBudget[] = [],
) {
  const current = groupMonth(transactions, categories, ym, budgets);
  const prev = [1, 2, 3].map((n) => groupMonth(transactions, categories, shiftMonth(ym, -n), budgets));
  const rows = current.expenses
    .filter((g) => g.id && g.id !== "money-back" && g.id !== "expense-open")
    .map((g) => {
      const history = prev.map((layout) => layout.expenses.find((row) => row.id === g.id)?.total ?? 0);
      const avg = history.reduce((s, n) => s + n, 0) / 3;
      const delta = g.total - avg;
      return { id: g.id, name: g.name, current: roundMoney(g.total), average: roundMoney(avg), delta: roundMoney(delta) };
    })
    .filter((row) => Math.abs(row.delta) >= 10 && (row.average === 0 || Math.abs(row.delta) / Math.max(row.average, 1) >= 0.15));
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return rows.slice(0, 6);
}

export function subscriptionFlags(transactions: Transaction[]) {
  return findRecurring(transactions)
    .filter((g) => g.direction === "out")
    .map((g) => {
      const rows = transactions
        .filter((t) => t.merchantKey === g.merchantKey && t.amount < 0 && !t.excluded && t.status !== "transfer")
        .sort((a, b) => a.date.localeCompare(b.date));
      const earlier = rows.slice(0, -1).map((t) => Math.abs(t.amount)).sort((a, b) => a - b);
      const mid = earlier.length ? earlier[Math.floor(earlier.length / 2)] : g.avgAmount;
      const last = rows.length ? Math.abs(rows[rows.length - 1].amount) : g.avgAmount;
      const changed = Math.abs(last - mid) > 0.5;
      return { ...g, median: roundMoney(mid), last: roundMoney(last), changed };
    })
    .filter((g) => g.interval === "monthly" || g.interval === "weekly" || g.interval === "biweekly");
}

export function monthReview(input: {
  ym: string;
  transactions: Transaction[];
  categories: Category[];
  budgets?: MonthBudget[];
  buckets: MoneyBucket[];
  moves: BucketMove[];
}) {
  const layout = groupMonth(input.transactions, input.categories, input.ym, input.budgets ?? []);
  const prev = shiftMonth(input.ym, -1);
  const rolled = input.buckets
    .map((b) => {
      const now = bucketBalance(b, input.ym, input.transactions, input.categories, input.moves);
      const before = bucketBalance(b, prev, input.transactions, input.categories, input.moves);
      return { name: b.name, delta: roundMoney(now - before), balance: now };
    })
    .filter((row) => row.delta > 0.5);
  const over = layout.expenses.filter((g) => g.plan > 0 && g.total > g.plan + 0.5);
  const negative = input.buckets
    .map((b) => ({ name: b.name, balance: bucketBalance(b, input.ym, input.transactions, input.categories, input.moves) }))
    .filter((row) => row.balance < -0.5);
  let action = "Nothing needs a move this month.";
  if (negative[0]) action = `${negative[0].name} is short. Move money in from another bucket or from unassigned.`;
  else if (over[0]) action = `${over[0].name} ran past its plan. Trim it, or link it to a bucket if it should carry.`;
  else if (rolled[0]) action = `${rolled[0].name} kept what you did not spend. Leave it there, or move some to a goal.`;
  const spent = input.transactions
    .filter((t) => monthKeyFromDate(t.date) === input.ym && t.amount < 0)
    .reduce((s, t) => s + -t.amount, 0);
  return { rolled, over: over.map((g) => g.name), action, spent: roundMoney(spent) };
}
