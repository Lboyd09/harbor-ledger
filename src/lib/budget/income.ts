import { roundMoney } from "./money.ts";
import type { IncomeStream, MonthBudget, Profile } from "./types.ts";

/** Monthly equivalent of one income source. */
export function expectedMonthlyOf(stream: IncomeStream): number {
  const amount = Math.max(0, stream.amount || 0);
  if (stream.cadence === "weekly") return roundMoney((amount * 52) / 12);
  if (stream.cadence === "biweekly") return roundMoney((amount * 26) / 12);
  if (stream.cadence === "twice-monthly") return roundMoney(amount * 2);
  return roundMoney(amount);
}

/**
 * Expected income for one month. A month budget on a source's income category
 * replaces that source for that month only. profile.monthlyIncome is not added on top.
 */
export function expectedIncomeForMonth(profile: Profile, ym: string, budgets: MonthBudget[] = []): number {
  let sum = 0;
  for (const stream of profile.incomeStreams ?? []) {
    const hit =
      stream.categoryId && /^\d{4}-\d{2}$/.test(ym)
        ? budgets.find((b) => b.categoryId === stream.categoryId && b.ym === ym)
        : undefined;
    sum += hit && Number.isFinite(hit.amount) ? Math.max(0, hit.amount) : expectedMonthlyOf(stream);
  }
  return roundMoney(sum);
}
