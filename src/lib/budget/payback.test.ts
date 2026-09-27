import assert from "node:assert/strict";
import { test } from "node:test";
import { closestAmount, paybackNote, paybackNotes, paybackPartnerId } from "./payback.ts";
import type { Transaction } from "./types.ts";

function tx(id: string, date: string, amount: number): Transaction {
  return {
    id,
    date,
    description: id,
    merchantKey: id,
    amount,
    sourceLabel: "t",
    fingerprint: id,
    categoryId: null,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
  };
}

test("payback notes keep the pair id and an optional label", () => {
  assert.equal(paybackPartnerId(paybackNotes("dep1", "rent split")), "dep1");
  assert.equal(paybackNote(paybackNotes("dep1", "rent split")), "rent split");
  assert.equal(paybackPartnerId(paybackNotes(null, "only this")), "");
  assert.equal(paybackNote("payback"), "");
});

test("closest amount prefers the nearest dollar, then the nearer date", () => {
  const rows = [tx("a", "2026-09-01", 40), tx("b", "2026-09-20", 42), tx("c", "2026-09-18", 100)];
  assert.equal(closestAmount(42.18, rows, "2026-09-04")?.id, "b");
  assert.equal(closestAmount(99, rows, "2026-09-04")?.id, "c");
});
