import { latestBalance } from "./accounts.ts";
import { formatMoney, roundMoney } from "./money.ts";
import { findRecurringAll } from "./recurring.ts";
import { monthCash, monthsInData } from "./totals.ts";
import type { Account, BalancePoint, Category, RecurringInterval, Transaction } from "./types.ts";

export const UNLOCK = {
  dataDepth: "A reading of the file needs at least one charge.",
  typicalMonth: "A typical month needs at least two months with money in or out.",
  recurringBills: "Bills need the same charge at least twice.",
  payCycle: "Spending after payday needs at least three paychecks.",
  runway: "A cushion needs a checking or savings balance and a typical month of spending.",
  categoryTrends: "A trend needs at least four months. A seasonal index needs thirteen.",
  unusualCharges: "An unusual charge needs at least four expenses so a normal one is visible.",
  incomeStability: "Income steadiness needs three months with money in.",
  savingsRate: "A savings rate needs two months with income.",
} as const;

export type DataDepth = {
  months: number;
  charges: number;
  level: "thin" | "usable" | "strong";
  sentence: string;
};

export type TypicalMonth = {
  moneyIn: number;
  moneyOut: number;
  left: number;
  months: number;
  fixed: { id: string; name: string; typical: number }[];
  flexible: { id: string; name: string; typical: number }[];
  sentence: string;
};

export type RecurringBill = {
  merchantKey: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  usual: number;
  interval: RecurringInterval;
  lastDate: string;
  nextDate: string | null;
  yearly: number;
  kind: "fixed" | "variable";
  priceChange: number | null;
  status: "active" | "late" | "stopped";
};

export type PayCycle = {
  days: { day: number; spend: number }[];
  firstWeekShare: number;
  sentence: string;
};

export type Runway = {
  months: number;
  low: number;
  high: number;
  cash: number;
  typicalSpend: number;
  sentence: string;
};

export type CategoryTrend = {
  id: string;
  name: string;
  recent: number;
  prior: number;
  delta: number;
  percent: number;
  direction: "up" | "down" | "flat";
  seasonal: number | null;
};

export type UnusualCharge = {
  id: string;
  description: string;
  amount: number;
  date: string;
  kind: "large" | "first" | "duplicate";
  sentence: string;
};

export type IncomeStability = {
  variation: number;
  label: "steady" | "mixed" | "uneven";
  low: number;
  high: number;
  lowestMonth: string;
  sentence: string;
};

export type SavingsPoint = { ym: string; rate: number; saved: number };

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function addDays(iso: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const left = addDays(a, 0);
  const right = addDays(b, 0);
  if (!left || !right) return 0;
  const am = /^(\d{4})-(\d{2})-(\d{2})$/.exec(left)!;
  const bm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(right)!;
  const ad = Date.UTC(Number(am[1]), Number(am[2]) - 1, Number(am[3]));
  const bd = Date.UTC(Number(bm[1]), Number(bm[2]) - 1, Number(bm[3]));
  return Math.round((bd - ad) / 86400000);
}

function expenses(transactions: Transaction[]) {
  return transactions.filter((row) => row.amount < 0 && !row.excluded && row.status !== "transfer" && row.status !== "reimbursement");
}

export function dataDepth(transactions: Transaction[]): DataDepth | null {
  if (!transactions.length) return null;
  const months = monthsInData(transactions).length;
  const level = months >= 6 ? "strong" : months >= 2 ? "usable" : "thin";
  const sentence =
    level === "thin"
      ? `One stretch of charges so far, ${transactions.length} in ${months} month${months === 1 ? "" : "s"}.`
      : `${months} months and ${transactions.length} charges. That is enough to compare.`;
  return { months, charges: transactions.length, level, sentence };
}

