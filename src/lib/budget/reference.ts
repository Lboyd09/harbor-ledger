import { MARKET_RATES, SAVINGS_RATES, type Band } from "./grow-math.ts";

export type FigureStatus = "checked" | "needs checking";

export type ReferenceFigure = {
  id: string;
  name: string;
  /** Dollars, an age, or a decimal rate such as 0.04. */
  value: number;
  unit: "usd" | "age" | "rate";
  asOf: string;
  source: string;
  status: FigureStatus;
};

/**
 * Outside numbers the screens may show. IRA and 401(k) limits are the 2026 IRS figures.
 * Return ranges are the ones already used by the calculators. They have no published source, so they need checking.
 */
export const IRA_LIMITS = {
  year: 2026,
  under50: 7500,
  catchUp: 1100,
  rothSingleStart: 153000,
  rothSingleEnd: 168000,
  rothJointStart: 242000,
  rothJointEnd: 252000,
} as const;

const IRS = "IRS Notice 2025-67 (IR-2025-111)";
const SSA = "Social Security Administration";

export const FIGURES: ReferenceFigure[] = [
  { id: "ira-under-50", name: "IRA contribution limit", value: IRA_LIMITS.under50, unit: "usd", asOf: "2026-01-01", source: IRS, status: "checked" },
  { id: "ira-catch-up", name: "IRA catch-up at 50", value: IRA_LIMITS.catchUp, unit: "usd", asOf: "2026-01-01", source: IRS, status: "checked" },
  { id: "roth-single-start", name: "Roth IRA phase-out start, single", value: IRA_LIMITS.rothSingleStart, unit: "usd", asOf: "2026-01-01", source: IRS, status: "checked" },
  { id: "roth-single-end", name: "Roth IRA phase-out end, single", value: IRA_LIMITS.rothSingleEnd, unit: "usd", asOf: "2026-01-01", source: IRS, status: "checked" },
  { id: "roth-joint-start", name: "Roth IRA phase-out start, joint", value: IRA_LIMITS.rothJointStart, unit: "usd", asOf: "2026-01-01", source: IRS, status: "checked" },
  { id: "roth-joint-end", name: "Roth IRA phase-out end, joint", value: IRA_LIMITS.rothJointEnd, unit: "usd", asOf: "2026-01-01", source: IRS, status: "checked" },
  { id: "401k-deferral", name: "401(k) deferral limit", value: 24500, unit: "usd", asOf: "2026-01-01", source: IRS, status: "checked" },
  { id: "401k-catch-up", name: "401(k) catch-up at 50", value: 8000, unit: "usd", asOf: "2026-01-01", source: IRS, status: "checked" },
  { id: "401k-catch-up-60", name: "401(k) catch-up at 60 to 63", value: 11250, unit: "usd", asOf: "2026-01-01", source: IRS, status: "checked" },
  { id: "ss-earliest", name: "Earliest Social Security age", value: 62, unit: "age", asOf: "2026-01-01", source: SSA, status: "checked" },
  { id: "ss-full", name: "Full Social Security age", value: 67, unit: "age", asOf: "2026-01-01", source: `${SSA}, for a birth year of 1960 or later`, status: "checked" },
  { id: "ss-latest", name: "Latest Social Security age with credits", value: 70, unit: "age", asOf: "2026-01-01", source: SSA, status: "checked" },
  { id: "inflation", name: "Default inflation", value: 0.02, unit: "rate", asOf: "2025-08-22", source: "Federal Reserve longer-run inflation goal", status: "checked" },
  { id: "withdrawal", name: "Withdrawal rate", value: 0.04, unit: "rate", asOf: "1994-10-01", source: "Bengen, Journal of Financial Planning, October 1994", status: "checked" },
  { id: "savings-conservative", name: "Savings return, low", value: SAVINGS_RATES.conservative, unit: "rate", asOf: "2026-01-01", source: "BudgetFlow planning range, not a published series", status: "needs checking" },
  { id: "savings-expected", name: "Savings return, middle", value: SAVINGS_RATES.expected, unit: "rate", asOf: "2026-01-01", source: "BudgetFlow planning range, not a published series", status: "needs checking" },
  { id: "savings-optimistic", name: "Savings return, high", value: SAVINGS_RATES.optimistic, unit: "rate", asOf: "2026-01-01", source: "BudgetFlow planning range, not a published series", status: "needs checking" },
  { id: "market-conservative", name: "Market return, low", value: MARKET_RATES.conservative, unit: "rate", asOf: "2026-01-01", source: "BudgetFlow planning range, not a published series", status: "needs checking" },
  { id: "market-expected", name: "Market return, middle", value: MARKET_RATES.expected, unit: "rate", asOf: "2026-01-01", source: "BudgetFlow planning range, not a published series", status: "needs checking" },
  { id: "market-optimistic", name: "Market return, high", value: MARKET_RATES.optimistic, unit: "rate", asOf: "2026-01-01", source: "BudgetFlow planning range, not a published series", status: "needs checking" },
];

export function figureById(id: string): ReferenceFigure | undefined {
  return FIGURES.find((row) => row.id === id);
}

export function figuresNeedingCheck(): ReferenceFigure[] {
  return FIGURES.filter((row) => row.status === "needs checking");
}

export const DEFAULT_INFLATION = figureById("inflation")?.value ?? 0.02;
export const DEFAULT_WITHDRAWAL = figureById("withdrawal")?.value ?? 0.04;
export const DEFAULT_RETIRE_AGE = figureById("ss-full")?.value ?? 67;
export const PLANNING_MARKET: Band = MARKET_RATES;
export const PLANNING_SAVINGS: Band = SAVINGS_RATES;

export function figureLine(figure: ReferenceFigure): string {
  const flag = figure.status === "needs checking" ? "Needs checking." : "Checked.";
  return `${figure.name}, as of ${figure.asOf}. ${figure.source}. ${flag}`;
}

export function assumptionLines(ids: string[]): string[] {
  return ids.map((id) => {
    const figure = figureById(id);
    return figure ? figureLine(figure) : id;
  });
}
