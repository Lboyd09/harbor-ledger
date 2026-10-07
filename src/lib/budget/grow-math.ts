import { roundMoney } from "./money.ts";
import type { DebtItem } from "./types.ts";

export type Band = { conservative: number; expected: number; optimistic: number };

export const SAVINGS_RATES: Band = { conservative: 0.03, expected: 0.042, optimistic: 0.05 };
export const MARKET_RATES: Band = { conservative: 0.04, expected: 0.07, optimistic: 0.1 };

function grow(principal: number, rate: number, years: number) {
  return principal * Math.pow(1 + rate, Math.max(0, years));
}

function deflate(nominal: number, inflation: number, years: number, today: boolean) {
  if (!today || inflation <= -0.99) return nominal;
  return nominal / Math.pow(1 + inflation, Math.max(0, years));
}

export function projectLump(input: {
  principal: number;
  years: number;
  rates: Band;
  inflation: number;
  today: boolean;
  /** Tax taken from the gain at the end. Roth passes 0. */
  gainTax: number;
  /** Tax taken from the whole ending balance. Traditional passes the retirement rate. */
  endTax: number;
}): Band {
  const taxGain = Math.min(0.8, Math.max(0, input.gainTax));
  const taxEnd = Math.min(0.8, Math.max(0, input.endTax));
  function one(rate: number) {
    const nominal = grow(input.principal, rate, input.years);
    const gain = Math.max(0, nominal - input.principal);
    const after = (nominal - gain * taxGain) * (1 - taxEnd);
    return roundMoney(deflate(after, input.inflation, input.years, input.today));
  }
  return { conservative: one(input.rates.conservative), expected: one(input.rates.expected), optimistic: one(input.rates.optimistic) };
}

/** Future value of a monthly deposit. Rate is annual. */
export function monthlyPath(input: {
  monthly: number;
  years: number;
  rate: number;
  inflation: number;
  today: boolean;
}): { year: number; contributed: number; balance: number }[] {
  const r = input.rate / 12;
  const points: { year: number; contributed: number; balance: number }[] = [];
  let balance = 0;
  const months = Math.max(0, Math.round(input.years * 12));
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + r) + input.monthly;
    if (m % 12 === 0 || m === months) {
      const year = m / 12;
      const contributed = roundMoney(input.monthly * m);
      const nominal = balance;
      points.push({
        year,
        contributed,
        balance: roundMoney(deflate(nominal, input.inflation, year, input.today)),
      });
    }
  }
  if (!points.length) points.push({ year: 0, contributed: 0, balance: 0 });
  return points;
}

/**
 * Value of the same deposit made at the end of every year (an ordinary annuity), compounded yearly.
 * FV = deposit × ((1 + r)^n − 1) / r, and deposit × n when r is 0.
 * A part year after the last deposit only grows; it adds no deposit.
 */
export function yearlyDepositsValue(deposit: number, rate: number, years: number): number {
  const total = Math.max(0, years);
  const n = Math.floor(total + 1e-9);
  const pay = Math.max(0, deposit);
  const atLast = Math.abs(rate) < 1e-12 ? pay * n : (pay * (Math.pow(1 + rate, n) - 1)) / rate;
  return atLast * Math.pow(1 + rate, total - n);
}

export type RothInput = {
  /** Pre-tax pay set aside each year. */
  annual: number;
  years: number;
  rate: number;
  taxNow: number;
  taxLater: number;
  inflation: number;
  today: boolean;
};

/**
 * Same pre-tax pay each year, the standard comparison.
 * Roth: pay tax now, invest what is left (annual × (1 − taxNow)), nothing is taxed later.
 * Traditional: invest the whole annual amount, pay taxLater on everything taken out.
 * Deposits go in at the end of each year and grow at `rate`, compounded yearly.
 */
export function rothVsTraditional(input: RothInput) {
  const now = Math.min(0.8, Math.max(0, input.taxNow));
  const later = Math.min(0.8, Math.max(0, input.taxLater));
  const annual = Math.max(0, input.annual);
  const years = Math.max(0, input.years);
  const deposits = Math.floor(years + 1e-9);
  const rothYearly = annual * (1 - now);
  const rothNominal = yearlyDepositsValue(rothYearly, input.rate, years);
  const traditionalNominal = yearlyDepositsValue(annual, input.rate, years);
  const roth = deflate(rothNominal, input.inflation, years, input.today);
  const traditionalBeforeTax = deflate(traditionalNominal, input.inflation, years, input.today);
  const traditional = traditionalBeforeTax * (1 - later);
  return {
    roth: roundMoney(roth),
    traditional: roundMoney(traditional),
    traditionalBeforeTax: roundMoney(traditionalBeforeTax),
    rothYearly: roundMoney(rothYearly),
    traditionalYearly: roundMoney(annual),
    rothContributed: roundMoney(rothYearly * deposits),
    traditionalContributed: roundMoney(annual * deposits),
  };
}

