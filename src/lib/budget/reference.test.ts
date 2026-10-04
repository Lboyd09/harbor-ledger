import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_IRA } from "./ira.ts";
import { MARKET_RATES, SAVINGS_RATES } from "./grow-math.ts";
import { DEFAULT_INFLATION, DEFAULT_WITHDRAWAL, FIGURES, figuresNeedingCheck, IRA_LIMITS } from "./reference.ts";

test("every reference figure has a value, a date, a source, and a status", () => {
  assert.ok(FIGURES.length >= 16);
  for (const figure of FIGURES) {
    assert.equal(typeof figure.id, "string");
    assert.ok(figure.name.length > 0);
    assert.equal(typeof figure.value, "number");
    assert.ok(Number.isFinite(figure.value));
    assert.match(figure.asOf, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(figure.source.length > 0);
    assert.ok(figure.status === "checked" || figure.status === "needs checking");
  }
});

test("IRA figures stay the 2026 IRS amounts", () => {
  assert.deepEqual(IRA_LIMITS, {
    year: 2026,
    under50: 7500,
    catchUp: 1100,
    rothSingleStart: 153000,
    rothSingleEnd: 168000,
    rothJointStart: 242000,
    rothJointEnd: 252000,
  });
  assert.equal(DEFAULT_IRA.year, 2026);
  assert.equal(DEFAULT_IRA.under50, 7500);
  assert.equal(DEFAULT_IRA.catchUp, 1100);
  assert.equal(DEFAULT_IRA.rothSingleStart, 153000);
  assert.equal(DEFAULT_IRA.rothSingleEnd, 168000);
  assert.equal(DEFAULT_IRA.rothJointStart, 242000);
  assert.equal(DEFAULT_IRA.rothJointEnd, 252000);
  assert.equal(FIGURES.find((row) => row.id === "401k-deferral")?.value, 24500);
  assert.equal(FIGURES.find((row) => row.id === "401k-catch-up")?.value, 8000);
  assert.equal(FIGURES.find((row) => row.id === "401k-catch-up-60")?.value, 11250);
});

test("return ranges need checking and match the calculators", () => {
  const needing = figuresNeedingCheck();
  assert.ok(needing.length >= 6);
  assert.ok(needing.every((row) => row.id.startsWith("savings-") || row.id.startsWith("market-")));
  assert.equal(FIGURES.find((row) => row.id === "market-expected")?.value, MARKET_RATES.expected);
  assert.equal(FIGURES.find((row) => row.id === "savings-conservative")?.value, SAVINGS_RATES.conservative);
  assert.equal(DEFAULT_INFLATION, 0.02);
  assert.equal(DEFAULT_WITHDRAWAL, 0.04);
  assert.equal(FIGURES.find((row) => row.id === "inflation")?.status, "checked");
  assert.equal(FIGURES.find((row) => row.id === "withdrawal")?.status, "checked");
});
