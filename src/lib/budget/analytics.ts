import { rankedInsights, waitingUnlocks } from "./analytics-depth.ts";
import { monthLedger } from "./ledger-month.ts";
import { formatMoney, roundMoney } from "./money.ts";
import { monthCash, monthsInData } from "./totals.ts";
import { planAmount, planTotal } from "./plans.ts";
import { weekdayName } from "./parse-date.ts";
import type { Category, MonthBudget, Transaction } from "./types.ts";

export type InsightItem = {
  id: string;
  title: string;
  detail: string;
  /** How the number was worked out. Missing on older readings. */
  basis?: string;
  /** Small chart. Missing when there is nothing to draw. */
  chart?: { label: string; value: number }[];
};

export type FileInsights = {
  items: InsightItem[];
  waiting: InsightItem[];
};

export type MonthEndForecast = {
  ym: string;
  today: string;
  spentSoFar: number;
  projectedSpend: number;
  /** Lower end of the pace band. The same today always gives the same band. */
  low: number;
  /** Upper end of the pace band. */
  high: number;
  planned: number | null;
  /** Expected income minus projected spending. */
  projectedLeft: number;
  sentence: string;
};

export type PriceChange = {
  merchantKey: string;
  description: string;
  before: number;
  after: number;
  delta: number;
};

export type StoppedBill = {
  merchantKey: string;
  description: string;
  lastDate: string;
  lastAmount: number;
  quietDays: number;
};

export type OneOffCharge = {
  description: string;
  amount: number;
  ym: string;
  share: number;
};

export type YearBoundary = {
  december: string;
  january: string;
  decemberSpend: number;
  januarySpend: number;
  delta: number;
  sentence: string;
};

export type QuietMonth = {
  ym: string;
  sentence: string;
};

export type FreshAccount = {
  ym: string;
  moneyIn: number;
  moneyOut: number;
  topCategory: string | null;
  chargeCount: number;
  sentence: string;
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clip(value: string, max = 48): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function validDay(today: string): { ym: string; day: number; days: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > days) return null;
  return { ym: `${match[1]}-${match[2]}`, day, days };
}

function daysBetween(a: string, b: string): number {
  const left = Date.parse(`${a}T00:00:00Z`);
  const right = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.round((right - left) / 86400000);
}

function latestDate(transactions: Transaction[]): string | null {
  let best: string | null = null;
  for (const row of transactions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    if (!best || row.date > best) best = row.date;
  }
  return best;
}

/** Posted money out. Transfers, paybacks, and excluded rows do not count. */
function expenses(transactions: Transaction[], ym?: string, through?: string): Transaction[] {
  return transactions.filter((row) => {
    if (row.excluded || row.amount >= 0) return false;
    if (row.status === "transfer" || row.status === "reimbursement") return false;
    if (ym && !row.date.startsWith(ym)) return false;
    if (through && row.date > through) return false;
    return true;
  });
}

function plannedSpend(categories: Category[], ym: string, budgets: MonthBudget[]): number {
  return planTotal(categories, ym, budgets);
}

function isOneOff(row: Transaction, pool: Transaction[], siblings: Transaction[]): boolean {
  const amount = Math.abs(row.amount);
  if (amount < 80) return false;
  const seen = pool.filter((item) => item.merchantKey === row.merchantKey).length;
  if (seen !== 1) return false;
  if (siblings.length < 4) return false;
  const others = siblings.filter((item) => item.id !== row.id).map((item) => Math.abs(item.amount));
  const mid = median(others.length ? others : [0]);
  return amount >= Math.max(80, mid * 2.5);
}

/**
 * Where this month is headed, using only `today`. The same today always returns the same numbers.
 * Null when today is not inside the month, or when there is nothing to read (no charges and no plan).
 */
