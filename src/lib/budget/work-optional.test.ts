import assert from "node:assert/strict";
import test from "node:test";
import { coastAmount, fiPath, fiTarget, fiWhatIfs, planFi, readFi, realReturn, savingFromRate, yearsText, yearsToTarget, type FiFields, type FiInput } from "./work-optional.ts";

// Audit references (MATH_AUDIT.md "When work is optional", ref_other_out.json):
//   spending $1,408.44 a month = $16,901.28 a year → the number $422,532 at 4%
//   coast at 4.5% real over 38 years = $79,330.57 (coast_check); Fisher 4.39% → $82,562.52
//   saving rate 60.49% → saving ≈ $25,876 a year
//   from $0 at 4.5% real: 12.52 years; with $18,300 already invested: NPER(0.045, −25876, −18300, 422532) = 11.80 years
//   real 7% (0% inflation typed): 11.27 years; real 0% (3% return, 3% inflation): (1 − s) ÷ (s × w) = 16.33 years
// The old page showed 12.51 (ignored the $18,300), 12.23 for both the 0%-inflation and the 3%/3% cases
// (it swapped 0% inflation for 2%, and a 0 real return for 5%).

const spendYear = 1408.44 * 12;
const s = 0.6049;
const saveYear = (spendYear * s) / (1 - s);
const two = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

/** Independent check: add years one at a time and interpolate inside the last year (like NPER would solve). */
function loopYears(start: number, save: number, r: number, target: number): number {
  let balance = start;
  for (let year = 0; year < 200; year++) {
    const next = balance * (1 + r) + save;
    if (next >= target) {
      // Solve inside the year with the closed form on one step, so the check is exact.
      const x = r === 0 ? (target - balance) / save : Math.log((target * r + save) / (balance * r + save)) / Math.log(1 + r);
      return year + x;
    }
    balance = next;
  }
  return Infinity;
}

test("the number: $16,901.28 a year at 4% is $422,532.00", () => {
  assert.equal(fiTarget(spendYear, 0.04), 422532);
  assert.equal(fiTarget(40000, 0.04), 1000000);
});

test("coast: $79,330.57 at 4.5% real over 38 years; $82,562.52 with the exact 4.39%", () => {
  assert.equal(coastAmount(422532, 0.045, 38), 79330.57);
  assert.equal(coastAmount(422532, realReturn(0.07, 0.025), 38), 82562.52);
});

test("real return is exact (Fisher), and 0 or negative is kept", () => {
  assert.equal(Math.round(realReturn(0.07, 0.025) * 1e6) / 1e6, 0.043902);
  assert.equal(realReturn(0.07, 0), 0.07);
  assert.equal(realReturn(0.03, 0.03), 0);
  assert.ok(realReturn(0.02, 0.03) < 0);
});

test("years from $0 at 4.5% real: 12.52", () => {
  const years = yearsToTarget({ start: 0, yearlySave: saveYear, rate: 0.045, target: 422532 });
  assert.equal(two(years), 12.52);
  // Same as the textbook from-$0 formula.
  assert.equal(two(Math.log(1 + (0.045 * (1 - s)) / (s * 0.04)) / Math.log(1.045)), 12.52);
});

test("years with $18,300 already invested: 11.80 (NPER), not 12.52", () => {
  assert.equal(two(yearsToTarget({ start: 18300, yearlySave: 25876, rate: 0.045, target: 422532 })), 11.8);
  assert.equal(two(yearsToTarget({ start: 18300, yearlySave: saveYear, rate: 0.045, target: 422532 })), 11.8);
  assert.equal(two(yearsToTarget({ start: 18300, yearlySave: 25876, rate: 0.045, target: 422532 })), two(loopYears(18300, 25876, 0.045, 422532)));
});

test("0% inflation typed stays 0%: real 7% gives 11.27 years", () => {
  const input: FiInput = { yearlySpend: spendYear, yearlySave: saveYear, invested: 0, rate: 0.07, inflation: 0, withdrawal: 0.04 };
  assert.equal(two(planFi(input, { age: null, retireAge: null }).years), 11.27);
});

test("return equal to inflation: real 0 gives 16.33 years, not a made-up 5%", () => {
  const input: FiInput = { yearlySpend: spendYear, yearlySave: saveYear, invested: 0, rate: 0.03, inflation: 0.03, withdrawal: 0.04 };
  const plan = planFi(input, { age: null, retireAge: null });
  assert.equal(plan.real, 0);
  assert.equal(two(plan.years), 16.33);
  assert.equal(two((1 - s) / (s * 0.04)), 16.33);
});

test("the page's own case: 7% return, 2.5% inflation, $18,300 invested, age 29, retire 67", () => {
  const input: FiInput = { yearlySpend: spendYear, yearlySave: saveYear, invested: 18300, rate: 0.07, inflation: 0.025, withdrawal: 0.04 };
  const plan = planFi(input, { age: 29, retireAge: 67 });
  assert.equal(plan.target, 422532);
  assert.equal(two(plan.years), 11.87);
  assert.equal(plan.reachAge, 41);
  assert.equal(plan.yearsLeft, 38);
  assert.equal(plan.coast, 82562.52);
  assert.equal(yearsText(plan.years), "11.9 years");
});

