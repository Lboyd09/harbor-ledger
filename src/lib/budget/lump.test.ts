import assert from "node:assert/strict";
import test from "node:test";
import { yearRows } from "./grow-tables.ts";
import { debtFirstNote, growLump, lumpPath, lumpWhatIfs, readLump, type LumpFields, type LumpInput } from "./lump.ts";

// Audit references (MATH_AUDIT.md section 3, ref_other_out.json, numpy-financial fv):
//   npf.fv(0.07/12, 120, 0, -10000) = 20,096.61376695633
//   $8,751 at 7% for 10 years, monthly = $17,586.55; after 15% tax on the gain = $16,261.22
// The old headline compounded once a year with 22% tax: $15,352.56 for $8,751, $17,543.78 for $10,000.

const base: LumpInput = { amount: 10000, years: 10, rate: 0.07, gainTax: 0.15, inflation: 0.02, today: false };

/** Independent check: plain month-by-month loop, no Math.pow. */
function loop(amount: number, rate: number, months: number): number {
  let balance = amount;
  for (let m = 0; m < months; m++) balance += balance * (rate / 12);
  return balance;
}

test("$10,000 at 7% for 10 years matches numpy-financial fv to the cent", () => {
  const out = growLump(base);
  assert.equal(out.months, 120);
  assert.equal(out.beforeTax, 20096.61);
  assert.equal(out.beforeTax, Math.round(loop(10000, 0.07, 120) * 100) / 100);
  assert.equal(out.gain, 10096.61);
  assert.equal(out.taxOnGain, 1514.49);
  assert.equal(out.afterTax, 18582.12);
  // Not the old once-a-year figure.
  assert.notEqual(out.beforeTax, 19671.51);
});

test("$8,751 (the reported case): $17,586.55 before tax, $16,261.22 after 15% tax on the gain", () => {
  const out = growLump({ ...base, amount: 8751 });
  assert.equal(out.beforeTax, 17586.55);
  assert.equal(out.gain, 8835.55);
  assert.equal(out.taxOnGain, 1325.33);
  assert.equal(out.afterTax, 16261.22);
  assert.equal(out.shownBeforeTax, 17586.55);
  assert.equal(out.shownAfterTax, 16261.22);
});

test("the headline, the year table and the as-entered what-if agree", () => {
  for (const input of [base, { ...base, amount: 8751 }, { ...base, rate: 0.09 }, { ...base, today: true }, { ...base, years: 2.5 }]) {
    const out = growLump(input);
    const table = yearRows({ principal: input.amount, monthly: 0, years: input.years, rate: input.rate, inflation: input.inflation, today: input.today });
    assert.equal(table.at(-1)?.balance, out.shownBeforeTax);
    assert.equal(lumpWhatIfs(input).find((row) => row.label === "As entered")?.beforeTax, out.shownBeforeTax);
    assert.equal(lumpPath(input).at(-1)?.mid, out.shownBeforeTax);
  }
});

test("the typed rate is used: 9% gives more than 7%, 5% gives less", () => {
  assert.equal(growLump({ ...base, rate: 0.09 }).beforeTax, 24513.57);
  assert.equal(growLump({ ...base, rate: 0.05 }).beforeTax, 16470.09);
});

test("today's dollars divide by inflation for each year", () => {
  const out = growLump({ ...base, today: true });
  assert.equal(out.beforeTax, 20096.61);
  assert.equal(out.shownBeforeTax, 16486.22);
  assert.equal(out.shownAfterTax, Math.round((18582.12 / 1.02 ** 10) * 100) / 100);
});

test("rate 0 and years 0 keep the amount; 0% tax keeps all the gain", () => {
  const flat = growLump({ ...base, rate: 0 });
  assert.equal(flat.beforeTax, 10000);
  assert.equal(flat.taxOnGain, 0);
  assert.equal(growLump({ ...base, years: 0 }).beforeTax, 10000);
  assert.equal(growLump({ ...base, years: 0 }).months, 0);
  const noTax = growLump({ ...base, gainTax: 0 });
  assert.equal(noTax.afterTax, noTax.beforeTax);
});