export function typicalMonth(transactions: Transaction[], categories: Category[]): TypicalMonth | null {
  const months = monthsInData(transactions);
  const complete = months.filter((ym) => {
    const cash = monthCash(transactions, ym, categories);
    return cash.income > 0.5 || cash.expenses > 0.5;
  });
  if (complete.length < 2) return null;
  const ins = complete.map((ym) => monthCash(transactions, ym, categories).income);
  const outs = complete.map((ym) => monthCash(transactions, ym, categories).expenses);
  const moneyIn = roundMoney(median(ins));
  const moneyOut = roundMoney(median(outs));
  const byCat = new Map<string, number[]>();
  for (const ym of complete) {
    const seen = new Set<string>();
    for (const row of expenses(transactions).filter((item) => item.date.startsWith(ym) && item.categoryId)) {
      const id = row.categoryId as string;
      const list = byCat.get(id) ?? [];
      if (!seen.has(id)) {
        list.push(0);
        seen.add(id);
      }
      list[list.length - 1] += Math.abs(row.amount);
      byCat.set(id, list);
    }
  }
  const fixed: TypicalMonth["fixed"] = [];
  const flexible: TypicalMonth["flexible"] = [];
  for (const [id, series] of byCat) {
    if (series.length < 2) continue;
    const typical = roundMoney(median(series));
    if (typical < 1) continue;
    const name = categories.find((category) => category.id === id)?.name ?? "Category";
    const spread = Math.max(...series) - Math.min(...series);
    const row = { id, name, typical };
    if (spread <= typical * 0.1) fixed.push(row);
    else flexible.push(row);
  }
  fixed.sort((a, b) => b.typical - a.typical);
  flexible.sort((a, b) => b.typical - a.typical);
  return {
    moneyIn,
    moneyOut,
    left: roundMoney(moneyIn - moneyOut),
    months: complete.length,
    fixed,
    flexible,
    sentence: `A typical month is ${formatMoney(moneyIn)} in and ${formatMoney(moneyOut)} out, from ${complete.length} months.`,
  };
}

function intervalDays(interval: RecurringInterval): number {
  if (interval === "weekly") return 7;
  if (interval === "biweekly") return 14;
  if (interval === "monthly") return 30;
  return 45;
}

function yearlyOf(usual: number, interval: RecurringInterval): number {
  if (interval === "weekly") return roundMoney(usual * 52);
  if (interval === "biweekly") return roundMoney(usual * 26);
  if (interval === "monthly") return roundMoney(usual * 12);
  return roundMoney(usual * 4);
}

export function recurringBills(transactions: Transaction[], categories: Category[], today: string): RecurringBill[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const groups = findRecurringAll(transactions).filter((group) => group.direction === "out");
  if (!groups.length) return null;
  return groups.map((group) => {
    const rows = transactions
      .filter((row) => row.merchantKey === group.merchantKey && row.amount < 0 && !row.excluded)
      .sort((a, b) => a.date.localeCompare(b.date));
    const amounts = rows.map((row) => Math.abs(row.amount));
    const mid = median(amounts.slice(0, -1).length ? amounts.slice(0, -1) : amounts);
    const last = amounts.at(-1) ?? group.avgAmount;
    const spread = amounts.length ? Math.max(...amounts) - Math.min(...amounts) : 0;
    const step = intervalDays(group.interval);
    const nextDate = addDays(group.lastDate, step);
    const lateBy = nextDate ? daysBetween(nextDate, today) : 0;
    const status = lateBy > step * 0.6 ? "stopped" : lateBy > 3 ? "late" : "active";
    const category = categories.find((item) => item.id === group.categoryId);
    return {
      merchantKey: group.merchantKey,
      description: group.sampleDescription,
      categoryId: group.categoryId,
      categoryName: category?.name ?? null,
      usual: roundMoney(group.avgAmount),
      interval: group.interval,
      lastDate: group.lastDate,
      nextDate,
      yearly: yearlyOf(group.avgAmount, group.interval),
      kind: spread <= Math.max(1, mid * 0.1) ? "fixed" : "variable",
      priceChange: Math.abs(last - mid) > 0.5 ? roundMoney(last - mid) : null,
      status,
    };
  });
}

export function payCycle(transactions: Transaction[]): PayCycle | null {
  const pays = transactions
    .filter((row) => row.amount > 0 && !row.excluded && row.status !== "transfer" && row.status !== "refund")
    .filter((row) => /\b(PAYROLL|DIR DEP|DIRECT DEP|SALARY|PAYCHECK)\b/i.test(row.description))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (pays.length < 3) return null;
  const buckets = Array.from({ length: 16 }, (_, day) => ({ day, spend: 0 }));
  for (const row of expenses(transactions)) {
    const prior = [...pays].reverse().find((pay) => pay.date <= row.date);
    if (!prior) continue;
    const day = daysBetween(prior.date, row.date);
    if (day < 0 || day > 15) continue;
    buckets[day].spend += Math.abs(row.amount);
  }
  const total = buckets.reduce((sum, bucket) => sum + bucket.spend, 0);
  if (total < 1) return null;
  const first = buckets.filter((bucket) => bucket.day < 7).reduce((sum, bucket) => sum + bucket.spend, 0);
  const share = roundMoney(first / total);
  return {
    days: buckets.map((bucket) => ({ day: bucket.day, spend: roundMoney(bucket.spend) })),
    firstWeekShare: share,
    sentence: `${Math.round(share * 100)}% of spending lands in the first week after pay.`,
  };
}

