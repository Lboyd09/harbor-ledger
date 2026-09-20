import { formatMoney } from "./money.ts";
import { isWeekend, monthKeyFromDate, weekKeyFromDate, weekdayName } from "./parse-date.ts";
import { plannedForPeriod } from "./period.ts";
import { findRecurring } from "./recurring.ts";
import { countsInCashflow, periodCash, sumByCategory } from "./totals.ts";
import type { BudgetPeriod, Category, Transaction } from "./types.ts";

export type Insight = {
  id: string;
  title: string;
  body: string;
  tone: "good" | "warn" | "neutral";
};

export type MerchantSpend = {
  merchantKey: string;
  sample: string;
  spend: number;
  count: number;
};

export function activeRows(transactions: Transaction[]) {
  return transactions.filter(countsInCashflow);
}

export function spendOf(t: Transaction) {
  return t.amount < 0 ? -t.amount : 0;
}

export function topMerchants(transactions: Transaction[], limit = 8): MerchantSpend[] {
  const map = new Map<string, MerchantSpend>();
  for (const t of transactions) {
    if (!countsInCashflow(t) || t.amount >= 0) continue;
    const cur = map.get(t.merchantKey) ?? {
      merchantKey: t.merchantKey,
      sample: t.description,
      spend: 0,
      count: 0,
    };
    cur.spend += -t.amount;
    cur.count += 1;
    map.set(t.merchantKey, cur);
  }
  return [...map.values()].sort((a, b) => b.spend - a.spend).slice(0, limit);
}

export function weekdaySpend(transactions: Transaction[]) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => ({
    name,
    spend: 0,
    count: 0,
  }));
  for (const t of transactions) {
    if (!countsInCashflow(t) || t.amount >= 0) continue;
    const label = weekdayName(t.date);
    const row = days.find((d) => d.name === label);
    if (!row) continue;
    row.spend += -t.amount;
    row.count += 1;
  }
  return days;
}

export function weekendSplit(transactions: Transaction[]) {
  let weekend = 0;
  let weekday = 0;
  let weekendDays = 0;
  let weekdayDays = 0;
  const seenW = new Set<string>();
  const seenD = new Set<string>();
  for (const t of transactions) {
    if (!countsInCashflow(t) || t.amount >= 0) continue;
    if (isWeekend(t.date)) {
      weekend += -t.amount;
      if (!seenW.has(t.date)) {
        seenW.add(t.date);
        weekendDays += 1;
      }
    } else {
      weekday += -t.amount;
      if (!seenD.has(t.date)) {
        seenD.add(t.date);
        weekdayDays += 1;
      }
    }
  }
  return {
    weekend,
    weekday,
    weekendAvg: weekendDays ? weekend / weekendDays : 0,
    weekdayAvg: weekdayDays ? weekday / weekdayDays : 0,
  };
}

export function dailyAverage(transactions: Transaction[], period: BudgetPeriod) {
  const days = period === "week" ? 7 : 30;
  const spend = transactions.filter(countsInCashflow).reduce((s, t) => s + spendOf(t), 0);
  return spend / days;
}

export function categoryShares(
  transactions: Transaction[],
  categories: Category[],
  period: BudgetPeriod,
  key: string,
) {
  const map = sumByCategory(transactions, key, "expense", categories, period);
  const total = [...map.values()].reduce((s, n) => s + Math.max(0, n), 0);
  return categories
    .filter((c) => c.kind === "expense")
    .map((c) => {
      const actual = Math.max(0, map.get(c.id) ?? 0);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        actual,
        plan: plannedForPeriod(c.plannedMonthly, period),
        share: total > 0 ? actual / total : 0,
      };
    })
    .filter((r) => r.actual > 0 || r.plan > 0)
    .sort((a, b) => b.actual - a.actual);
}

