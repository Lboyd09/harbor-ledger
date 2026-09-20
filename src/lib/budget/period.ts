import { roundMoney } from "./money.ts";
import type { BudgetPeriod } from "./types.ts";

/** Average weeks in a month — used to scale a monthly plan down to a week. */
export const WEEKS_PER_MONTH = 365.25 / 7 / 12;

export function plannedForPeriod(monthly: number, period: BudgetPeriod): number {
  if (period === "week") return roundMoney(monthly / WEEKS_PER_MONTH);
  return monthly;
}

export function periodNoun(period: BudgetPeriod, plural = false): string {
  if (period === "week") return plural ? "weeks" : "week";
  return plural ? "months" : "month";
}