export function runway(
  accounts: Account[],
  balances: BalancePoint[],
  transactions: Transaction[],
  categories: Category[],
): Runway | null {
  const typical = typicalMonth(transactions, categories);
  if (!typical || typical.moneyOut < 1) return null;
  let cash = 0;
  let found = false;
  for (const account of accounts) {
    if (account.kind !== "checking" && account.kind !== "savings") continue;
    const point = latestBalance(account.id, balances);
    if (!point) continue;
    found = true;
    cash += point.amount;
  }
  if (!found) return null;
  cash = roundMoney(cash);
  const months = roundMoney(cash / typical.moneyOut);
  const low = roundMoney(cash / (typical.moneyOut * 1.2));
  const high = roundMoney(cash / Math.max(1, typical.moneyOut * 0.8));
  return {
    months,
    low,
    high,
    cash,
    typicalSpend: typical.moneyOut,
    sentence: `About ${months} months of spending sits in checking and savings. The band is ${low} to ${high}.`,
  };
}

export function categoryTrends(transactions: Transaction[], categories: Category[], ym: string): CategoryTrend[] | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const months = monthsInData(transactions).filter((key) => key <= ym);
  if (months.length < 4) return null;
  const recentKeys = months.slice(-3);
  const priorKeys = months.slice(0, -3).slice(-9);
  if (!priorKeys.length) return null;
  const seasonal = months.length >= 13;
  const ids = new Set(categories.filter((category) => category.kind === "expense").map((category) => category.id));
  const rows: CategoryTrend[] = [];
  for (const id of ids) {
    const sum = (keys: string[]) =>
      expenses(transactions)
        .filter((row) => row.categoryId === id && keys.some((key) => row.date.startsWith(key)))
        .reduce((total, row) => total + Math.abs(row.amount), 0);
    const recent = recentKeys.length ? sum(recentKeys) / recentKeys.length : 0;
    const prior = priorKeys.length ? sum(priorKeys) / priorKeys.length : 0;
    const delta = recent - prior;
    if (Math.abs(delta) < 10) continue;
    const percent = prior > 1 ? Math.round((delta / prior) * 100) : recent > 1 ? 100 : 0;
    rows.push({
      id,
      name: categories.find((category) => category.id === id)?.name ?? "Category",
      recent: roundMoney(recent),
      prior: roundMoney(prior),
      delta: roundMoney(delta),
      percent,
      direction: delta > 1 ? "up" : delta < -1 ? "down" : "flat",
      seasonal: seasonal ? roundMoney(recent / Math.max(prior, 1)) : null,
    });
  }
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return rows;
}

export function unusualCharges(transactions: Transaction[], ym?: string): UnusualCharge[] | null {
  const pool = expenses(transactions).filter((row) => !ym || row.date.startsWith(ym));
  if (pool.length < 4 && expenses(transactions).length < 4) return null;
  const byKey = new Map<string, number[]>();
  for (const row of expenses(transactions)) {
    const list = byKey.get(row.merchantKey) ?? [];
    list.push(Math.abs(row.amount));
    byKey.set(row.merchantKey, list);
  }
  const found: UnusualCharge[] = [];
  const seen = new Set<string>();
  for (const row of pool) {
    const amounts = byKey.get(row.merchantKey) ?? [];
    const others = amounts.filter((amount) => Math.abs(amount - Math.abs(row.amount)) > 0.01);
    const mid = median(others.length ? others : amounts);
    const large = Math.abs(row.amount) >= Math.max(mid * 3, mid + 100) && Math.abs(row.amount) >= 80;
    if (large && amounts.length >= 2) {
      found.push({
        id: row.id,
        description: row.description,
        amount: roundMoney(Math.abs(row.amount)),
        date: row.date,
        kind: "large",
        sentence: `${row.description} is well above the usual ${formatMoney(mid)}.`,
      });
      seen.add(row.id);
    } else if (amounts.length === 1 && Math.abs(row.amount) >= 100) {
      found.push({
        id: row.id,
        description: row.description,
        amount: roundMoney(Math.abs(row.amount)),
        date: row.date,
        kind: "first",
        sentence: `${row.description} is a first charge over $100.`,
      });
      seen.add(row.id);
    }
  }
  const ordered = [...pool].sort((a, b) => a.date.localeCompare(b.date) || a.merchantKey.localeCompare(b.merchantKey));
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      if (daysBetween(ordered[i].date, ordered[j].date) > 3) break;
      if (ordered[i].merchantKey !== ordered[j].merchantKey) continue;
      if (Math.abs(Math.abs(ordered[i].amount) - Math.abs(ordered[j].amount)) > 0.5) continue;
      if (seen.has(ordered[j].id)) continue;
      found.push({
        id: ordered[j].id,
        description: ordered[j].description,
        amount: roundMoney(Math.abs(ordered[j].amount)),
        date: ordered[j].date,
        kind: "duplicate",
        sentence: `${ordered[j].description} matches another charge within 3 days.`,
      });
      seen.add(ordered[j].id);
    }
  }
  return found.length ? found : null;
}

