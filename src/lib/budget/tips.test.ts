import assert from "node:assert/strict";
import { test } from "node:test";
import { TIPS, tipWordCount, tipsFor } from "./tips.ts";

test("every tip is short, sourced, and free of product promises", () => {
  assert.ok(TIPS.length >= 30);
  for (const tip of TIPS) {
    assert.ok(tipWordCount(tip) <= 25, tip.id);
    assert.ok(tip.source);
    assert.ok(tip.status === "general guidance" || tip.status === "needs checking");
    assert.doesNotMatch(tip.text, /Vanguard|Fidelity|guaranteed|will return/i);
  }
});

test("tipsFor returns at most three and prefers the person's facts", () => {
  const plain = tipsFor("cushion", {});
  assert.ok(plain.length <= 3);
  assert.ok(plain.length >= 1);
  const thin = tipsFor("cushion", { cushionMonths: 1 });
  assert.ok(thin.some((tip) => tip.id === "cushion-cash"));
  const rich = tipsFor("cushion", { cushionMonths: 8 });
  assert.ok(!rich.some((tip) => tip.id === "cushion-cash"));
  const gap = tipsFor("monthly", { savingsRate: 0.05, savingsWanted: 0.2 });
  assert.equal(gap[0]?.id, "rate-gap");
  const matched = tipsFor("retirement", { employerMatch: null });
  assert.equal(matched[0]?.id, "match-first");
});