export function monthEndForecast(input: {
  transactions: Transaction[];
  categories: Category[];
  ym: string;
  today: string;
  budgets?: MonthBudget[];
}): MonthEndForecast | null {
  const parsed = validDay(input.today);
  if (!parsed || !/^\d{4}-\d{2}$/.test(input.ym) || parsed.ym !== input.ym) return null;
  const budgets = input.budgets ?? [];
  const plannedTotal = plannedSpend(input.categories, input.ym, budgets);
  const history = input.transactions.some((row) => row.date <= input.today);
  if (!history && plannedTotal <= 0) return null;

  const rows = expenses(input.transactions, input.ym, input.today);
  const oneOffs = rows.filter((row) => isOneOff(row, expenses(input.transactions), rows));
  const oneOffTotal = roundMoney(oneOffs.reduce((sum, row) => sum + Math.abs(row.amount), 0));
  const throughToday = input.transactions.filter((row) => row.date <= input.today);
  const spentSoFar = monthLedger(
    { transactions: throughToday, categories: input.categories, budgets, style: "monthly" },
    input.ym,
  ).totals.spent;
  const paceBase = roundMoney(spentSoFar - oneOffTotal);
  const projectedSpend = roundMoney(oneOffTotal + paceBase * (parsed.days / parsed.day));
  const remaining = parsed.day > 0 ? paceBase * ((parsed.days - parsed.day) / parsed.day) : 0;
  const low = roundMoney(oneOffTotal + paceBase + remaining * 0.75);
  const high = roundMoney(oneOffTotal + paceBase + remaining * 1.25);
  const planned = plannedTotal > 0 ? plannedTotal : null;
  const expectedIncome = roundMoney(
    input.categories
      .filter((category) => category.kind === "income")
      .reduce((sum, category) => sum + planAmount(category, input.ym, budgets), 0),
  );
  const projectedLeft = roundMoney(expectedIncome - projectedSpend);
  let sentence = "";
  if (spentSoFar > 0.004) {
    const ending =
      projectedLeft < -0.004
        ? `On pace to end ${formatMoney(Math.abs(projectedLeft))} short.`
        : `On pace to end with ${formatMoney(projectedLeft)} left.`;
    sentence = `Spending on pace for ${formatMoney(projectedSpend)} this month. ${ending}`;
  }
  return { ym: input.ym, today: input.today, spentSoFar, projectedSpend, low, high, planned, projectedLeft, sentence };
}

/** The largest rise in a repeating charge. Null until some name has been seen at least three times. */
export function priceIncrease(transactions: Transaction[]): PriceChange | null {
  const groups = new Map<string, Transaction[]>();
  for (const row of expenses(transactions)) {
    const list = groups.get(row.merchantKey) ?? [];
    list.push(row);
    groups.set(row.merchantKey, list);
  }
  let best: PriceChange | null = null;
  let enough = false;
  for (const [merchantKey, list] of groups) {
    if (list.length < 3) continue;
    enough = true;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const earlier = sorted.slice(0, -1).map((row) => Math.abs(row.amount));
    const before = roundMoney(median(earlier));
    const after = roundMoney(Math.abs(sorted[sorted.length - 1].amount));
    const delta = roundMoney(after - before);
    if (delta <= 0.5 || after < before * 1.05) continue;
    if (!best || delta > best.delta) {
      best = {
        merchantKey,
        description: sorted[sorted.length - 1].description,
        before,
        after,
        delta,
      };
    }
  }
  if (!enough) return null;
  return best;
}

/**
 * A monthly bill that stopped showing up. Null without two repeats, or when today is not a real date.
 * A bill that posts in December and again in January is not stopped.
 */
