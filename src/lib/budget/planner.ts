import { latestBalance } from "./accounts.ts";
import { dataDepth, savingsRateSeries, typicalMonth } from "./analytics-depth.ts";
import { roundMoney } from "./money.ts";
import { DEFAULT_INFLATION, DEFAULT_RETIRE_AGE, DEFAULT_WITHDRAWAL, PLANNING_MARKET, figureById, figureLine } from "./reference.ts";
import type { Account, BalancePoint, Category, Profile, Transaction } from "./types.ts";
import { median } from "./year.ts";

export type FactSource = "from your accounts" | "from your spending" | "from your income" | "typed" | "default";

export type Fact = {
  value: number | null;
  source: FactSource;
  note: string;
};

export function ageInYear(birthYear: number | null | undefined, year: number): number | null {
  if (birthYear == null || !Number.isFinite(birthYear) || !Number.isFinite(year)) return null;
  const age = Math.round(year - birthYear);
  if (age < 0 || age > 120) return null;
  return age;
}

export function birthYearFromAge(age: number, year: number): number | null {
  if (!Number.isFinite(age) || !Number.isFinite(year)) return null;
  const rounded = Math.round(age);
  if (rounded < 0 || rounded > 120) return null;
  return Math.round(year - rounded);
}

function line(id: string, fallback: string) {
  const figure = figureById(id);
  return figure ? figureLine(figure) : fallback;
}

export type PlannerFacts = {
  age: Fact;
  retireAge: Fact;
  saved: Fact;
  cashSavings: Fact;
  creditOwed: Fact;
  monthlySaving: Fact;
  incomeWantedYearly: Fact;
  inflation: Fact;
  withdrawal: Fact;
  returns: { conservative: number; expected: number; optimistic: number; source: FactSource; note: string };
  typicalSpendMonthly: Fact;
  typicalFixed: Fact;
  incomeMonthly: Fact;
  savingsRate: number | null;
  historyMonths: number;
};

/** Numbers a calculator can start from. Missing facts stay null so the screen can ask once. */
export function plannerFacts(input: {
  profile: Profile;
  accounts: Account[];
  balances: BalancePoint[];
  transactions: Transaction[];
  categories: Category[];
  year: number;
}): PlannerFacts {
  const profile = input.profile;
  const age = ageInYear(profile.birthYear, input.year);
  const typical = typicalMonth(input.transactions, input.categories);
  const series = savingsRateSeries(input.transactions, input.categories);
  const savingsRate = series?.length ? median(series.map((point) => point.rate)) : null;
  const income = profile.monthlyIncome > 0 ? profile.monthlyIncome : (typical?.moneyIn ?? 0);
  const monthly = savingsRate != null && income > 0 ? roundMoney(Math.max(0, savingsRate * income)) : null;
  const wanted = typical && typical.moneyOut > 0 ? roundMoney(typical.moneyOut * 12 * 0.8) : null;
  const fixed = typical ? roundMoney(typical.fixed.reduce((sum, row) => sum + row.typical, 0)) : null;

  let saved = 0;
  let foundSaved = false;
  let cash = 0;
  let foundCash = false;
  let owed = 0;
  let foundCard = false;
  for (const account of input.accounts) {
    const point = latestBalance(account.id, input.balances);
    if (!point) continue;
    if (account.kind === "retirement" || account.kind === "investment") {
      foundSaved = true;
      saved += Math.max(0, point.amount);
    }
    if (account.kind === "savings") {
      foundCash = true;
      cash += Math.max(0, point.amount);
    }
    if (account.kind === "credit") {
      foundCard = true;
      owed += Math.abs(point.amount);
    }
  }

  const inflation = profile.plannerInflation != null ? profile.plannerInflation : DEFAULT_INFLATION;
  const withdrawal = profile.withdrawalRate != null ? profile.withdrawalRate : DEFAULT_WITHDRAWAL;
  const band = profile.returnBand ?? PLANNING_MARKET;

  return {
    age:
      age == null
        ? { value: null, source: "typed", note: "Not entered yet." }
        : { value: age, source: "typed", note: `From birth year ${profile.birthYear}.` },
    retireAge:
      profile.retireAge != null
        ? { value: profile.retireAge, source: "typed", note: "Saved in Account." }
        : { value: DEFAULT_RETIRE_AGE, source: "default", note: "Full Social Security age for a birth year of 1960 or later. Earlier years have a lower full age." },
    saved: foundSaved
      ? { value: roundMoney(saved), source: "from your accounts", note: "Retirement and investment balances." }
      : { value: null, source: "typed", note: "No retirement or investment balance yet." },
    cashSavings: foundCash
      ? { value: roundMoney(cash), source: "from your accounts", note: "Savings account balances." }
      : { value: null, source: "typed", note: "No savings balance yet." },
    creditOwed: foundCard
      ? { value: roundMoney(owed), source: "from your accounts", note: "Credit card balances." }
      : { value: null, source: "typed", note: "No card balance yet." },
    monthlySaving:
      monthly != null
        ? { value: monthly, source: "from your income", note: "Median of monthly savings rates, times monthly income." }
        : { value: null, source: "typed", note: "Not enough history to guess monthly saving." },
    incomeWantedYearly:
      wanted != null
        ? { value: wanted, source: "from your spending", note: "80 percent of a typical year of spending." }
        : { value: null, source: "typed", note: "Need at least two months of spending." },
    inflation: {
      value: inflation,
      source: profile.plannerInflation != null ? "typed" : "default",
      note: line("inflation", "Default inflation."),
    },
    withdrawal: {
      value: withdrawal,
      source: profile.withdrawalRate != null ? "typed" : "default",
      note: line("withdrawal", "Withdrawal rate. A 1994 study, not a current IRS figure."),
    },
    returns: {
      conservative: band.conservative,
      expected: band.expected,
      optimistic: band.optimistic,
      source: profile.returnBand ? "typed" : "default",
      note: line("market-expected", "Planning range. Needs checking."),
    },
    typicalSpendMonthly: typical
      ? { value: typical.moneyOut, source: "from your spending", note: typical.sentence }
      : { value: null, source: "typed", note: "Need at least two months." },
    typicalFixed:
      fixed != null
        ? { value: fixed, source: "from your spending", note: "Typical bills that barely change." }
        : { value: null, source: "typed", note: "No steady bills yet." },
    incomeMonthly:
      income > 0
        ? {
            value: roundMoney(income),
            source: profile.monthlyIncome > 0 ? "typed" : "from your income",
            note: profile.monthlyIncome > 0 ? "Take-home entered in setup." : "A typical month of income.",
          }
        : { value: null, source: "typed", note: "Income is not entered." },
    savingsRate,
    historyMonths: dataDepth(input.transactions)?.months ?? 0,
  };
}
