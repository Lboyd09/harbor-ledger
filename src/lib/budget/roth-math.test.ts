import assert from "node:assert/strict";
import { test } from "node:test";
import { iraLimitCheck, rothVerdict, rothVsTraditional, rothWhatIfs, yearlyDepositsValue, type RothInput } from "./grow-math.ts";
import { DEFAULT_IRA, iraLimit } from "./ira.ts";

/** Audit reference: $7,500 of pre-tax pay a year, 10 years, 7%, 22% tax now, 12% later. */
const reference: RothInput = { annual: 7500, years: 10, rate: 0.07, taxNow: 0.22, taxLater: 0.12, inflation: 0.02, today: false };

/** Independent end-of-year annuity formula, written out longhand. */
function annuity(deposit: number, rate: number, years: number) {
  let balance = 0;
  for (let year = 1; year <= years; year++) balance = balance * (1 + rate) + deposit;
  return balance;
}

const cents = (n: number) => Math.round(n * 100) / 100;

test("yearly deposits accumulate every year: FV = P × ((1 + r)^n − 1) / r", () => {
  assert.equal(cents(yearlyDepositsValue(7500, 0.07, 10)), cents(annuity(7500, 0.07, 10)));
  assert.equal(cents(yearlyDepositsValue(7500, 0.07, 10)), cents((7500 * (Math.pow(1.07, 10) - 1)) / 0.07));
  assert.equal(cents(yearlyDepositsValue(7500, 0.07, 10)), 103623.36);
  assert.equal(yearlyDepositsValue(7500, 0, 10), 75000, "0% is the deposits added up");
  assert.equal(yearlyDepositsValue(7500, 0.07, 0), 0);
  assert.equal(cents(yearlyDepositsValue(1000, 0.1, 2.5)), cents(2100 * Math.pow(1.1, 0.5)), "a part year only grows");
});

test("reference case matches the audit: Roth $80,826.22, traditional $91,188.56", () => {
  const result = rothVsTraditional(reference);
  assert.equal(result.roth, 80826.22);
  assert.equal(result.traditional, 91188.56);
  assert.equal(result.roth, cents(annuity(7500 * 0.78, 0.07, 10)));
  assert.equal(result.traditional, cents(annuity(7500, 0.07, 10) * 0.88));
  assert.equal(result.traditionalBeforeTax, 103623.36);
  assert.equal(result.rothYearly, 5850);
  assert.equal(result.rothContributed, 58500);
  assert.equal(result.traditionalContributed, 75000);
});

test("what you put in never exceeds what you end with when the rate is above 0", () => {
  for (const years of [1, 2, 5, 10, 30]) {
    for (const rate of [0.01, 0.04, 0.07, 0.1]) {
      const result = rothVsTraditional({ ...reference, years, rate, taxLater: 0 });
      assert.ok(result.roth >= result.rothContributed, `Roth ${years}y ${rate}`);
      assert.ok(result.traditionalBeforeTax >= result.traditionalContributed, `traditional ${years}y ${rate}`);
    }
  }
});

test("a 0% rate gives back exactly what was put in", () => {
  const result = rothVsTraditional({ ...reference, rate: 0, taxLater: 0 });
  assert.equal(result.roth, result.rothContributed);
  assert.equal(result.roth, 58500);
  assert.equal(result.traditional, 75000);
});

test("today's dollars divide the ending value by inflation", () => {
  const nominal = rothVsTraditional(reference);
  const real = rothVsTraditional({ ...reference, today: true });
  assert.equal(real.roth, cents(nominal.roth / Math.pow(1.02, 10)));
});

test("the verdict reads plainly and names the winner and the gap", () => {
  const result = rothVsTraditional(reference);
  assert.equal(rothVerdict(result, 0.22, 0.12), "Traditional leaves you about $10,362 more after taxes, because your tax rate later (12%) is lower than now (22%).");
  const flipped = rothVsTraditional({ ...reference, taxNow: 0.12, taxLater: 0.22 });
  assert.match(rothVerdict(flipped, 0.12, 0.22), /^Roth leaves you about \$[\d,]+ more after taxes/);
  const tie = rothVsTraditional({ ...reference, taxNow: 0.22, taxLater: 0.22 });
  assert.equal(tie.roth, tie.traditional);
  assert.match(rothVerdict(tie, 0.22, 0.22), /about the same/);
});

test("every what-if row changes the result", () => {
  const rows = rothWhatIfs(reference);
  const base = rows.find((row) => row.label === "As entered");
  assert.ok(base);
  assert.equal(base.roth, 80826.22);
  for (const row of rows) {
    if (row === base) continue;
    assert.ok(row.roth !== base.roth || row.traditional !== base.traditional, `${row.label} changes something`);
  }
  assert.equal(rows.find((row) => row.label === "$1,000 more each year")?.roth, cents(annuity(8500 * 0.78, 0.07, 10)));
  assert.ok(!rows.some((row) => /monthly/i.test(row.label)), "no monthly rows on a yearly calculator");
});

test("the IRA limit is checked against what actually goes in", () => {
  const limit = iraLimit(DEFAULT_IRA, false);
  assert.equal(limit, 7500);
  const atLimit = iraLimitCheck(7500, 0.22, limit);
  assert.deepEqual(atLimit, { rothIn: 5850, traditionalIn: 7500, rothOver: 0, traditionalOver: 0 });
  // $9,615 of pre-tax pay is a full $7,500 Roth, which is allowed, but too much for traditional.
  const maxRoth = iraLimitCheck(9615, 0.22, limit);
  assert.equal(maxRoth.rothIn, 7499.7);
  assert.equal(maxRoth.rothOver, 0);
  assert.equal(maxRoth.traditionalOver, 2115);
  assert.equal(iraLimit(DEFAULT_IRA, true), 8600, "catch-up at 50 or older");
});