test("negative real return: gets there only if saving can outrun the shrink", () => {
  assert.equal(yearsToTarget({ start: 0, yearlySave: 1000, rate: -0.01, target: 200000 }), null); // ceiling is $100,000
  const n = yearsToTarget({ start: 0, yearlySave: 10000, rate: -0.01, target: 100000 });
  assert.ok(n != null && n > 10);
  assert.equal(two(n), two(loopYears(0, 10000, -0.01, 100000)));
});

test("edge cases: already there, no saving, never", () => {
  assert.equal(yearsToTarget({ start: 500000, yearlySave: 0, rate: 0.04, target: 422532 }), 0);
  assert.equal(two(yearsToTarget({ start: 100000, yearlySave: 0, rate: 0.05, target: 200000 })), two(Math.log(2) / Math.log(1.05)));
  assert.equal(yearsToTarget({ start: 0, yearlySave: 0, rate: 0.05, target: 200000 }), null);
  assert.equal(yearsToTarget({ start: 1000, yearlySave: 0, rate: 0, target: 200000 }), null);
  assert.equal(yearsToTarget({ start: 0, yearlySave: 100, rate: 0, target: 200000 }), null); // 2,000 years, past the 100-year cap
  assert.equal(yearsText(null), "not within 100 years");
  assert.equal(yearsText(0), "now");
});

test("blank boxes ask for a number; a typed 0 is fine where it makes sense", () => {
  const fields: FiFields = { spendMonthly: "1,408.44", saveMonthly: "2156.33", invested: "$18,300", rate: "7", inflation: "2.5", withdrawal: "4" };
  const ok = readFi(fields);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.input.yearlySpend, spendYear);
    assert.equal(ok.input.invested, 18300);
    assert.equal(ok.input.withdrawal, 0.04);
  }
  const prompt = (change: Partial<FiFields>) => {
    const out = readFi({ ...fields, ...change });
    return out.ok ? null : out.prompt;
  };
  assert.equal(prompt({ spendMonthly: "" }), "Enter your spending a month to see when work could be optional.");
  assert.equal(prompt({ saveMonthly: "" }), "Enter what you save a month (0 is fine) to see when work could be optional.");
  assert.equal(prompt({ invested: "" }), "Enter what you already have invested (0 is fine) to see when work could be optional.");
  assert.equal(prompt({ rate: "" }), "Enter the yearly return to see when work could be optional.");
  assert.equal(prompt({ inflation: "" }), "Enter inflation (0 is fine) to see when work could be optional.");
  assert.equal(prompt({ withdrawal: "" }), "Enter a withdrawal rate above 0 to see when work could be optional.");
  assert.equal(prompt({ withdrawal: "0" }), "Enter a withdrawal rate above 0 to see when work could be optional.");
  assert.equal(prompt({ inflation: "0" }), null);
  assert.equal(prompt({ invested: "0" }), null);
  assert.equal(prompt({ saveMonthly: "0" }), null);
  const zero = readFi({ ...fields, inflation: "0" });
  assert.ok(zero.ok && zero.input.inflation === 0);
});

test("what-ifs all move the answer: the $100 rows really change saving and spending", () => {
  const input: FiInput = { yearlySpend: spendYear, yearlySave: saveYear, invested: 18300, rate: 0.07, inflation: 0.025, withdrawal: 0.04 };
  const rows = fiWhatIfs(input);
  assert.deepEqual(rows.map((row) => row.label), ["As entered", "Return 2 points lower", "Return 2 points higher", "Save $100 more a month", "Save $100 less a month", "Spend $100 less a month"]);
  const base = rows[0].years ?? 0;
  for (const row of rows.slice(1)) assert.notEqual(two(row.years), two(base), row.label);
  assert.ok((rows[3].years ?? 99) < base && (rows[4].years ?? 0) > base && (rows[5].years ?? 99) < base);
  // A row that can't move the answer is left out (already there: every row is 0).
  assert.deepEqual(fiWhatIfs({ ...input, invested: 1e7 }).map((row) => row.label), ["As entered"]);
});

test("year table ends on the first year at or past the number", () => {
  const input: FiInput = { yearlySpend: spendYear, yearlySave: 25876, invested: 18300, rate: 0.07, inflation: 0.025, withdrawal: 0.04 };
  const path = fiPath(input);
  assert.equal(path[0].balance, 18300);
  assert.equal(path.length - 1, 12);
  assert.ok(path.at(-1)?.reached && !path.at(-2)?.reached);
  assert.equal(path[1].balance, Math.round((18300 * (1.07 / 1.025) + 25876) * 100) / 100);
});

test("saving implied by a savings rate (spending + saving = take-home)", () => {
  assert.equal(savingFromRate(1408.44, 0.6049), Math.round(((1408.44 * 0.6049) / 0.3951) * 100) / 100);
  assert.equal(savingFromRate(1000, 0), 0);
  assert.equal(savingFromRate(1000, 1), null);
  assert.equal(savingFromRate(0, 0.2), null);
});
