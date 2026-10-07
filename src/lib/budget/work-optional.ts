import { roundMoney } from "./money.ts";

/**
 * "When work is optional". One method for every number on the page:
 * - The number = yearly spending ÷ withdrawal rate (25× spending at 4%).
 * - Growth after inflation uses the exact real return: (1 + return) ÷ (1 + inflation) − 1.
 *   It can be 0 or negative; nothing is swapped for a default.
 * - Years count yearly growth with a year of saving added at the end of each year,
 *   starting from what you already have (the standard NPER formula).
 * - Coast = the number ÷ (1 + real return)^(years until the retire age).
 * Everything is in today's dollars.
 */

export const MAX_YEARS = 100;

export type FiFields = {
  /** Dollars a month. */
  spendMonthly: string;
  /** Dollars a month. */
  saveMonthly: string;
  /** Dollars already invested. */
  invested: string;
  /** Yearly return in percent, e.g. "7". */
  rate: string;
  /** Inflation in percent, e.g. "2.5". */
  inflation: string;
  /** Withdrawal rate in percent, e.g. "4". */
  withdrawal: string;
};

export type FiInput = {
  yearlySpend: number;
  yearlySave: number;
  invested: number;
  /** Yearly return before inflation, decimal. */
  rate: number;
  /** Decimal. */
  inflation: number;
  /** Decimal. */
  withdrawal: number;
};

export type FiRead = { ok: true; input: FiInput } | { ok: false; prompt: string };