/** One plain sentence saying which leaves more after taxes, and why. */
export function rothVerdict(result: { roth: number; traditional: number }, taxNow: number, taxLater: number): string {
  const gap = Math.abs(result.roth - result.traditional);
  if (gap < 1) {
    return "Roth and traditional leave about the same after taxes, because your tax rate now and later are the same.";
  }
  const amount = `$${Math.round(gap).toLocaleString("en-US")}`;
  return result.roth > result.traditional
    ? `Roth leaves you about ${amount} more after taxes, because your tax rate now (${pct(taxNow)}) is lower than later (${pct(taxLater)}).`
    : `Traditional leaves you about ${amount} more after taxes, because your tax rate later (${pct(taxLater)}) is lower than now (${pct(taxNow)}).`;
}

function pct(rate: number) {
  return `${Math.round(rate * 1000) / 10}%`;
}

export type RothWhatIf = { label: string; roth: number; traditional: number };

/** What-if rows that each change something this yearly calculator uses. */
export function rothWhatIfs(input: RothInput): RothWhatIf[] {
  const row = (label: string, patch: Partial<RothInput>): RothWhatIf => {
    const result = rothVsTraditional({ ...input, ...patch });
    return { label, roth: result.roth, traditional: result.traditional };
  };
  return [
    row("Return 2 points lower", { rate: input.rate - 0.02 }),
    row("As entered", {}),
    row("Return 2 points higher", { rate: input.rate + 0.02 }),
    row("$1,000 less each year", { annual: Math.max(0, input.annual - 1000) }),
    row("$1,000 more each year", { annual: input.annual + 1000 }),
    row("Tax later 5 points higher", { taxLater: input.taxLater + 0.05 }),
  ];
}

export type LimitCheck = { rothIn: number; traditionalIn: number; rothOver: number; traditionalOver: number };

/**
 * The IRA limit applies to what actually goes into the account.
 * Roth puts in the after-tax amount; traditional puts in the whole pre-tax amount.
 */
export function iraLimitCheck(annual: number, taxNow: number, limit: number): LimitCheck {
  const now = Math.min(0.8, Math.max(0, taxNow));
  const rothIn = roundMoney(Math.max(0, annual) * (1 - now));
  const traditionalIn = roundMoney(Math.max(0, annual));
  return {
    rothIn,
    traditionalIn,
    rothOver: roundMoney(Math.max(0, rothIn - limit)),
    traditionalOver: roundMoney(Math.max(0, traditionalIn - limit)),
  };
}

export type Payoff = { months: number; interest: number; unfinished: boolean };

function stepDebts(debts: { balance: number; apr: number; minimum: number }[], extra: number, order: number[]) {
  const next = debts.map((d) => ({ ...d }));
  let pool = extra;
  for (const i of order) {
    if (next[i].balance <= 0) continue;
    const pay = Math.min(next[i].balance, next[i].minimum + pool);
    const extraUsed = Math.max(0, pay - next[i].minimum);
    pool -= extraUsed;
    next[i].balance = roundMoney(next[i].balance - pay);
  }
  for (const d of next) {
    if (d.balance <= 0) continue;
    d.balance = roundMoney(d.balance * (1 + d.apr / 100 / 12));
  }
  return next;
}

export function payoffPlan(debts: DebtItem[], extra: number, method: "snowball" | "avalanche"): Payoff {
  let rows = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ balance: d.balance, apr: Math.max(0, d.apr), minimum: Math.max(0, d.minimum) }));
  if (!rows.length) return { months: 0, interest: 0, unfinished: false };
  const start = rows.reduce((s, d) => s + d.balance, 0);
  let paid = 0;
  for (let month = 1; month <= 600; month++) {
    const order = rows
      .map((d, i) => ({ i, d }))
      .filter((x) => x.d.balance > 0)
      .sort((a, b) =>
        method === "snowball" ? a.d.balance - b.d.balance || b.d.apr - a.d.apr : b.d.apr - a.d.apr || a.d.balance - b.d.balance,
      )
      .map((x) => x.i);
    const due = rows.reduce((s, d) => s + (d.balance > 0 ? Math.min(d.balance, d.minimum) : 0), 0) + extra;
    paid += due;
    rows = stepDebts(rows, Math.max(0, extra), order);
    if (rows.every((d) => d.balance <= 0.5)) {
      return { months: month, interest: roundMoney(Math.max(0, paid - start)), unfinished: false };
    }
  }
  const left = rows.reduce((s, d) => s + d.balance, 0);
  return { months: 600, interest: roundMoney(Math.max(0, paid - start + left)), unfinished: true };
}

