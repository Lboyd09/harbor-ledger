import assert from "node:assert/strict";
import { test } from "node:test";
import { importIsStale, importStreak, monthRecap } from "./recap.ts";

test("recap and streak on the fixture", () => {
  assert.match(monthRecap({ onPlan: 7, categories: 9, savingsRate: 0.07, biggest: { name: "Eating out", delta: -80 } }), /On plan in 7 of 9/);
  assert.equal(importStreak(["2026-08-01", "2026-09-04", "2026-10-02"], "2026-10"), 3);
  assert.equal(importIsStale("2026-08-01", "2026-10-09"), true);
  assert.equal(importIsStale("2026-10-01", "2026-10-09"), false);
});