export function stoppedBill(transactions: Transaction[], today: string): StoppedBill | null {
  if (!validDay(today)) return null;
  const groups = new Map<string, Transaction[]>();
  for (const row of expenses(transactions).filter((row) => row.date <= today)) {
    const list = groups.get(row.merchantKey) ?? [];
    list.push(row);
    groups.set(row.merchantKey, list);
  }
  let best: StoppedBill | null = null;
  let enough = false;
  for (const [merchantKey, list] of groups) {
    if (list.length < 2) continue;
    enough = true;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (gap > 0) gaps.push(gap);
    }
    if (!gaps.length) continue;
    const gap = median(gaps);
    if (gap < 26 || gap > 40) continue;
    const last = sorted[sorted.length - 1];
    const quietDays = daysBetween(last.date, today);
    if (quietDays <= Math.max(40, gap * 1.6)) continue;
    if (!best || quietDays > best.quietDays) {
      best = {
        merchantKey,
        description: last.description,
        lastDate: last.date,
        lastAmount: roundMoney(Math.abs(last.amount)),
        quietDays,
      };
    }
  }
  if (!enough) return null;
  return best;
}

/** A single large charge that never repeats. Null without at least four expenses in the month. */
export function oneOffCharge(transactions: Transaction[], ym: string): OneOffCharge | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const rows = expenses(transactions, ym);
  if (rows.length < 4) return null;
  const all = expenses(transactions);
  const monthTotal = rows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
  let best: OneOffCharge | null = null;
  for (const row of rows) {
    if (!isOneOff(row, all, rows)) continue;
    const amount = roundMoney(Math.abs(row.amount));
    if (!best || amount > best.amount) {
      best = {
        description: row.description,
        amount,
        ym,
        share: monthTotal > 0 ? roundMoney(amount / monthTotal) : 0,
      };
    }
  }
  return best;
}

/** December of the previous year against January. Null if either month is missing from the file. */
export function yearBoundary(transactions: Transaction[], categories: Category[], year: number): YearBoundary | null {
  if (!Number.isInteger(year)) return null;
  const december = `${year - 1}-12`;
  const january = `${year}-01`;
  const inDecember = transactions.some((row) => row.date.startsWith(december));
  const inJanuary = transactions.some((row) => row.date.startsWith(january));
  if (!inDecember || !inJanuary) return null;
  const decemberSpend = roundMoney(monthCash(transactions, december, categories).expenses);
  const januarySpend = roundMoney(monthCash(transactions, january, categories).expenses);
  const delta = roundMoney(januarySpend - decemberSpend);
  const sentence =
    decemberSpend <= 0.004 && januarySpend <= 0.004
      ? "December and January both had no spending."
      : decemberSpend <= 0.004
        ? `December had no spending. January spent ${formatMoney(januarySpend)}.`
        : januarySpend <= 0.004
          ? `January had no spending, after ${formatMoney(decemberSpend)} in December.`
          : delta > 0.5
            ? `January spent ${formatMoney(delta)} more than December.`
            : delta < -0.5
              ? `January spent ${formatMoney(Math.abs(delta))} less than December.`
              : "January and December spent about the same.";
  return { december, january, decemberSpend, januarySpend, delta, sentence };
}

/** A month inside a longer file where nothing was spent. Null with fewer than two months, or when every month spent. */
export function quietMonth(transactions: Transaction[], categories: Category[]): QuietMonth | null {
  const months = monthsInData(transactions);
  if (months.length < 2) return null;
  const quiet = months.filter((ym) => monthCash(transactions, ym, categories).expenses <= 0.004);
  const loud = months.filter((ym) => monthCash(transactions, ym, categories).expenses > 0.004);
  if (!quiet.length || !loud.length) return null;
  const ym = quiet[quiet.length - 1];
  return { ym, sentence: `${ym} had no spending. The other months did.` };
}

