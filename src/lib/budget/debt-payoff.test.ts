import assert from "node:assert/strict";
import { test } from "node:test";
import { debtWhatIfs, extraNeeded, paymentBelowInterest, payoffPlan, simulatePayoff, type DebtMethod } from "./grow-math.ts";
import { debtMatchesPayoff, debtTimeline } from "./grow-tables.ts";
import type { DebtItem } from "./types.ts";

/**
 * Independent reference, a straight port of the math audit's ref_debt.py:
 * interest first (rounded to the cent), then every minimum, then the rest of
 * (all original minimums + extra) to the target. Balances are left unrounded.
 */
function reference(debts: DebtItem[], extra: number, method: DebtMethod) {
  const ds = debts.map((d) => ({ name: d.name, bal: d.balance, apr: d.apr, min: d.minimum }));
  const budget = ds.reduce((s, d) => s + d.min, 0) + extra;
  let interest = 0;
  let paid = 0;
  let month = 0;
  const payoff: Record<string, number> = {};
  while (ds.some((d) => d.bal > 0.005) && month < 600) {
    month += 1;
    for (const d of ds) {
      if (d.bal > 0) {
        const i = Math.round(((d.bal * d.apr) / 100 / 12) * 100) / 100;
        d.bal += i;
        interest += i;
      }
    }
    const live = ds.filter((d) => d.bal > 0.005);
    const order = [...live].sort((a, b) => (method === "snowball" ? a.bal - b.bal || b.apr - a.apr : b.apr - a.apr || a.bal - b.bal));
    let pool = budget;
    for (const d of live) {
      const p = Math.min(d.bal, d.min);
      d.bal -= p;
      pool -= p;
      paid += p;
    }
    for (const d of order) {
      if (pool <= 0) break;
      if (d.bal > 0) {
        const p = Math.min(d.bal, pool);
        d.bal -= p;
        pool -= p;
        paid += p;
      }
    }
    for (const d of ds) if (d.bal <= 0.005 && !(d.name in payoff)) payoff[d.name] = month;
  }
  return { months: month, interest: Math.round(interest * 100) / 100, paid: Math.round(paid * 100) / 100, payoff };
}

const scenarioB: DebtItem[] = [
  { id: "visa", name: "Visa", balance: 1240, apr: 24.99, minimum: 40 },
  { id: "student", name: "Student loan", balance: 18500, apr: 5.5, minimum: 280 },
];

const caseB2: DebtItem[] = [
  { id: "a", name: "A", balance: 500, apr: 10, minimum: 25 },
  { id: "b", name: "B", balance: 3000, apr: 22, minimum: 90 },
];

test("scenario (b): 47 months and $2,337.61 interest, matching the independent loop", () => {
  const sim = simulatePayoff(scenarioB, 150, "avalanche");
  const ref = reference(scenarioB, 150, "avalanche");
  assert.equal(ref.months, 47);
  assert.equal(ref.interest, 2337.61);
  assert.equal(sim.months, ref.months);
  assert.equal(sim.interest, ref.interest);
  assert.equal(sim.paid, ref.paid);
  assert.equal(sim.paid, 22077.61, "paid is the balances plus interest, no final-month overpayment");
  assert.equal(sim.unfinished, false);
  assert.deepEqual(
    sim.payoffs.map((d) => [d.name, d.month]),
    [
      ["Visa", ref.payoff.Visa],
      ["Student loan", ref.payoff["Student loan"]],
    ],
  );
  assert.equal(ref.payoff.Visa, 8);
});

test("scenario (b) minimums only: 76 months, matching the independent loop", () => {
  const sim = simulatePayoff(scenarioB, 0, "avalanche");
  const ref = reference(scenarioB, 0, "avalanche");
  assert.equal(ref.months, 76);
  assert.equal(sim.months, ref.months);
  assert.equal(sim.interest, ref.interest);
  assert.equal(sim.interest, 4293.06);
});

test("avalanche vs snowball, case b2: 20 months / about $622.70 vs 20 months / $677.59", () => {
  const ava = simulatePayoff(caseB2, 100, "avalanche");
  const snow = simulatePayoff(caseB2, 100, "snowball");
  for (const [sim, method] of [
    [ava, "avalanche"],
    [snow, "snowball"],
  ] as const) {
    const ref = reference(caseB2, 100, method);
    assert.equal(sim.months, ref.months, method);
    assert.equal(sim.interest, ref.interest, method);
  }
  // The audit's Python reference shows $622.70. Python's round() rounds a half cent to even (and
  // works on the binary value); Math.round rounds half up. One monthly charge lands on a half cent here.
  assert.deepEqual([ava.months, snow.months], [20, 20]);
  assert.ok(Math.abs(ava.interest - 622.7) <= 0.01, `avalanche interest ${ava.interest}`);
  assert.equal(snow.interest, 677.59);
  assert.ok(ava.interest < snow.interest, "highest rate first costs less here");
});

