import { needsPrompt, readNumber } from "./calc-input.ts";
import { roundMoney } from "./money.ts";
import { DEFAULT_INFLATION, DEFAULT_RETIRE_AGE, DEFAULT_WITHDRAWAL, PLANNING_MARKET } from "./reference.ts";

export type ReturnBand = { conservative: number; expected: number; optimistic: number };

export type RetirementInput = {
  age: number;
  retireAge: number;
  saved: number;
  monthlySaving: number;
  /** Percent of the person's monthly saving that an employer adds. 50 means half again. */
  employerMatchPercent: number;
  returns: ReturnBand;
  /** Annual inflation as a decimal. */
  inflation: number;
  /** Yearly spending wanted, in today's dollars. */
  incomeWantedYearly: number;
  socialSecurityMonthly: number;
  withdrawalRate: number;
};

export type RetirementPoint = {
  age: number;
  contributed: number;
  growth: number;
  balance: number;
  real: number;
};

export type RetirementPath = {
  label: "conservative" | "expected" | "optimistic";
  rate: number;
  balance: number;
  real: number;
  incomeYearly: number;
  coveredPercent: number;
  points: RetirementPoint[];
};

export type RetirementResult = {
  years: number;
  age: number;
  retireAge: number;
  paths: RetirementPath[];
  coveredPercent: number;
  gapYearly: number;
  extraPerMonth: number | null;
  extraYears: number | null;
  sentence: string;
  wantedYearly: number;
  socialSecurityYearly: number;
};

export type MonteCarloResult = {
  runs: number;
  seed: number;
  mean: number;
  spread: number;
  chanceLasts: number;
  points: { age: number; p10: number; p50: number; p90: number }[];
};

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function cleanRetirementInput(raw: RetirementInput): RetirementInput {
  const age = clamp(Math.round(raw.age), 0, 120);
  const retireAge = clamp(Math.round((Number.isFinite(raw.retireAge) ? raw.retireAge : age) * 12) / 12, 0, 120);
  return {
    age,
    retireAge,
    saved: Math.max(0, Number.isFinite(raw.saved) ? raw.saved : 0),
    monthlySaving: Math.max(0, Number.isFinite(raw.monthlySaving) ? raw.monthlySaving : 0),
    employerMatchPercent: clamp(raw.employerMatchPercent, 0, 100),
    returns: {
      conservative: clamp(raw.returns?.conservative ?? PLANNING_MARKET.conservative, -0.5, 0.5),
      expected: clamp(raw.returns?.expected ?? PLANNING_MARKET.expected, -0.5, 0.5),
      optimistic: clamp(raw.returns?.optimistic ?? PLANNING_MARKET.optimistic, -0.5, 0.5),
    },
    inflation: clamp(raw.inflation, -0.2, 0.2),
    incomeWantedYearly: Math.max(0, Number.isFinite(raw.incomeWantedYearly) ? raw.incomeWantedYearly : 0),
    socialSecurityMonthly: Math.max(0, Number.isFinite(raw.socialSecurityMonthly) ? raw.socialSecurityMonthly : 0),
    withdrawalRate: clamp(raw.withdrawalRate, 0, 0.2),
  };
}

/** Youngest and oldest ages the estimate will run for. */
export const PLAN_AGE_MIN = 14;
export const PLAN_AGE_MAX = 100;

/** The retirement boxes as typed. Percent boxes are in percent ("7" means 7%). */
export type RetirementFields = {
  age: string;
  retireAge: string;
  saved: string;
  monthlySaving: string;
  employerMatchPercent: string;
  low: string;
  mid: string;
  high: string;
  inflation: string;
  incomeWantedYearly: string;
  socialSecurityMonthly: string;
  withdrawal: string;
};

export type RetirementRead = { ok: true; input: RetirementInput } | { ok: false; message: string };

/**
 * Turn the typed boxes into an input, or say what is missing.
 * Age, retire age, the three returns, inflation, and withdrawal must be entered; a blank one is never 0.
 * Saved, monthly saving, match, income wanted, and Social Security may be blank and then mean none.
 */