export function incomeStability(transactions: Transaction[], categories: Category[]): IncomeStability | null {
  const months = monthsInData(transactions)
    .map((ym) => ({ ym, income: monthCash(transactions, ym, categories).income }))
    .filter((row) => row.income > 0.5);
  if (months.length < 3) return null;
  const recent = months.slice(-12);
  const values = recent.map((row) => row.income);
  const mid = median(values);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const variation = mid > 0 ? Math.round((Math.abs(high - low) / mid) * 100) : 0;
  const label = variation < 15 ? "steady" : variation < 40 ? "mixed" : "uneven";
  const lowest = recent.reduce((best, row) => (row.income < best.income ? row : best), recent[0]);
  return {
    variation,
    label,
    low: roundMoney(low),
    high: roundMoney(high),
    lowestMonth: lowest.ym,
    sentence: `Income is ${label}. The lowest of the last ${recent.length} months was ${formatMoney(low)}.`,
  };
}

export function savingsRateSeries(transactions: Transaction[], categories: Category[]): SavingsPoint[] | null {
  const months = monthsInData(transactions);
  if (months.length < 2) return null;
  const points = months.map((ym) => {
    const cash = monthCash(transactions, ym, categories);
    const saved = roundMoney(cash.income - cash.expenses);
    const rate = cash.income > 0.5 ? roundMoney(saved / cash.income) : 0;
    return { ym, rate, saved };
  });
  if (!points.some((point) => point.saved !== 0)) return null;
  return points;
}

export type RankedInsight = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  stake: number;
  confidence: number;
  basis: string;
  chart?: { label: string; value: number }[];
};