/** A file that only covers one month. Null when it is empty or already has a second month. */
export function freshAccount(transactions: Transaction[], categories: Category[]): FreshAccount | null {
  if (!transactions.length) return null;
  const months = monthsInData(transactions);
  if (months.length !== 1) return null;
  const ym = months[0];
  const cash = monthCash(transactions, ym, categories);
  let topCategory: string | null = null;
  let top = 0;
  const byId = new Map<string, number>();
  for (const row of expenses(transactions, ym)) {
    if (!row.categoryId) continue;
    byId.set(row.categoryId, (byId.get(row.categoryId) ?? 0) + Math.abs(row.amount));
  }
  for (const [id, amount] of byId) {
    if (amount > top) {
      top = amount;
      topCategory = categories.find((category) => category.id === id)?.name ?? null;
    }
  }
  const sentence = topCategory
    ? `One month so far, ${ym}. ${formatMoney(cash.expenses)} went out, mostly ${topCategory}.`
    : `One month so far, ${ym}. ${formatMoney(cash.expenses)} went out.`;
  return {
    ym,
    moneyIn: roundMoney(cash.income),
    moneyOut: roundMoney(cash.expenses),
    topCategory,
    chargeCount: transactions.length,
    sentence,
  };
}

function moneyItem(transactions: Transaction[], categories: Category[]): InsightItem | null {
  const months = monthsInData(transactions);
  if (!months.length) return null;
  let moneyIn = 0;
  let moneyOut = 0;
  for (const ym of months) {
    const cash = monthCash(transactions, ym, categories);
    moneyIn += cash.income;
    moneyOut += cash.expenses;
  }
  moneyIn = roundMoney(moneyIn);
  moneyOut = roundMoney(moneyOut);
  if (moneyIn <= 0.004 && moneyOut <= 0.004) return null;
  const span = months.length === 1 ? months[0] : `${months[0]} to ${months[months.length - 1]}`;
  return {
    id: "money",
    title: months.length === 1 ? "This month" : "Across the file",
    detail: `${formatMoney(moneyOut)} went out and ${formatMoney(moneyIn)} came in (${span}).`,
  };
}

function topCategoryItem(transactions: Transaction[], categories: Category[]): InsightItem | null {
  const totals = new Map<string, number>();
  for (const row of expenses(transactions)) {
    if (!row.categoryId) continue;
    totals.set(row.categoryId, (totals.get(row.categoryId) ?? 0) + Math.abs(row.amount));
  }
  let bestId: string | null = null;
  let best = 0;
  for (const [id, amount] of totals) {
    if (amount > best) {
      best = amount;
      bestId = id;
    }
  }
  if (!bestId) return null;
  const name = categories.find((category) => category.id === bestId)?.name ?? "That category";
  const out = expenses(transactions).reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const share = out > 0 ? Math.round((best / out) * 100) : 0;
  return { id: "top-category", title: name, detail: `${formatMoney(best)} of the spending, about ${share}%.` };
}

function largestItem(transactions: Transaction[]): InsightItem | null {
  const rows = expenses(transactions);
  if (!rows.length) return null;
  const top = [...rows].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || a.date.localeCompare(b.date))[0];
  return {
    id: "largest",
    title: "Largest charge",
    detail: `${clip(top.description)} was ${formatMoney(Math.abs(top.amount))} on ${top.date}.`,
  };
}