/** A typed number, or null for a blank or unreadable box. Accepts "$1,408.44" and "4%". */
function typed(raw: string): number | null {
  const s = raw.replace(/[$,%\s]/g, "");
  if (!s || !/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Read the boxes. A blank box is missing, never 0. A 0 typed on purpose stays 0. */
export function readFi(fields: FiFields): FiRead {
  const spend = typed(fields.spendMonthly);
  const save = typed(fields.saveMonthly);
  const invested = typed(fields.invested);
  const rate = typed(fields.rate);
  const inflation = typed(fields.inflation);
  const withdrawal = typed(fields.withdrawal);
  const checks: [string, boolean][] = [
    ["your spending a month", spend != null && spend > 0],
    ["what you save a month (0 is fine)", save != null && save >= 0],
    ["what you already have invested (0 is fine)", invested != null && invested >= 0],
    ["the yearly return", rate != null && rate > -100],
    ["inflation (0 is fine)", inflation != null && inflation > -100],
    ["a withdrawal rate above 0", withdrawal != null && withdrawal > 0 && withdrawal <= 100],
  ];
  const miss = checks.find(([, ok]) => !ok);
  if (miss || spend == null || save == null || invested == null || rate == null || inflation == null || withdrawal == null) {
    return { ok: false, prompt: `Enter ${miss?.[0] ?? "the numbers"} to see when work could be optional.` };
  }
  return {
    ok: true,
    input: { yearlySpend: spend * 12, yearlySave: save * 12, invested, rate: rate / 100, inflation: inflation / 100, withdrawal: withdrawal / 100 },
  };
}

/** Growth after inflation, exact: 7% with 2.5% inflation is 4.39%, not 4.5%. */
export function realReturn(rate: number, inflation: number): number {
  if (inflation === 0) return rate;
  return (1 + rate) / (1 + inflation) - 1;
}

/** The amount whose yearly withdrawal covers yearly spending. */
export function fiTarget(yearlySpend: number, withdrawal: number): number {
  return roundMoney(yearlySpend / withdrawal);
}

/**
 * Years until start + yearly saving reaches the target, growing at `rate` a year,
 * with each year's saving added at the end of the year. Same as NPER(rate, −save, −start, target).
 * Null when it never gets there, or not within MAX_YEARS.
 */
export function yearsToTarget(input: { start: number; yearlySave: number; rate: number; target: number }): number | null {
  const { start, yearlySave: save, rate: r, target } = input;
  if (start >= target) return 0;
  let n: number;
  if (Math.abs(r) < 1e-12) {
    if (save <= 0) return null;
    n = (target - start) / save;
  } else {
    if (r <= -1) return null;
    const x = (target * r + save) / (start * r + save);
    if (!Number.isFinite(x) || x <= 0) return null;
    n = Math.log(x) / Math.log(1 + r);
  }
  if (!Number.isFinite(n) || n < 0 || n > MAX_YEARS) return null;
  return n;
}

/** What you'd need invested today for growth alone to reach the target in `yearsLeft` years. */
export function coastAmount(target: number, real: number, yearsLeft: number): number {
  return roundMoney(target / Math.pow(1 + real, Math.max(0, yearsLeft)));
}

export type FiPlan = {
  target: number;
  real: number;
  /** Unrounded years, or null for "not within 100 years". */
  years: number | null;
  /** Years until the retire age, when the age is known and the retire age is ahead. */
  yearsLeft: number | null;
  coast: number | null;
  /** Age when work is optional, rounded to a whole year. */
  reachAge: number | null;
};

export function planFi(input: FiInput, ages: { age: number | null; retireAge: number | null }): FiPlan {
  const target = fiTarget(input.yearlySpend, input.withdrawal);
  const real = realReturn(input.rate, input.inflation);
  const years = yearsToTarget({ start: input.invested, yearlySave: input.yearlySave, rate: real, target });
  const yearsLeft = ages.age != null && ages.retireAge != null && ages.retireAge > ages.age ? ages.retireAge - ages.age : null;
  return {
    target,
    real,
    years,
    yearsLeft,
    coast: yearsLeft != null ? coastAmount(target, real, yearsLeft) : null,
    reachAge: ages.age != null && years != null ? Math.round(ages.age + years) : null,
  };
}

/** Years with one decimal, e.g. "11.9 years", or the plain "not within 100 years". */
export function yearsText(years: number | null): string {
  if (years == null) return `not within ${MAX_YEARS} years`;
  if (years === 0) return "now";
  const one = Math.round(years * 10) / 10;
  return `${one} ${one === 1 ? "year" : "years"}`;
}

export type FiWhatIf = { label: string; years: number | null };

/** Rows that move the answer. A row that comes out the same as "As entered" is left out. */
export function fiWhatIfs(input: FiInput): FiWhatIf[] {
  const at = (change: Partial<FiInput>) => {
    const next = { ...input, ...change };
    return yearsToTarget({ start: next.invested, yearlySave: next.yearlySave, rate: realReturn(next.rate, next.inflation), target: fiTarget(next.yearlySpend, next.withdrawal) });
  };
  const base = at({});
  const rows: FiWhatIf[] = [
    { label: "Return 2 points lower", years: at({ rate: input.rate - 0.02 }) },
    { label: "Return 2 points higher", years: at({ rate: input.rate + 0.02 }) },
    { label: "Save $100 more a month", years: at({ yearlySave: input.yearlySave + 1200 }) },
    ...(input.yearlySave >= 1200 ? [{ label: "Save $100 less a month", years: at({ yearlySave: input.yearlySave - 1200 }) }] : []),
    ...(input.yearlySpend > 1200 ? [{ label: "Spend $100 less a month", years: at({ yearlySpend: input.yearlySpend - 1200 }) }] : []),
  ];
  const same = (a: number | null, b: number | null) => (a == null || b == null ? a === b : Math.abs(a - b) < 0.005);
  return [{ label: "As entered", years: base }, ...rows.filter((row) => !same(row.years, base))];
}

/** Monthly saving implied by a savings rate, when spending + saving = take-home pay. */
export function savingFromRate(spendMonthly: number, savingsRate: number): number | null {
  if (!(spendMonthly > 0) || !(savingsRate >= 0) || savingsRate >= 1) return null;
  return roundMoney((spendMonthly * savingsRate) / (1 - savingsRate));
}

export type FiYear = { year: number; balance: number; reached: boolean };

/** Year-by-year balance in today's dollars, until it reaches the number (at most MAX_YEARS rows). */
export function fiPath(input: FiInput): FiYear[] {
  const target = fiTarget(input.yearlySpend, input.withdrawal);
  const real = realReturn(input.rate, input.inflation);
  const rows: FiYear[] = [{ year: 0, balance: roundMoney(input.invested), reached: input.invested >= target }];
  let balance = input.invested;
  for (let year = 1; year <= MAX_YEARS && balance < target; year++) {
    balance = balance * (1 + real) + input.yearlySave;
    rows.push({ year, balance: roundMoney(balance), reached: balance >= target });
  }
  return rows;
}