/** One row per kind, biggest dollars times confidence first. */
export function rankedInsights(
  transactions: Transaction[],
  categories: Category[],
  today: string,
  accounts: Account[] = [],
  balances: BalancePoint[] = [],
): RankedInsight[] {
  const rows: RankedInsight[] = [];
  const depth = dataDepth(transactions);
  if (depth) {
    rows.push({
      id: "depth",
      kind: "depth",
      title: "How much history",
      detail: depth.sentence,
      stake: depth.charges,
      confidence: depth.level === "strong" ? 0.9 : 0.6,
      basis: "Count of charges and distinct months.",
      chart: [{ label: "Months", value: depth.months }, { label: "Charges", value: depth.charges }],
    });
  }
  const typical = typicalMonth(transactions, categories);
  if (typical) {
    rows.push({
      id: "typical",
      kind: "typical",
      title: "A typical month",
      detail: typical.sentence,
      stake: typical.moneyOut,
      confidence: Math.min(0.95, 0.5 + typical.months * 0.05),
      basis: `Median of ${typical.months} months.`,
      chart: [
        { label: "In", value: typical.moneyIn },
        { label: "Out", value: typical.moneyOut },
      ],
    });
  }
  const bills = /^\d{4}-\d{2}-\d{2}$/.test(today) ? recurringBills(transactions, categories, today) : null;
  if (bills?.length) {
    const yearly = bills.reduce((sum, bill) => sum + bill.yearly, 0);
    rows.push({
      id: "bills",
      kind: "bills",
      title: "Repeating bills",
      detail: `${bills.length} repeat. About ${formatMoney(yearly)} a year.`,
      stake: yearly,
      confidence: 0.8,
      basis: "Same name, similar amount, regular gap.",
      chart: bills.slice(0, 5).map((bill) => ({ label: bill.description.slice(0, 18), value: bill.usual })),
    });
  }
  const cycle = payCycle(transactions);
  if (cycle) {
    rows.push({
      id: "payday",
      kind: "payday",
      title: "After payday",
      detail: cycle.sentence,
      stake: cycle.days.reduce((sum, day) => sum + day.spend, 0),
      confidence: 0.7,
      basis: "Spending by day since the last paycheck.",
      chart: cycle.days.filter((day) => day.day % 2 === 0).map((day) => ({ label: `Day ${day.day}`, value: day.spend })),
    });
  }
  const cushion = runway(accounts, balances, transactions, categories);
  if (cushion) {
    rows.push({
      id: "runway",
      kind: "runway",
      title: "Cushion",
      detail: cushion.sentence,
      stake: cushion.cash,
      confidence: 0.75,
      basis: "Checking and savings balances divided by a typical month of spending. Cards and retirement are left out.",
    });
  }
  const ym = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today.slice(0, 7) : monthsInData(transactions).at(-1) ?? "";
  const trends = ym ? categoryTrends(transactions, categories, ym) : null;
  if (trends?.length) {
    const top = trends[0];
    rows.push({
      id: "trend",
      kind: "trend",
      title: `${top.name} is ${top.direction}`,
      detail: `${top.name} is ${formatMoney(Math.abs(top.delta))} ${top.direction === "down" ? "under" : "over"} its earlier average.`,
      stake: Math.abs(top.delta),
      confidence: 0.7,
      basis: "Last 3 months against the earlier average. Seasonal only after 13 months.",
      chart: trends.slice(0, 4).map((trend) => ({ label: trend.name, value: trend.delta })),
    });
  }
  const odd = unusualCharges(transactions, ym || undefined);
  if (odd?.length) {
    rows.push({
      id: "unusual",
      kind: "unusual",
      title: "Unusual charges",
      detail: odd[0].sentence,
      stake: odd[0].amount,
      confidence: 0.65,
      basis: "Above 3 times the usual amount, a first large charge, or a near duplicate within 3 days.",
    });
  }
  const income = incomeStability(transactions, categories);
  if (income) {
    rows.push({
      id: "income-stability",
      kind: "income",
      title: "Pay is " + income.label,
      detail: income.sentence,
      stake: income.high - income.low,
      confidence: 0.7,
      basis: "Highest month minus lowest, over the middle month, for up to 12 months.",
    });
  }
  const rates = savingsRateSeries(transactions, categories);
  if (rates) {
    const last = rates[rates.length - 1];
    rows.push({
      id: "savings-rate",
      kind: "savings",
      title: "What was left",
      detail: `${last.ym} left ${formatMoney(last.saved)} (${Math.round(last.rate * 100)}% of income).`,
      stake: Math.abs(last.saved),
      confidence: 0.8,
      basis: "Income minus spending, each month.",
      chart: rates.slice(-6).map((point) => ({ label: point.ym.slice(5), value: point.saved })),
    });
  }
  rows.sort((a, b) => b.stake * b.confidence - a.stake * a.confidence);
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.kind)) return false;
    seen.add(row.kind);
    return true;
  });
}

export function waitingUnlocks(
  transactions: Transaction[],
  categories: Category[],
  today: string,
): { id: string; title: string; detail: string }[] {
  const waiting: { id: string; title: string; detail: string }[] = [];
  if (!typicalMonth(transactions, categories)) waiting.push({ id: "wait-typical-month", title: "A typical month", detail: UNLOCK.typicalMonth });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !recurringBills(transactions, categories, today)) {
    waiting.push({ id: "wait-bills", title: "Repeating bills", detail: UNLOCK.recurringBills });
  }
  if (!payCycle(transactions)) waiting.push({ id: "wait-payday", title: "After payday", detail: UNLOCK.payCycle });
  if (!runway([], [], transactions, categories)) waiting.push({ id: "wait-runway", title: "Cushion", detail: UNLOCK.runway });
  const ym = today.slice(0, 7);
  if (!categoryTrends(transactions, categories, ym)) waiting.push({ id: "wait-trend", title: "Trends", detail: UNLOCK.categoryTrends });
  if (!incomeStability(transactions, categories)) waiting.push({ id: "wait-income", title: "How steady pay is", detail: UNLOCK.incomeStability });
  if (!savingsRateSeries(transactions, categories)) waiting.push({ id: "wait-rate", title: "Savings rate", detail: UNLOCK.savingsRate });
  return waiting;
}