export function retirementInputFrom(fields: RetirementFields): RetirementRead {
  const goal = "your retirement estimate";
  const age = readNumber(fields.age);
  const retireAge = readNumber(fields.retireAge);
  if (age == null) return { ok: false, message: `Enter your age to see ${goal}.` };
  if (age < PLAN_AGE_MIN || age > PLAN_AGE_MAX) {
    return { ok: false, message: `Enter an age between ${PLAN_AGE_MIN} and ${PLAN_AGE_MAX} to see ${goal}.` };
  }
  if (retireAge == null) return { ok: false, message: `Enter the age you want to retire to see ${goal}.` };
  if (retireAge <= age) return { ok: false, message: `Enter a retirement age older than your age now to see ${goal}.` };
  if (retireAge > PLAN_AGE_MAX) return { ok: false, message: `Enter a retirement age of ${PLAN_AGE_MAX} or younger to see ${goal}.` };
  const mid = readNumber(fields.mid);
  const low = readNumber(fields.low);
  const high = readNumber(fields.high);
  const inflation = readNumber(fields.inflation);
  const withdrawal = readNumber(fields.withdrawal);
  const missing = needsPrompt(
    [
      { label: "the expected return", value: mid },
      { label: "the low return", value: low },
      { label: "the high return", value: high },
      { label: "inflation", value: inflation },
      { label: "a withdrawal rate above 0", value: withdrawal, above: 0 },
    ],
    goal,
  );
  if (missing || mid == null || low == null || high == null || inflation == null || withdrawal == null) {
    return { ok: false, message: missing ?? `Fill in the boxes to see ${goal}.` };
  }
  const optional = (raw: string) => Math.max(0, readNumber(raw) ?? 0);
  return {
    ok: true,
    input: {
      age,
      retireAge,
      saved: optional(fields.saved),
      monthlySaving: optional(fields.monthlySaving),
      employerMatchPercent: optional(fields.employerMatchPercent),
      returns: { conservative: low / 100, expected: mid / 100, optimistic: high / 100 },
      inflation: inflation / 100,
      incomeWantedYearly: optional(fields.incomeWantedYearly),
      socialSecurityMonthly: optional(fields.socialSecurityMonthly),
      withdrawalRate: withdrawal / 100,
    },
  };
}

function monthlyFactor(annual: number) {
  return annual / 12;
}

/** End-of-month compounding, deposit after interest. Same order as the other calculators. */
export function nominalBalance(saved: number, monthly: number, annualRate: number, years: number): number {
  const months = Math.max(0, Math.round(years * 12));
  const rate = monthlyFactor(annualRate);
  const deposit = Math.max(0, monthly);
  const start = Math.max(0, saved);
  if (months === 0) return start;
  if (Math.abs(rate) < 1e-12) return start + deposit * months;
  const growth = Math.pow(1 + rate, months);
  return start * growth + (deposit * (growth - 1)) / rate;
}

function realOf(nominal: number, inflation: number, years: number) {
  if (inflation <= -0.99) return nominal;
  return nominal / Math.pow(1 + inflation, Math.max(0, years));
}

function contribution(input: RetirementInput) {
  return input.monthlySaving * (1 + input.employerMatchPercent / 100);
}

function portfolioNeed(input: RetirementInput) {
  return Math.max(0, input.incomeWantedYearly - input.socialSecurityMonthly * 12);
}

function incomeAt(input: RetirementInput, rate: number, years: number) {
  const nominal = nominalBalance(input.saved, contribution(input), rate, years);
  const real = realOf(nominal, input.inflation, years);
  const portfolio = input.withdrawalRate > 0 ? real * input.withdrawalRate : 0;
  return { nominal, real, portfolio, income: portfolio + input.socialSecurityMonthly * 12 };
}

function pathFor(input: RetirementInput, label: RetirementPath["label"], rate: number): RetirementPath {
  const years = Math.max(0, input.retireAge - input.age);
  const end = incomeAt(input, rate, years);
  const points: RetirementPoint[] = [];
  const step = years > 40 ? 2 : 1;
  for (let year = 0; year <= years; year += step) {
    const snap = incomeAt(input, rate, year);
    const contributed = input.saved + contribution(input) * year * 12;
    points.push({
      age: input.age + year,
      contributed: roundMoney(contributed),
      growth: roundMoney(snap.nominal - contributed),
      balance: roundMoney(snap.nominal),
      real: roundMoney(snap.real),
    });
  }
  if (!points.length || points[points.length - 1]?.age !== input.age + years) {
    const snap = incomeAt(input, rate, years);
    const contributed = input.saved + contribution(input) * years * 12;
    points.push({
      age: input.age + years,
      contributed: roundMoney(contributed),
      growth: roundMoney(snap.nominal - contributed),
      balance: roundMoney(snap.nominal),
      real: roundMoney(snap.real),
    });
  }
  const covered = input.incomeWantedYearly > 0 ? (end.income / input.incomeWantedYearly) * 100 : end.income > 0 ? 100 : 0;
  return {
    label,
    rate,
    balance: roundMoney(end.nominal),
    real: roundMoney(end.real),
    incomeYearly: roundMoney(end.income),
    coveredPercent: Math.round(covered),
    points,
  };
}

