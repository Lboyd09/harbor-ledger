import { roundMoney } from "./money.ts";
import type { DebtItem } from "./types.ts";

/**
 * "Put it to work": one amount left alone, no deposits.
 * One method everywhere on that page (headline, chart, table, what-ifs):
 * the typed yearly rate, compounded monthly (rate / 12), the same as "Add every month".
 * Tax on the gain is taken once at the end, when you sell. Today's dollars divide by
 * (1 + inflation) for each year.
 */

export type LumpFields = {
  amount: string;
  years: string;
  /** Yearly rate in percent, e.g. "7". */
  rate: string;
  /** Tax on the gain in percent, e.g. "15". */
  gainTax: string;
  /** Inflation in percent. Only needed for today's dollars. */
  inflation: string;
  today: boolean;
};

export type LumpInput = {
  amount: number;
  years: number;
  /** Yearly rate as a decimal, 0.07 for 7%. */
  rate: number;
  /** Decimal, 0.15 for 15%. */
  gainTax: number;
  /** Decimal. */
  inflation: number;
  today: boolean;
};

export type LumpRead = { ok: true; input: LumpInput } | { ok: false; prompt: string };

/** A typed number, or null for a blank or unreadable box. Accepts "$8,751" and "7%". */
function typed(raw: string): number | null {
  const s = raw.replace(/[$,%\s]/g, "");
  if (!s || !/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Read the boxes. A blank box is missing, never 0. A 0 typed on purpose stays 0. */
export function readLump(fields: LumpFields): LumpRead {
  const amount = typed(fields.amount);
  const years = typed(fields.years);
  const rate = typed(fields.rate);
  const gainTax = typed(fields.gainTax);
  const inflation = fields.today ? typed(fields.inflation) : (typed(fields.inflation) ?? 0);
  const checks: [string, boolean][] = [
    ["an amount", amount != null && amount > 0],
    ["how many years (0 to 100)", years != null && years >= 0 && years <= 100],
    ["the yearly rate", rate != null && rate > -100],
    ["the tax on the gain (0 is fine)", gainTax != null && gainTax >= 0 && gainTax <= 100],
    ["inflation (0 is fine)", inflation != null && inflation >= 0],
  ];
  const miss = checks.find(([, ok]) => !ok);
  if (miss || amount == null || years == null || rate == null || gainTax == null || inflation == null) {
    return { ok: false, prompt: `Enter ${miss?.[0] ?? "the numbers"} to see what it could grow to.` };
  }
  return { ok: true, input: { amount, years, rate: rate / 100, gainTax: gainTax / 100, inflation: inflation / 100, today: fields.today } };
}

export type LumpResult = {
  months: number;
  /** Ending balance before any tax, in future dollars. */
  beforeTax: number;
  /** Ending balance minus the starting amount (0 or less means no tax). */
  gain: number;
  taxOnGain: number;
  /** What a taxable account keeps after selling, in future dollars. */
  afterTax: number;
  /** The two balances as shown: in today's dollars when that box is ticked, else the same as above. */
  shownBeforeTax: number;
  shownAfterTax: number;
};

/**
 * Grow the amount. Each piece is rounded to the cent so the numbers on the page add up:
 * after tax = before tax − tax on the gain.
 */
export function growLump(input: LumpInput): LumpResult {
  const months = Math.max(0, Math.round(input.years * 12));
  const r = input.rate / 12;
  const raw = input.amount * Math.pow(1 + r, months);
  const beforeTax = roundMoney(raw);
  const gain = roundMoney(beforeTax - input.amount);
  const taxOnGain = roundMoney(Math.max(0, gain) * Math.min(1, Math.max(0, input.gainTax)));
  const afterTax = roundMoney(beforeTax - taxOnGain);
  const deflator = input.today ? Math.pow(1 + Math.max(0, input.inflation), months / 12) : 1;
  return {
    months,
    beforeTax,
    gain,
    taxOnGain,
    afterTax,
    // Deflate the unrounded balance, exactly as the year table does.
    shownBeforeTax: roundMoney(raw / deflator),
    shownAfterTax: roundMoney(afterTax / deflator),
  };
}

export type LumpPoint = { year: number; putIn: number; low: number; mid: number; high: number };

/** Yearly points for the chart: the typed rate, and 2 points lower and higher. Before tax, as shown. */
export function lumpPath(input: LumpInput): LumpPoint[] {
  const last = Math.max(0, input.years);
  const marks: number[] = [];
  for (let year = 0; year < last; year++) marks.push(year);
  marks.push(last);
  const at = (rate: number, years: number) => growLump({ ...input, rate, years }).shownBeforeTax;
  return marks.map((year) => ({
    year,
    putIn: roundMoney(input.amount),
    low: at(input.rate - 0.02, year),
    mid: at(input.rate, year),
    high: at(input.rate + 0.02, year),
  }));
}

export type LumpWhatIf = { label: string; beforeTax: number; afterTax: number };

/** Rows that actually move this calculator: the rate and the number of years. */
export function lumpWhatIfs(input: LumpInput): LumpWhatIf[] {
  const row = (label: string, change: Partial<LumpInput>): LumpWhatIf => {
    const out = growLump({ ...input, ...change });
    return { label, beforeTax: out.shownBeforeTax, afterTax: out.shownAfterTax };
  };
  const rows: LumpWhatIf[] = [];
  if (input.rate - 0.02 > -1) rows.push(row("Return 2 points lower", { rate: input.rate - 0.02 }));
  rows.push(row("As entered", {}));
  rows.push(row("Return 2 points higher", { rate: input.rate + 0.02 }));
  if (input.years >= 5) rows.push(row("5 fewer years", { years: input.years - 5 }));
  rows.push(row("5 more years", { years: input.years + 5 }));
  return rows;
}

/**
 * A plain warning when a debt costs more than this money would likely earn.
 * Uses the highest-rate debt with a balance, at 8% or more, and above the typed rate.
 */
export function debtFirstNote(debts: DebtItem[], rate: number): string | null {
  const live = debts.filter((debt) => debt.balance > 0 && debt.apr >= 8 && debt.apr > rate * 100);
  if (!live.length) return null;
  const top = live.reduce((a, b) => (b.apr > a.apr ? b : a));
  const name = top.name.trim() || "debt";
  return `Your ${name} charges ${pct(top.apr)}. Paying it off first is a sure ${pct(top.apr)} back, more than the ${pct(rate * 100)} used here.`;
}

function pct(n: number): string {
  return `${Math.round(n * 100) / 100}%`;
}