test("a loss is not taxed", () => {
  const out = growLump({ ...base, rate: -0.05 });
  assert.ok(out.gain < 0);
  assert.equal(out.taxOnGain, 0);
  assert.equal(out.afterTax, out.beforeTax);
});

test("blank boxes ask for a number; typed 0 is fine where it makes sense", () => {
  const fields: LumpFields = { amount: "8,751", years: "10", rate: "7", gainTax: "15", inflation: "2", today: false };
  const ok = readLump(fields);
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.input, { amount: 8751, years: 10, rate: 0.07, gainTax: 0.15, inflation: 0.02, today: false });
  assert.deepEqual(readLump({ ...fields, amount: "" }), { ok: false, prompt: "Enter an amount to see what it could grow to." });
  assert.deepEqual(readLump({ ...fields, amount: "0" }), { ok: false, prompt: "Enter an amount to see what it could grow to." });
  assert.deepEqual(readLump({ ...fields, years: "" }), { ok: false, prompt: "Enter how many years (0 to 100) to see what it could grow to." });
  assert.deepEqual(readLump({ ...fields, rate: "" }), { ok: false, prompt: "Enter the yearly rate to see what it could grow to." });
  assert.deepEqual(readLump({ ...fields, gainTax: "" }), { ok: false, prompt: "Enter the tax on the gain (0 is fine) to see what it could grow to." });
  assert.equal(readLump({ ...fields, rate: "0" }).ok, true);
  assert.equal(readLump({ ...fields, gainTax: "0" }).ok, true);
  assert.equal(readLump({ ...fields, years: "0" }).ok, true);
  // Inflation only matters for today's dollars.
  assert.equal(readLump({ ...fields, inflation: "" }).ok, true);
  assert.deepEqual(readLump({ ...fields, inflation: "", today: true }), { ok: false, prompt: "Enter inflation (0 is fine) to see what it could grow to." });
  assert.equal(readLump({ ...fields, inflation: "0", today: true }).ok, true);
});

test("what-ifs move the result: rate and years, no dead monthly rows", () => {
  const rows = lumpWhatIfs(base);
  assert.deepEqual(rows.map((row) => row.label), ["Return 2 points lower", "As entered", "Return 2 points higher", "5 fewer years", "5 more years"]);
  const values = rows.map((row) => row.beforeTax);
  assert.equal(new Set(values).size, values.length);
  assert.equal(rows[0].beforeTax, 16470.09);
  assert.equal(rows[2].beforeTax, 24513.57);
  assert.equal(rows[3].beforeTax, Math.round(10000 * (1 + 0.07 / 12) ** 60 * 100) / 100);
  assert.equal(rows[4].beforeTax, Math.round(10000 * (1 + 0.07 / 12) ** 180 * 100) / 100);
  assert.deepEqual(lumpWhatIfs({ ...base, years: 3 }).map((row) => row.label), ["Return 2 points lower", "As entered", "Return 2 points higher", "5 more years"]);
});

test("chart path: year 0 is the amount, fractional years end on the exact year", () => {
  const path = lumpPath({ ...base, years: 2.5 });
  assert.deepEqual(path.map((p) => p.year), [0, 1, 2, 2.5]);
  assert.equal(path[0].mid, 10000);
  assert.ok(path.every((p) => p.low <= p.mid && p.mid <= p.high));
});

test("high-interest debt gets a plain pay-it-first note", () => {
  const visa = { id: "v", name: "Visa", balance: 1240, apr: 24.99, minimum: 40 };
  const loan = { id: "s", name: "Student loan", balance: 18500, apr: 5.5, minimum: 280 };
  assert.equal(debtFirstNote([loan, visa], 0.07), "Your Visa charges 24.99%. Paying it off first is a sure 24.99% back, more than the 7% used here.");
  assert.equal(debtFirstNote([loan], 0.07), null);
  assert.equal(debtFirstNote([{ ...visa, balance: 0 }], 0.07), null);
  assert.equal(debtFirstNote([], 0.07), null);
});
