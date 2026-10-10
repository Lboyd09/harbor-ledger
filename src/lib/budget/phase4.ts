import { simulatePayoff } from "./grow-math.ts";
import { roundMoney } from "./money.ts";
import type { DebtItem } from "./types.ts";

export const BLANK_RETURN = 0.06;

export function savingsRate(monthlySaving: number, monthlyIncome: number): number | null {
  if (!(monthlyIncome > 0)) return null;
  return roundMoney(Math.max(0, monthlySaving) / monthlyIncome);
}

/** Cash above a 3-month spending cushion. Null when there is nothing spare. */
export function cashAboveCushion(cash: number, plannedMonthly: number): number | null {
  if (!(plannedMonthly > 0)) return null;
  const spare = roundMoney(cash - 3 * plannedMonthly);
  return spare > 0 ? spare : null;
}

export function scheduleGap(input: { monthly: number; monthsElapsed: number; balance: number }): {
  delta: number;
  sentence: string;
} {
  const expected = roundMoney(Math.max(0, input.monthly) * Math.max(0, input.monthsElapsed));
  const delta = roundMoney(input.balance - expected);
  const sentence =
    Math.abs(delta) < 0.5 ? "On schedule" : delta > 0 ? `You're ${formatPlain(delta)} ahead of schedule` : `${formatPlain(Math.abs(delta))} behind`;
  return { delta, sentence };
}

function formatPlain(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function extraPaymentSavings(debts: DebtItem[], extra: number): { interestSaved: number; monthsSaved: number } | null {
  if (!(extra > 0)) return null;
  const base = simulatePayoff(debts, 0, "avalanche");
  const faster = simulatePayoff(debts, extra, "avalanche");
  return {
    interestSaved: roundMoney(base.interest - faster.interest),
    monthsSaved: base.months - faster.months,
  };
}

/** Drop the base row and any later row that repeats a kept result. */
export function dropSameWhatIfs(rows: { label: string; value: string }[], baseValue?: string): { label: string; value: string }[] {
  const base = baseValue ?? rows.find((row) => /as entered/i.test(row.label))?.value ?? "";
  return whatIfRows(base, rows, (a, b) => a === b);
}

export function whatIfRows<T>(base: T, rows: { label: string; value: T }[], same: (a: T, b: T) => boolean): { label: string; value: T }[] {
  const kept = rows.filter((row) => !same(row.value, base));
  const out: { label: string; value: T }[] = [];
  for (const row of kept) {
    if (out.some((prior) => same(prior.value, row.value))) continue;
    out.push(row);
  }
  return out;
}

export type Readiness =
  | { step: 2; sentence: string }
  | { step: 1 | 3 | 4; sentence: string }
  | { step: "ready"; sentence: "ready" };

export function investingReadiness(input: {
  monthsSaved: number;
  highAprDebt?: { name: string; apr: number } | null;
  employerMatchShort?: boolean;
}): Readiness {
  if (!(input.monthsSaved >= 1)) return { step: 1, sentence: "Save one month of spending first." };
  if (input.highAprDebt && input.highAprDebt.apr > 8) {
    const name = input.highAprDebt.name;
    const apr = input.highAprDebt.apr.toFixed(2);
    return {
      step: 2,
      sentence: `Pay off your ${name} first. It costs ${apr}%, more than investing would earn.`,
    };
  }
  if (input.employerMatchShort) return { step: 3, sentence: "Take the full employer match first." };
  if (input.monthsSaved < 3) return { step: 4, sentence: "Build 3 to 6 months of spending first." };
  return { step: "ready", sentence: "ready" };
}

export type AmountEditor = { draft: string; saved: string; armed: boolean; close: boolean };

export function amountEditorKey(state: AmountEditor, key: string): AmountEditor {
  if (key !== "Escape") return { ...state, armed: false, close: false };
  if (!state.armed) return { ...state, draft: state.saved, armed: true, close: false };
  return { ...state, close: true };
}
