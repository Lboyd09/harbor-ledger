import assert from "node:assert/strict";
import { test } from "node:test";
import { pairTransfers, spendingWithoutTransfers } from "./transfers.ts";
import type { Transaction } from "./types.ts";

function tx(id: string, date: string, description: string, amount: number, accountId: string): Transaction {
  return {
    id,
    date,
    description,
    merchantKey: description,
    amount,
    sourceLabel: "Bank",
    fingerprint: id,
    categoryId: null,
    userSet: false,
    notes: "",
    excluded: false,
    status: "posted",
    accountId,
  };
}

test("a -$300 checking row and a +$300 savings row on adjacent days pair up", () => {
  const rows = [
    tx("out", "2026-10-04", "Transfer to HY Savings", -300, "chk"),
    tx("in", "2026-10-05", "Transfer from Checking", 300, "sav"),
    tx("food", "2026-10-05", "GROCERY", -40, "chk"),
  ];
  const pairs = pairTransfers(rows);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]?.outId, "out");
  assert.equal(pairs[0]?.inId, "in");
  assert.equal(spendingWithoutTransfers(rows), -40);
});
