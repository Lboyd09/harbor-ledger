import { carryStatus, nextMonthAllowance, type CarryContext } from "./carry.ts";
import { monthLedger } from "./ledger-month.ts";
import { weekdaySpend } from "./habits.ts";
import { displayMerchant } from "./merchant.ts";
import { formatMoney, roundMoney } from "./money.ts";
import { groupMonth } from "./month-view.ts";
import { monthLabel } from "./parse-date.ts";
import { findRecurringAll } from "./recurring.ts";
import { monthCash, monthsInData } from "./totals.ts";
import type { BudgetStyle, Category, MonthBudget, RecurringInterval, Transaction } from "./types.ts";

export type SideTone = "neutral" | "good" | "warn" | "danger";

/** One category on the money-in or money-out side. The words match the bar. */
export type SideRow = {
  id: string;
  name: string;
  primary: string;
  detail: string;
  tone: SideTone;
  /** What happened: received or spent. */
  amount: number;
  /** What it is compared with: usual income, or the plan. */
  mark: number;
  /** What is left in a spending category. A carrying category’s left is its carry-out. */
  left?: number;
  /** Bar fill. Over 100 means past the mark. */
  fill: number;
};

export type FileReadout = {
  headline: string;
  lines: string[];
  moneyIn: number;
  moneyOut: number;
  monthCount: number;
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function everyLabel(interval: RecurringInterval): string {
  if (interval === "weekly") return "every week";
  if (interval === "biweekly") return "about every two weeks";
  if (interval === "monthly") return "about every month";
  return "now and then";
}

export function incomeRows(input: {
  transactions: Transaction[];
  categories: Category[];
  ym: string;
  budgets?: MonthBudget[];
  profile?: import("./types.ts").Profile | null;
}): SideRow[] {
  const ledger = monthLedger(
    { transactions: input.transactions, categories: input.categories, budgets: input.budgets, style: "monthly", profile: input.profile },
    input.ym,
  );
  return ledger.income.map((line) => {
    const amount = line.received;
    const mark = line.expected;
    const delta = line.variance;
    let primary = `${formatMoney(amount)} in`;
    let tone: SideTone = "neutral";
    if (mark > 0.004) {
      if (Math.abs(delta) < 1) primary = "Same as usual";
      else if (delta > 0) {
        primary = `${formatMoney(delta)} more than usual`;
        tone = "good";
      } else {
        primary = `${formatMoney(Math.abs(delta))} less than usual`;
        tone = "warn";
      }
    }
    const detail =
      mark > 0.004
        ? `Received ${formatMoney(amount)}. Usual is ${formatMoney(mark)}.`
        : `Received ${formatMoney(amount)}. No usual amount yet.`;
    const fill = mark > 0.004 ? (amount / mark) * 100 : amount > 0 ? 100 : 0;
    return { id: line.id, name: line.name, primary, detail, tone, amount, mark, fill };
  });
}

export function spendingRows(input: {
  transactions: Transaction[];
  categories: Category[];
  ym: string;
  budgets?: MonthBudget[];
  style: BudgetStyle;
  carryStartMonth?: string | null;
  setAsides?: import("./types.ts").SetAside[];
}): SideRow[] {
  const budgets = input.budgets ?? [];
  const ledger = monthLedger(
    {
      transactions: input.transactions,
      categories: input.categories,
      budgets,
      style: input.style,
      carryStartMonth: input.carryStartMonth,
      setAsides: input.setAsides,
    },
    input.ym,
  );
  const ctx: CarryContext = {
    transactions: input.transactions,
    categories: input.categories,
    budgets,
    carryStartMonth: input.carryStartMonth || input.ym,
  };
  return ledger.spending.map((line) => {
    const category = input.categories.find((row) => row.id === line.id);
    if (line.carries && category) {
      const left = line.left;
      const spent = line.spent;
      const plan = line.planned;
      const status = carryStatus(category, input.ym, ctx);
      const allowance = nextMonthAllowance(category, input.ym, ctx);
      const primary = left < -0.004 ? `${formatMoney(Math.abs(left))} over` : `${formatMoney(left)} left`;
      let detail = `Spent ${formatMoney(spent)} of ${formatMoney(plan)} this month.`;
      if (status === "over" || allowance.cutBack) {
        detail = `Over. Next month starts at ${formatMoney(allowance.amount)}. Cut back until this is caught up.`;
      } else if (status === "extra") {
        detail = `Extra left. Next month can spend ${formatMoney(allowance.amount)}.`;
      } else if (plan > 0 || spent > 0) {
        detail = `Even. Next month starts at ${formatMoney(allowance.amount)}.`;
      }
      const available = roundMoney(line.carryIn + plan);
      const fill = left < -0.004 ? 100 : available > 0.004 ? (Math.max(0, left) / available) * 100 : 0;
      return { id: line.id, name: line.name, primary, detail, tone: left < -0.004 ? "danger" as const : "neutral" as const, amount: spent, mark: plan, left, fill };
    }
    const spent = Math.max(0, line.spent);
    const plan = line.planned;
    const left = roundMoney(plan - spent);
    const primary =
      plan <= 0.004 ? `${formatMoney(spent)} spent` : left < -0.004 ? `${formatMoney(Math.abs(left))} over` : `${formatMoney(left)} left`;
    const detail =
      plan > 0.004
        ? `Spent ${formatMoney(spent)} of ${formatMoney(plan)}. Next month starts over.`
        : `Spent ${formatMoney(spent)}. No monthly amount yet.`;
    return {
      id: line.id,
      name: line.name,
      primary,
      detail,
      tone: left < -0.004 && plan > 0.004 ? "danger" as const : "neutral" as const,
      amount: spent,
      mark: plan,
      left,
      fill: plan > 0.004 ? (spent / plan) * 100 : spent > 0 ? 100 : 0,
    };
  });
}

/**
 * Read a file, or a whole ledger, without asking for more numbers.
 * A typical month, what repeats, and what changed — only when the charges support it.
 */
export function fileReadout(transactions: Transaction[], categories: Category[]): FileReadout {
  if (!transactions.length) {
    return { headline: "Nothing to read yet.", lines: [], moneyIn: 0, moneyOut: 0, monthCount: 0 };
  }
  const months = monthsInData(transactions);
  const outs: number[] = [];
  const ins: number[] = [];
  let moneyIn = 0;
  let moneyOut = 0;
  const byCategory = new Map<string, number>();
  for (const ym of months) {
    const cash = monthCash(transactions, ym, categories);
    moneyIn += cash.income;
    moneyOut += cash.expenses;
    if (cash.income > 0.004 || cash.expenses > 0.004) {
      ins.push(cash.income);
      outs.push(cash.expenses);
    }
    const layout = groupMonth(transactions, categories, ym, []);
    for (const group of layout.expenses) {
      if (!group.id || group.id === "money-back" || group.open) continue;
      byCategory.set(group.id, (byCategory.get(group.id) ?? 0) + group.total);
    }
  }
  moneyIn = roundMoney(moneyIn);
  moneyOut = roundMoney(moneyOut);
  const typicalOut = roundMoney(median(outs));
  const typicalIn = roundMoney(median(ins));

  let topName: string | null = null;
  let topAmount = 0;
  for (const [id, amount] of byCategory) {
    if (amount > topAmount) {
      topAmount = amount;
      topName = categories.find((category) => category.id === id)?.name ?? null;
    }
  }
  const topShare = moneyOut > 0.004 && topName ? Math.round((topAmount / moneyOut) * 100) : 0;

  const repeats = findRecurringAll(transactions);
  const pay = repeats.find((row) => row.direction === "in" && row.interval !== "irregular");
  const bill = repeats.find((row) => row.direction === "out" && row.interval !== "irregular");
  const uncategorized = transactions.filter(
    (row) => !row.excluded && row.amount < 0 && !row.categoryId && row.status !== "transfer" && row.status !== "reimbursement",
  ).length;
  const days = weekdaySpend(transactions);
  const busiest = [...days].sort((a, b) => b.spend - a.spend)[0];

  const lines: string[] = [];
  if (outs.length >= 2) {
    lines.push(`A typical month has about ${formatMoney(typicalOut)} going out and ${formatMoney(typicalIn)} coming in.`);
  }
  if (topName && topShare > 0) {
    lines.push(`${topName} is the largest spending category, about ${topShare}% of money out.`);
  }
  if (pay) {
    lines.push(`Pay from ${displayMerchant(pay.sampleDescription)} looks like ${everyLabel(pay.interval)}, about ${formatMoney(pay.avgAmount)}.`);
  }
  if (bill) {
    lines.push(`${displayMerchant(bill.sampleDescription)} repeats ${everyLabel(bill.interval)}, about ${formatMoney(bill.avgAmount)}.`);
  }
  if (uncategorized > 0) {
    lines.push(`${uncategorized} charge${uncategorized === 1 ? "" : "s"} have no category yet.`);
  }
  if (busiest && busiest.spend > 0.004 && lines.length < 5) {
    lines.push(`More spending lands on ${busiest.name} than on other days.`);
  }

  let headline = `${formatMoney(moneyIn)} came in and ${formatMoney(moneyOut)} went out.`;
  if (!months.length) headline = "Nothing to read yet.";
  else if (months.length === 1) headline = `${monthLabel(months[0])} has ${formatMoney(moneyIn)} in and ${formatMoney(moneyOut)} out.`;
  else if (typicalOut > 0) {
    headline = `Across ${months.length} months, a typical month spends about ${formatMoney(typicalOut)}.`;
    if (topName) headline += ` ${topName} is the biggest piece.`;
  }

  return {
    headline,
    lines: lines.slice(0, 5),
    moneyIn,
    moneyOut,
    monthCount: months.length,
  };
}
