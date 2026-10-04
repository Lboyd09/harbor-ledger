import { payoffPlan, projectBoth, yearsToFi } from "./grow-math.ts";
import { roundMoney } from "./money.ts";
import type { Account, AccountKind, BalancePoint, DebtItem } from "./types.ts";

export type YearRow = {
  year: number;
  contributed: number;
  growth: number;
  balance: number;
};

export type SensitivityRow = { label: string; value: number };

/** Year rows from a starting pile and a monthly add. Does not change the calculator results. */
export function yearRows(input: {
  principal: number;
  monthly: number;
  years: number;
  rate: number;
  inflation: number;
  today: boolean;
}): YearRow[] {
  const path = projectBoth({
    principal: Math.max(0, input.principal),
    monthly: Math.max(0, input.monthly),
    years: Math.max(0, input.years),
    rate: input.rate,
    inflation: input.inflation,
    today: input.today,
  });
  return path.map((point) => ({
    year: point.year,
    contributed: point.contributed,
    growth: roundMoney(point.balance - point.contributed),
    balance: point.balance,
  }));
}

/** Return plus or minus 2 points, and the monthly amount plus or minus $100. */
export function sensitivityOf(
  project: (rate: number, monthly: number) => number,
  rate: number,
  monthly: number,
): SensitivityRow[] {
  const base = Math.max(0, monthly);
  return [
    { label: "Return 2 points lower", value: roundMoney(project(rate - 0.02, base)) },
    { label: "Return as entered", value: roundMoney(project(rate, base)) },
    { label: "Return 2 points higher", value: roundMoney(project(rate + 0.02, base)) },
    { label: "Monthly $100 less", value: roundMoney(project(rate, Math.max(0, base - 100))) },
    { label: "Monthly $100 more", value: roundMoney(project(rate, base + 100)) },
  ];
}

export type AmortizationRow = {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

/** Month-by-month loan. The regular payment matches the loan calculator. */
export function amortizationSchedule(input: {
  balance: number;
  aprPercent: number;
  years: number;
  extra?: number;
}): AmortizationRow[] {
  const start = Math.max(0, input.balance);
  const years = Math.max(1, Math.round(input.years));
  const rate = Math.max(0, input.aprPercent) / 100 / 12;
  const months = years * 12;
  const payment = rate === 0 ? start / months : (start * rate) / (1 - Math.pow(1 + rate, -months));
  const pay = payment + Math.max(0, input.extra ?? 0);
  const rows: AmortizationRow[] = [];
  let left = start;
  for (let month = 1; month <= 600 && left > 0.5; month++) {
    const interest = left * rate;
    const principal = Math.min(left, Math.max(0, pay - interest));
    left = roundMoney(left + interest - (interest + principal));
    rows.push({
      month,
      payment: roundMoney(Math.min(pay, interest + principal)),
      interest: roundMoney(interest),
      principal: roundMoney(principal),
      balance: Math.max(0, left),
    });
  }
  return rows;
}

export type DebtMonth = { month: number; remaining: number };

function debtStep(debts: { balance: number; apr: number; minimum: number }[], extra: number) {
  const next = debts.map((row) => ({ ...row }));
  const order = next
    .map((row, index) => ({ index, row }))
    .filter((item) => item.row.balance > 0)
    .sort((a, b) => b.row.apr - a.row.apr || a.row.balance - b.row.balance)
    .map((item) => item.index);
  let pool = extra;
  for (const index of order) {
    if (next[index].balance <= 0) continue;
    const pay = Math.min(next[index].balance, next[index].minimum + pool);
    pool -= Math.max(0, pay - next[index].minimum);
    next[index].balance = roundMoney(next[index].balance - pay);
  }
  for (const row of next) {
    if (row.balance <= 0) continue;
    row.balance = roundMoney(row.balance * (1 + row.apr / 100 / 12));
  }
  return next;
}

/** Remaining balance each month, minimums only and with extra. Avalanche order, same as the payoff calculator. */
export function debtTimeline(debts: DebtItem[], extra: number): { minimums: DebtMonth[]; withExtra: DebtMonth[] } {
  function run(add: number): DebtMonth[] {
    let rows = debts
      .filter((debt) => debt.balance > 0)
      .map((debt) => ({ balance: debt.balance, apr: Math.max(0, debt.apr), minimum: Math.max(0, debt.minimum) }));
    const out: DebtMonth[] = [{ month: 0, remaining: roundMoney(rows.reduce((sum, row) => sum + row.balance, 0)) }];
    for (let month = 1; month <= 600; month++) {
      if (rows.every((row) => row.balance <= 0.5)) break;
      rows = debtStep(rows, add);
      out.push({ month, remaining: roundMoney(rows.reduce((sum, row) => sum + Math.max(0, row.balance), 0)) });
    }
    return out;
  }
  return { minimums: run(0), withExtra: run(Math.max(0, extra)) };
}

export function debtMatchesPayoff(debts: DebtItem[], extra: number): boolean {
  const plan = payoffPlan(debts, extra, "avalanche");
  const line = debtTimeline(debts, extra).withExtra;
  const last = line[line.length - 1];
  if (!last) return plan.months === 0;
  if (plan.unfinished) return last.month === 600;
  return last.remaining <= 0.5 && last.month === plan.months;
}

export type WorthPoint = { date: string; total: number; byKind: Partial<Record<AccountKind, number>> };

/** One point per balance date. Each account uses its latest balance on or before that date. */
export function netWorthSeries(accounts: Account[], balances: BalancePoint[]): WorthPoint[] {
  const dates = [...new Set(balances.map((row) => row.date))].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  return dates.map((date) => {
    const byKind: Partial<Record<AccountKind, number>> = {};
    let total = 0;
    for (const account of accounts) {
      const latest = balances
        .filter((row) => row.accountId === account.id && row.date <= date)
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
        .at(-1);
      if (!latest) continue;
      byKind[account.kind] = roundMoney((byKind[account.kind] ?? 0) + latest.amount);
      total += latest.amount;
    }
    return { date, total: roundMoney(total), byKind };
  });
}

export function fiNumbers(input: {
  yearlySpend: number;
  withdrawal: number;
  savingsRate: number;
  realReturn: number;
  yearsLeft: number | null;
}): { fi: number | null; years: number | null; coast: number | null } {
  const withdrawal = input.withdrawal;
  const fi = withdrawal > 0 && input.yearlySpend > 0 ? roundMoney(input.yearlySpend / withdrawal) : null;
  const years = yearsToFi(Math.max(0, input.savingsRate), input.realReturn, withdrawal > 0 ? withdrawal : 0.04);
  const coast =
    fi != null && input.yearsLeft != null
      ? roundMoney(fi / Math.pow(1 + Math.max(0, input.realReturn), Math.max(0, input.yearsLeft)))
      : null;
  return { fi, years, coast };
}