/** Years until investments can cover spending at a 4% withdrawal, given the savings rate. */
export function yearsToFi(savingsRate: number, realReturn = 0.05, withdrawal = 0.04): number | null {
  if (savingsRate >= 0.999) return 0;
  if (savingsRate <= 0) return null;
  const targetOverSave = (1 - savingsRate) / (savingsRate * withdrawal);
  if (realReturn <= 0) return targetOverSave;
  const n = Math.log(targetOverSave * realReturn + 1) / Math.log(1 + realReturn);
  return roundMoney(n);
}

/** Monthly amount to reach a goal. Months is inclusive of the month you start. */
export function monthlyForGoal(target: number, already: number, months: number): number {
  const left = Math.max(0, target - already);
  if (months <= 0) return roundMoney(left);
  return roundMoney(left / months);
}

/** Starting balance plus a monthly deposit. Rate is annual. */
export function projectBoth(input: {
  principal: number;
  monthly: number;
  years: number;
  rate: number;
  inflation: number;
  today: boolean;
}): { year: number; contributed: number; balance: number }[] {
  const r = input.rate / 12;
  const points: { year: number; contributed: number; balance: number }[] = [];
  let balance = Math.max(0, input.principal);
  const months = Math.max(0, Math.round(input.years * 12));
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + r) + Math.max(0, input.monthly);
    if (m % 12 === 0 || m === months) {
      const year = m / 12;
      points.push({
        year,
        contributed: roundMoney(input.principal + input.monthly * m),
        balance: roundMoney(deflate(balance, input.inflation, year, input.today)),
      });
    }
  }
  if (!points.length) points.push({ year: 0, contributed: roundMoney(input.principal), balance: roundMoney(input.principal) });
  return points;
}

export function inflated(amount: number, years: number, inflationPct: number): { later: number; buyingPower: number } {
  const rate = Math.max(0, inflationPct) / 100;
  const later = roundMoney(amount * Math.pow(1 + rate, Math.max(0, years)));
  const buyingPower = roundMoney(amount / Math.pow(1 + rate, Math.max(0, years)));
  return { later, buyingPower };
}

/** Standard loan payment, then the same loan with an extra monthly payment. */
export function loanCompare(input: { balance: number; apr: number; years: number; extra: number }): {
  payment: number;
  months: number;
  interest: number;
  extraMonths: number;
  extraInterest: number;
  unfinished: boolean;
} {
  const balance = Math.max(0, input.balance);
  const years = Math.max(1, Math.round(input.years));
  const r = Math.max(0, input.apr) / 100 / 12;
  const n = years * 12;
  const payment = r === 0 ? balance / n : (balance * r) / (1 - Math.pow(1 + r, -n));
  function run(extra: number) {
    let left = balance;
    let interest = 0;
    const pay = payment + Math.max(0, extra);
    for (let m = 1; m <= 600; m++) {
      const charge = left * r;
      interest += charge;
      left = left + charge - pay;
      if (left <= 0.5) return { months: m, interest: roundMoney(interest), unfinished: false };
    }
    return { months: 600, interest: roundMoney(interest), unfinished: true };
  }
  const base = run(0);
  const extra = run(input.extra);
  return {
    payment: roundMoney(payment),
    months: base.months,
    interest: base.interest,
    extraMonths: extra.months,
    extraInterest: extra.interest,
    unfinished: base.unfinished,
  };
}

/** Years for a balance to double at a yearly rate. Null if the rate is not positive. */
export function yearsToDouble(aprPercent: number): number | null {
  const rate = aprPercent / 100;
  if (!(rate > 0)) return null;
  return roundMoney(Math.log(2) / Math.log(1 + rate));
}

/** Months until a starting amount plus a monthly add reaches a target. Null if it never does within 50 years. */
export function monthsToTarget(input: { principal: number; monthly: number; apr: number; target: number }): number | null {
  const target = Math.max(0, input.target);
  let balance = Math.max(0, input.principal);
  if (balance + 0.005 >= target) return 0;
  const r = Math.max(0, input.apr) / 100 / 12;
  const add = Math.max(0, input.monthly);
  if (add <= 0 && r <= 0) return null;
  for (let month = 1; month <= 600; month++) {
    balance = balance * (1 + r) + add;
    if (balance + 0.005 >= target) return month;
  }
  return null;
}