function extraMonthly(input: RetirementInput): number | null {
  const years = input.retireAge - input.age;
  if (years <= 0 || input.withdrawalRate <= 0) return null;
  const need = portfolioNeed(input);
  if (need <= 0) return 0;
  const targetReal = need / input.withdrawalRate;
  const target = targetReal * Math.pow(1 + input.inflation, years);
  const months = Math.round(years * 12);
  const rate = monthlyFactor(input.returns.expected);
  const growth = Math.pow(1 + rate, months);
  const fvSaved = input.saved * growth;
  let payment: number;
  if (Math.abs(rate) < 1e-12) payment = (target - input.saved) / months;
  else payment = ((target - fvSaved) * rate) / (growth - 1);
  const extra = payment - contribution(input);
  return roundMoney(Math.max(0, extra));
}

function extraWorkYears(input: RetirementInput): number | null {
  const baseYears = Math.max(0, input.retireAge - input.age);
  if (incomeAt(input, input.returns.expected, baseYears).income + 0.5 >= input.incomeWantedYearly) return 0;
  if (input.withdrawalRate <= 0 && input.socialSecurityMonthly * 12 + 0.5 < input.incomeWantedYearly) return null;
  for (let months = 1; months <= 50 * 12; months++) {
    const years = baseYears + months / 12;
    if (incomeAt(input, input.returns.expected, years).income + 0.5 >= input.incomeWantedYearly) {
      return months / 12;
    }
  }
  return null;
}

export function projectRetirement(raw: RetirementInput): RetirementResult {
  const input = cleanRetirementInput(raw);
  const years = Math.max(0, input.retireAge - input.age);
  const paths = [
    pathFor(input, "conservative", input.returns.conservative),
    pathFor(input, "expected", input.returns.expected),
    pathFor(input, "optimistic", input.returns.optimistic),
  ];
  const expected = paths[1];
  const gap = roundMoney(Math.max(0, input.incomeWantedYearly - expected.incomeYearly));
  const ss = roundMoney(input.socialSecurityMonthly * 12);
  const low = paths[0].real;
  const high = paths[2].real;
  const cover = input.incomeWantedYearly > 0 ? ` That covers about ${expected.coveredPercent} percent of what you want.` : "";
  const sentence =
    years <= 0
      ? `You are already past ${input.retireAge}. What you have now is about ${formatRough(expected.real)}.${cover}`
      : `At ${input.retireAge} you'd likely have about ${formatRough(expected.real)} (${formatRough(low)} to ${formatRough(high)}).${cover}`;
  return {
    years,
    age: input.age,
    retireAge: input.retireAge,
    paths,
    coveredPercent: expected.coveredPercent,
    gapYearly: gap,
    extraPerMonth: gap <= 0 ? 0 : extraMonthly(input),
    extraYears: gap <= 0 ? 0 : extraWorkYears(input),
    sentence,
    wantedYearly: roundMoney(input.incomeWantedYearly),
    socialSecurityYearly: ss,
  };
}

function formatRough(amount: number) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function retirementWithExtra(raw: RetirementInput, extraPerMonth: number): RetirementResult {
  const input = cleanRetirementInput(raw);
  return projectRetirement({ ...input, monthlySaving: input.monthlySaving + Math.max(0, extraPerMonth) });
}

export function retirementWithYears(raw: RetirementInput, extraYears: number): RetirementResult {
  const input = cleanRetirementInput(raw);
  return projectRetirement({ ...input, retireAge: input.retireAge + Math.max(0, extraYears) });
}

export type SensitivityRow = { label: string; real: number; coveredPercent: number };