function weekdayItem(transactions: Transaction[]): InsightItem | null {
  const rows = expenses(transactions);
  if (!rows.length) return null;
  const sums = new Map<string, number>();
  for (const row of rows) {
    const name = weekdayName(row.date);
    sums.set(name, (sums.get(name) ?? 0) + Math.abs(row.amount));
  }
  const ranked = [...sums.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [name, amount] = ranked[0];
  return { id: "weekday", title: "Busiest day", detail: `${name} had the most spending, ${formatMoney(amount)}.` };
}

/**
 * What a file can already say, plus what is waiting on more history.
 * Null when there are no charges. One month still returns several items and a waiting list.
 * `today` defaults to the latest date in the file, so the result does not depend on the clock.
 */
export function fileInsights(transactions: Transaction[], categories: Category[], today?: string): FileInsights | null {
  if (!transactions.length) return null;
  const asOf = today && validDay(today) ? today : latestDate(transactions);
  const items: InsightItem[] = [];
  const money = moneyItem(transactions, categories);
  if (money) items.push(money);
  const top = topCategoryItem(transactions, categories);
  if (top) items.push(top);
  const largest = largestItem(transactions);
  if (largest) items.push(largest);
  const weekday = weekdayItem(transactions);
  if (weekday) items.push(weekday);

  const fresh = freshAccount(transactions, categories);
  if (fresh) items.push({ id: "fresh", title: "A fresh account", detail: fresh.sentence });

  const months = monthsInData(transactions);
  const focus = asOf ? asOf.slice(0, 7) : months[months.length - 1];
  if (asOf && focus) {
    const forecast = monthEndForecast({ transactions, categories, ym: focus, today: asOf });
    if (forecast && forecast.spentSoFar > 0.004) {
      items.push({ id: "forecast", title: "If this pace holds", detail: forecast.sentence });
    }
  }
  const raised = priceIncrease(transactions);
  if (raised) {
    items.push({
      id: "price",
      title: "A price went up",
      detail: `${clip(raised.description)} is ${formatMoney(raised.after)}, up ${formatMoney(raised.delta)} from ${formatMoney(raised.before)}.`,
    });
  }
  if (asOf) {
    const stopped = stoppedBill(transactions, asOf);
    if (stopped) {
      items.push({
        id: "stopped",
        title: "A bill stopped",
        detail: `${clip(stopped.description)} last posted ${stopped.lastDate} and has been quiet for ${stopped.quietDays} days.`,
      });
    }
  }
  if (focus) {
    const once = oneOffCharge(transactions, focus);
    if (once) {
      items.push({
        id: "one-off",
        title: "A one-time charge",
        detail: `${clip(once.description)} was ${formatMoney(once.amount)} and does not repeat.`,
      });
    }
  }
  const quiet = quietMonth(transactions, categories);
  if (quiet) items.push({ id: "quiet", title: "A quiet month", detail: quiet.sentence });
  if (asOf) {
    const boundary = yearBoundary(transactions, categories, Number(asOf.slice(0, 4)));
    if (boundary) items.push({ id: "year-boundary", title: "Across the year", detail: boundary.sentence });
  }
  const open = transactions.filter((row) => !row.categoryId && row.amount < 0 && !row.excluded && row.status !== "transfer").length;
  if (open > 0) {
    items.push({
      id: "unsorted",
      title: "Still unsorted",
      detail: `${open} charge${open === 1 ? "" : "s"} ${open === 1 ? "has" : "have"} no category yet.`,
    });
  }

  const waiting: InsightItem[] = [];
  if (!raised) {
    waiting.push({
      id: "wait-price",
      title: "Price changes",
      detail: "A price increase needs the same bill at least three times.",
    });
  }
  if (!asOf || !stoppedBill(transactions, asOf)) {
    waiting.push({
      id: "wait-stopped",
      title: "Stopped bills",
      detail: "A stopped bill needs a monthly repeat that then goes quiet.",
    });
  }
  if (months.length < 2) {
    waiting.push({
      id: "wait-typical",
      title: "A typical month",
      detail: "Comparing this month with a usual one needs at least one more month.",
    });
  }
  if (!asOf || !yearBoundary(transactions, categories, Number(asOf.slice(0, 4)))) {
    waiting.push({
      id: "wait-year",
      title: "December and January",
      detail: "A year boundary needs both December and January in the file.",
    });
  }
  const ranked = rankedInsights(transactions, categories, asOf ?? "1970-01-01");
  for (const row of ranked) {
    if (items.some((item) => item.id === row.id)) continue;
    items.push({
      id: row.id,
      title: row.title,
      detail: row.detail,
      basis: row.basis,
      chart: row.chart,
    });
  }
  for (const row of waitingUnlocks(transactions, categories, asOf ?? "")) {
    if (waiting.some((item) => item.id === row.id || item.title === row.title)) continue;
    waiting.push(row);
  }
  return { items, waiting };
}
