import assert from "node:assert/strict";
import { test } from "node:test";
import { factNote, needsPrompt, optionalAmount, readLoan, readNumber } from "./calc-input.ts";
import { loanCompare } from "./grow-math.ts";
import { projectRetirement, retirementInputFrom, type RetirementFields } from "./retirement.ts";

/** Scenario (d) from the math audit: 29 → 67, $18,300 saved, $500 a month, 7%, 2.5% inflation. */
const scenarioD: RetirementFields = {
  age: "29",
  retireAge: "67",
  saved: "18300",
  monthlySaving: "500",
  employerMatchPercent: "0",
  low: "4",
  mid: "7",
  high: "10",
  inflation: "2.5",
  incomeWantedYearly: "13521",
  socialSecurityMonthly: "",
  withdrawal: "4",
};

function rough(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

test("optionalAmount treats a blank as an assumed 0 and rejects junk", () => {
  assert.deepEqual(optionalAmount(""), { amount: 0, assumed: true, invalid: false });
  assert.deepEqual(optionalAmount("0"), { amount: 0, assumed: false, invalid: false });
  assert.deepEqual(optionalAmount("abc"), { amount: 0, assumed: false, invalid: true });
});

test("readNumber keeps blank apart from an explicit 0", () => {
  assert.equal(readNumber(""), null);
  assert.equal(readNumber("   "), null);
  assert.equal(readNumber("abc"), null);
  assert.equal(readNumber("."), null);
  assert.equal(readNumber("0"), 0);
  assert.equal(readNumber("0.0"), 0);
  assert.equal(readNumber("$1,240"), 1240);
  assert.equal(readNumber("6.5%"), 6.5);
  assert.equal(readNumber("-2"), -2);
  assert.equal(readNumber(".5"), 0.5);
  assert.equal(readNumber(null), null);
});

test("needsPrompt names the first missing box in one plain sentence", () => {
  assert.equal(needsPrompt([{ label: "the interest rate", value: null }], "payments"), "Enter the interest rate to see payments.");
  assert.equal(needsPrompt([{ label: "the goal amount", value: 0, above: 0 }], "the monthly amount"), "Enter the goal amount to see the monthly amount.");
  assert.equal(needsPrompt([{ label: "the rate", value: 0, min: 0 }], "x"), null, "0 typed on purpose is allowed");
});

test("blank age gives no retirement projection, never age 0", () => {
  const read = retirementInputFrom({ ...scenarioD, age: "" });
  assert.equal(read.ok, false);
  assert.equal(read.ok ? "" : read.message, "Enter your age to see your retirement estimate.");
  for (const age of ["0", "abc", "8", "130"]) {
    assert.equal(retirementInputFrom({ ...scenarioD, age }).ok, false, `age "${age}" is refused`);
  }
});

test("blank or too-early retire age gives no projection", () => {
  assert.equal(retirementInputFrom({ ...scenarioD, retireAge: "" }).ok, false);
  assert.equal(retirementInputFrom({ ...scenarioD, retireAge: "29" }).ok, false);
  assert.equal(retirementInputFrom({ ...scenarioD, retireAge: "25" }).ok, false);
  const message = retirementInputFrom({ ...scenarioD, retireAge: "25" });
  assert.match(message.ok ? "" : message.message, /older than your age now/);
});

test("blank return, inflation, or withdrawal is asked for, not read as 0", () => {
  for (const key of ["mid", "low", "high", "inflation", "withdrawal"] as const) {
    assert.equal(retirementInputFrom({ ...scenarioD, [key]: "" }).ok, false, `${key} blank`);
  }
  assert.equal(retirementInputFrom({ ...scenarioD, withdrawal: "0" }).ok, false, "a 0% withdrawal cannot pay any income");
  assert.equal(retirementInputFrom({ ...scenarioD, inflation: "0" }).ok, true, "0% inflation typed on purpose is fine");
  const optional = retirementInputFrom({ ...scenarioD, saved: "", monthlySaving: "", employerMatchPercent: "", socialSecurityMonthly: "" });
  assert.equal(optional.ok, true, "blank saved, monthly, match, and Social Security mean none");
});

test("a valid age matches the reference scenario", () => {
  const read = retirementInputFrom(scenarioD);
  assert.ok(read.ok);
  const result = projectRetirement(read.input);
  const likely = result.paths[1];
  assert.equal(result.age, 29);
  assert.equal(result.years, 38);
  assert.equal(likely.balance, 1389856.19);
  assert.equal(likely.real, 543829.77);
  assert.equal(result.coveredPercent, 161);
});

test("Low, Likely, and High come from the projection at the retire age, the same as the headline", () => {
  const read = retirementInputFrom(scenarioD);
  assert.ok(read.ok);
  const result = projectRetirement(read.input);
  const [low, likely, high] = result.paths;
  for (const path of result.paths) {
    const last = path.points.at(-1);
    assert.equal(last?.age, 67, `${path.label} ends at the retire age`);
    assert.equal(last?.real, path.real, `${path.label} chart end equals its box value`);
  }
  assert.ok(result.sentence.includes(rough(likely.real)), "headline shows the Likely value");
  assert.ok(result.sentence.includes(`(${rough(low.real)} to ${rough(high.real)})`), "headline range is Low to High at 67");
  assert.ok(low.real < likely.real && likely.real < high.real);
});

test("no income wanted means no 'covers' claim", () => {
  const read = retirementInputFrom({ ...scenarioD, incomeWantedYearly: "" });
  assert.ok(read.ok);
  const result = projectRetirement(read.input);
  assert.doesNotMatch(result.sentence, /covers/);
});

test("blank loan rate gives no result", () => {
  const read = readLoan({ balance: "1240", apr: "", years: "5", extra: "0" });
  assert.equal(read.ok, false);
  assert.equal(read.ok ? "" : read.prompt, "Enter the interest rate to see payments.");
  assert.equal(readLoan({ balance: "", apr: "6.5", years: "30", extra: "" }).ok, false);
  assert.equal(readLoan({ balance: "1000", apr: "6.5", years: "", extra: "" }).ok, false);
  assert.equal(readLoan({ balance: "1000", apr: "abc", years: "5", extra: "" }).ok, false);
});

test("an explicit 0% loan rate pays principal over the months", () => {
  const read = readLoan({ balance: "1200", apr: "0", years: "5", extra: "" });
  assert.ok(read.ok);
  assert.equal(read.apr, 0);
  assert.equal(read.extra, 0, "blank extra means no extra");
  const result = loanCompare(read);
  assert.equal(result.payment, 20);
  assert.equal(result.interest, 0);
  assert.equal(result.months, 60);
});

test("a typed loan matches the reference mortgage", () => {
  const read = readLoan({ balance: "300,000", apr: "6.5", years: "30", extra: "0" });
  assert.ok(read.ok);
  const result = loanCompare(read);
  assert.equal(result.payment, 1896.2);
  assert.equal(result.months, 360);
});

test("factNote renders clean helper text", () => {
  assert.equal(factNote({ note: "From birth year 1997.", source: "typed" }), "From birth year 1997.");
  assert.equal(factNote({ note: "Not entered yet.", source: "typed" }), "Not entered yet.");
  assert.equal(factNote({ note: "Retirement and investment balances.", source: "from your accounts" }), "From your accounts. Retirement and investment balances.");
  assert.equal(factNote({ note: "Planning range", source: "default" }), "Planning range.");
  assert.doesNotMatch(factNote({ note: "Not entered yet.", source: "typed" }), /typed/);
});