export function retirementSensitivity(raw: RetirementInput): SensitivityRow[] {
  const input = cleanRetirementInput(raw);
  function row(label: string, patch: Partial<RetirementInput>): SensitivityRow {
    const next = projectRetirement({ ...input, ...patch, returns: patch.returns ?? input.returns });
    const expected = next.paths[1];
    return { label, real: expected.real, coveredPercent: expected.coveredPercent };
  }
  const rate = input.returns.expected;
  const band = (delta: number): ReturnBand => ({
    conservative: input.returns.conservative,
    expected: rate + delta,
    optimistic: input.returns.optimistic,
  });
  return [
    row("Return 2 points lower", { returns: band(-0.02) }),
    row("Return as entered", {}),
    row("Return 2 points higher", { returns: band(0.02) }),
    row("Saving $100 less", { monthlySaving: Math.max(0, input.monthlySaving - 100) }),
    row("Saving $100 more", { monthlySaving: input.monthlySaving + 100 }),
    row("Retire 3 years sooner", { retireAge: input.retireAge - 3 }),
    row("Retire 3 years later", { retireAge: input.retireAge + 3 }),
  ];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * One thousand seeded runs. Each year uses a normal return around the stated mean and spread.
 * After retirement, the wanted income (minus Social Security) is taken out, rising with inflation.
 */
export function retirementMonteCarlo(
  raw: RetirementInput,
  options?: { mean?: number; spread?: number; seed?: number; runs?: number; endAge?: number },
): MonteCarloResult {
  const input = cleanRetirementInput(raw);
  const mean = clamp(options?.mean ?? input.returns.expected, -0.5, 0.5);
  const spread = clamp(options?.spread ?? 0.12, 0, 0.5);
  const seed = Math.round(options?.seed ?? 20261004);
  const runs = clamp(Math.round(options?.runs ?? 1000), 1, 2000);
  const endAge = clamp(Math.round(options?.endAge ?? 95), input.age, 120);
  const rand = mulberry32(seed);
  const spendReal = portfolioNeed(input);
  const deposit = contribution(input) * 12;
  const ages: number[] = [];
  for (let age = input.age; age <= endAge; age++) ages.push(age);
  const grid: number[][] = ages.map(() => []);
  let lasts = 0;
  for (let run = 0; run < runs; run++) {
    let balance = input.saved;
    let alive = true;
    for (let index = 0; index < ages.length; index++) {
      const age = ages[index];
      const ret = mean + spread * gaussian(rand);
      if (age < input.retireAge) {
        balance = Math.max(0, balance * (1 + ret) + deposit);
      } else {
        const years = age - input.age;
        const draw = spendReal * Math.pow(1 + input.inflation, years);
        balance = balance * (1 + ret) - draw;
        if (balance <= 0) {
          balance = 0;
          alive = false;
        }
      }
      grid[index].push(balance);
    }
    if (alive && balance > 0) lasts += 1;
  }
  const points = ages.map((age, index) => {
    const sorted = [...grid[index]].sort((a, b) => a - b);
    const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))] ?? 0;
    return { age, p10: roundMoney(pick(0.1)), p50: roundMoney(pick(0.5)), p90: roundMoney(pick(0.9)) };
  });
  return { runs, seed, mean, spread, chanceLasts: lasts / runs, points };
}

/** Divide each path by inflation so the chart matches today's dollars. */
export function monteCarloInTodaysDollars(
  points: MonteCarloResult["points"],
  inflation: number,
  startAge: number,
): MonteCarloResult["points"] {
  return points.map((point) => {
    const years = Math.max(0, point.age - startAge);
    const div = Math.pow(1 + Math.max(0, inflation), years);
    return {
      age: point.age,
      p10: roundMoney(point.p10 / div),
      p50: roundMoney(point.p50 / div),
      p90: roundMoney(point.p90 / div),
    };
  });
}

export function futuresHeadline(chanceLasts: number): string {
  const tenths = Math.max(0, Math.min(10, Math.round(chanceLasts * 10)));
  return `On track in about ${tenths} of 10 futures`;
}

/** Cap a today's-dollar chart at the retirement-age 90th percentile, plus a little room. */
export function retirementChartCap(p90AtRetirement: number): number {
  if (!(p90AtRetirement > 0)) return 0;
  return roundMoney(p90AtRetirement * 1.25);
}

/**
 * Extra monthly saving that reaches the next tenth of futures.
 * Null when already 10 of 10, or when more than $2,000 a month is required.
 */
export function extraMonthlyForNextTenth(
  raw: RetirementInput,
  options?: { mean?: number; spread?: number; seed?: number; runs?: number },
): number | null {
  const opts = { mean: options?.mean, spread: options?.spread, seed: options?.seed ?? 20261004, runs: options?.runs ?? 40 };
  const base = retirementMonteCarlo(raw, opts);
  const tenths = Math.round(base.chanceLasts * 10);
  if (tenths >= 10) return null;
  const target = (tenths + 1) / 10;
  const score = (extra: number) => retirementMonteCarlo({ ...raw, monthlySaving: Math.max(0, raw.monthlySaving) + extra }, opts).chanceLasts;
  if (score(2000) + 1e-9 < target) return null;
  let low = 0;
  let high = 2000;
  for (let step = 0; step < 6; step++) {
    const mid = Math.round((low + high) / 2);
    if (score(mid) + 1e-9 >= target) high = mid;
    else low = mid;
  }
  return high > 0 && high <= 2000 ? high : null;
}

export function coverageLabel(percent: number): string {
  return percent > 150 ? "More than enough" : `${Math.round(percent)}%`;
}

export function defaultRetirementInput(): RetirementInput {
  return {
    age: 35,
    retireAge: DEFAULT_RETIRE_AGE,
    saved: 0,
    monthlySaving: 0,
    employerMatchPercent: 0,
    returns: { ...PLANNING_MARKET },
    inflation: DEFAULT_INFLATION,
    incomeWantedYearly: 0,
    socialSecurityMonthly: 0,
    withdrawalRate: DEFAULT_WITHDRAWAL,
  };
}