test("a paid-off debt's minimum rolls into the next one", () => {
  const debts: DebtItem[] = [
    { id: "small", name: "Small", balance: 100, apr: 0, minimum: 50 },
    { id: "big", name: "Big", balance: 1000, apr: 0, minimum: 50 },
  ];
  const sim = simulatePayoff(debts, 0, "snowball");
  // Months 1-2: $50 + $50. Small is gone after month 2; from month 3 Big gets the full $100.
  assert.equal(sim.payoffs[0].month, 2);
  assert.deepEqual(sim.remaining.slice(0, 4), [1100, 1000, 900, 800]);
  assert.equal(sim.months, 11, "without rollover Big alone would take 20 months");
  assert.equal(sim.interest, 0);
});

test("interest is charged on the opening balance before the payment", () => {
  const sim = simulatePayoff([{ id: "x", name: "Card", balance: 1200, apr: 12, minimum: 100 }], 0, "avalanche");
  // Month 1: 1200 × 1% = 12.00 interest, then 100 paid → 1112.00.
  assert.equal(sim.remaining[1], 1112);
});

test("one debt: a plain payoff, and both orders agree", () => {
  const one: DebtItem[] = [scenarioB[0]];
  const ava = simulatePayoff(one, 50, "avalanche");
  const snow = simulatePayoff(one, 50, "snowball");
  const ref = reference(one, 50, "avalanche");
  assert.equal(ava.months, ref.months);
  assert.equal(ava.interest, ref.interest);
  assert.deepEqual([snow.months, snow.interest], [ava.months, ava.interest]);
  assert.equal(ava.payoffs[0].month, ava.months);
});

test("a payment that never covers the interest is caught, with the amount to add", () => {
  const card: DebtItem[] = [{ id: "c", name: "Card", balance: 10000, apr: 24, minimum: 150 }];
  // $200 a month of interest, $150 paid.
  assert.equal(paymentBelowInterest(card, 0), true);
  const plan = simulatePayoff(card, 0, "avalanche");
  assert.equal(plan.unfinished, true);
  assert.equal(plan.payoffs[0].month, null);
  const add = extraNeeded(card, 0);
  assert.ok(add > 50, "must at least cover the interest");
  assert.equal(simulatePayoff(card, add, "avalanche").unfinished, false, "adding that amount finishes");
  assert.equal(simulatePayoff(card, add - 1, "avalanche").unfinished, true, "one dollar less does not");
  assert.equal(extraNeeded(scenarioB, 150), 0);
  assert.equal(paymentBelowInterest(scenarioB, 150), false);
});

test("a zero minimum asks for at least the first month of interest, rounded up", () => {
  const card: DebtItem[] = [{ id: "c", name: "Card", balance: 5000, apr: 24, minimum: 0 }];
  const add = extraNeeded(card, 0);
  assert.ok(add >= 100.01);
  assert.equal(add, 101);
});

test("at 0% interest the months are the balance over the payment", () => {
  const debts: DebtItem[] = [{ id: "z", name: "Zero", balance: 1000, apr: 0, minimum: 100 }];
  const sim = simulatePayoff(debts, 0, "avalanche");
  assert.equal(sim.months, 10);
  assert.equal(sim.interest, 0);
  assert.equal(sim.paid, 1000);
  assert.equal(simulatePayoff(debts, 150, "avalanche").months, 4, "$250 a month: 250, 500, 750, then the last 250");
});

test("what-if rows change the extra payment and the result", () => {
  const rows = debtWhatIfs(scenarioB, 150);
  assert.deepEqual(
    rows.map((row) => row.label),
    ["No extra", "$50 less a month", "As entered", "$50 more a month", "$100 more a month"],
  );
  const base = rows.find((row) => row.label === "As entered");
  assert.ok(base);
  assert.deepEqual([base.months, base.interest], [47, 2337.61]);
  for (const row of rows) if (row !== base) assert.notEqual(row.interest, base.interest, row.label);
  assert.ok(!rows.some((row) => /return/i.test(row.label)), "no return rows on a debt page");
  assert.equal(debtWhatIfs(scenarioB, 0).some((row) => row.label === "$50 less a month"), false);
});

test("payoffPlan and the timeline use the same simulation", () => {
  assert.deepEqual(payoffPlan(scenarioB, 150, "avalanche"), { months: 47, interest: 2337.61, unfinished: false });
  const line = debtTimeline(scenarioB, 150);
  assert.equal(line.withExtra.at(-1)?.month, 47);
  assert.equal(line.withExtra.at(-1)?.remaining, 0);
  assert.equal(line.minimums.at(-1)?.month, 76);
  assert.equal(debtMatchesPayoff(scenarioB, 150), true);
});