export function habitInsights(
  transactions: Transaction[],
  categories: Category[],
  period: BudgetPeriod,
  key: string,
  previousKey: string,
): Insight[] {
  const out: Insight[] = [];
  const now = periodCash(transactions, period, key, categories);
  const prev = periodCash(transactions, period, previousKey, categories);
  const shares = categoryShares(transactions, categories, period, key);
  const spendTotal = shares.reduce((s, r) => s + r.actual, 0);
  const inKey = transactions.filter((t) =>
    period === "week" ? weekKeyFromDate(t.date) === key : monthKeyFromDate(t.date) === key,
  );
  const split = weekendSplit(inKey);
  const rec = findRecurring(transactions);
  const monthlyRecurring = rec
    .filter((g) => g.interval === "weekly" || g.interval === "biweekly" || g.interval === "monthly")
    .reduce((s, g) => {
      const amt = Math.abs(g.avgAmount);
      if (g.interval === "weekly") return s + amt * 4.345;
      if (g.interval === "biweekly") return s + amt * 2.17;
      return s + amt;
    }, 0);

  if (now.count > 0 && prev.count > 0) {
    const delta = now.expenses - prev.expenses;
    if (Math.abs(delta) >= 5) {
      out.push({
        id: "wow",
        title: delta < 0 ? "Spending cooled off" : "Spending picked up",
        body:
          delta < 0
            ? `This ${period} is ${formatMoney(-delta)} lighter than the last one.`
            : `This ${period} is ${formatMoney(delta)} heavier than the last one.`,
        tone: delta < 0 ? "good" : "warn",
      });
    }
  }

  const dining = shares.find((s) => /dining|eat/i.test(s.slug) || /dining|eat/i.test(s.name));
  const food = shares.find((s) => s.slug === "food" || /grocer/i.test(s.name));
  if (dining && spendTotal > 0) {
    const pct = Math.round(dining.share * 100);
    out.push({
      id: "dining",
      title: "Eating out",
      body: `Dining is ${pct}% of spending this ${period}${dining.plan > 0 && dining.actual > dining.plan ? `, ${formatMoney(dining.actual - dining.plan)} over the envelope` : ""}.`,
      tone: dining.plan > 0 && dining.actual > dining.plan ? "warn" : "neutral",
    });
  }
  if (food && dining && food.actual + dining.actual > 0) {
    const foodShare = food.actual / (food.actual + dining.actual);
    if (foodShare < 0.45 && dining.actual > 40) {
      out.push({
        id: "food-mix",
        title: "Groceries vs restaurants",
        body: `Restaurants are running ahead of groceries (${formatMoney(dining.actual)} vs ${formatMoney(food.actual)}). A common split is the other way around.`,
        tone: "warn",
      });
    }
  }

  if (split.weekendAvg > 0 && split.weekdayAvg > 0 && split.weekendAvg > split.weekdayAvg * 1.25) {
    out.push({
      id: "weekend",
      title: "Weekend premium",
      body: `Weekend days average ${formatMoney(split.weekendAvg)}; weekdays average ${formatMoney(split.weekdayAvg)}.`,
      tone: "neutral",
    });
  }

  if (monthlyRecurring > 0) {
    const income = categories.filter((c) => c.kind === "income").reduce((s, c) => s + c.plannedMonthly, 0);
    const pct = income > 0 ? Math.round((monthlyRecurring / income) * 100) : 0;
    out.push({
      id: "repeat",
      title: "Repeating charges",
      body:
        income > 0
          ? `Known repeats take about ${formatMoney(monthlyRecurring)} in a typical month — ${pct}% of planned take-home.`
          : `Known repeats take about ${formatMoney(monthlyRecurring)} in a typical month.`,
      tone: pct >= 30 ? "warn" : "neutral",
    });
  }

  const over = shares.filter((s) => s.plan > 0 && s.actual > s.plan);
  if (over.length) {
    out.push({
      id: "over",
      title: over.length === 1 ? "One envelope is over" : `${over.length} envelopes are over`,
      body: over
        .slice(0, 3)
        .map((s) => `${s.name} ${formatMoney(s.actual - s.plan)} over`)
        .join(". "),
      tone: "warn",
    });
  }

  if (now.uncategorized > 0) {
    out.push({
      id: "open",
      title: "Open rows",
      body: `${now.uncategorized} ${now.uncategorized === 1 ? "row still needs" : "rows still need"} a category this ${period} before the picture is complete.`,
      tone: "warn",
    });
  }

  if (now.refunds > 0) {
    out.push({
      id: "refunds",
      title: "Refunds in this period",
      body: `${now.refunds} ${now.refunds === 1 ? "row is" : "rows are"} marked as a refund or reimbursement and reduce the matching expense bucket.`,
      tone: "good",
    });
  }

  const leftoverPlan = categories
    .filter((c) => c.kind === "income")
    .reduce((s, c) => s + plannedForPeriod(c.plannedMonthly, period), 0)
    - categories
      .filter((c) => c.kind === "expense")
      .reduce((s, c) => s + plannedForPeriod(c.plannedMonthly, period), 0);
  if (Math.abs(leftoverPlan) >= 1) {
    out.push({
      id: "assign",
      title: leftoverPlan > 0 ? "Ready to assign" : "Plan is over-assigned",
      body:
        leftoverPlan > 0
          ? `${formatMoney(leftoverPlan)} of planned income has no job yet. Give it a category on Plan.`
          : `Planned expenses exceed planned income by ${formatMoney(-leftoverPlan)}. Cut an envelope or raise expected income.`,
      tone: leftoverPlan > 0 ? "neutral" : "warn",
    });
  }

  if (now.net > 0 && now.count > 3) {
    out.push({
      id: "net",
      title: "This period is in the black",
      body: `In ${formatMoney(now.income)} · out ${formatMoney(now.expenses)} · leftover ${formatMoney(now.net)}.`,
      tone: "good",
    });
  } else if (now.net < 0 && now.count > 3) {
    out.push({
      id: "net-out",
      title: "This period spent more than it took in",
      body: `Outflow ${formatMoney(-now.net)} after income of ${formatMoney(now.income)}.`,
      tone: "warn",
    });
  }

  return out.slice(0, 8);
}
