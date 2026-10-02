import assert from "node:assert/strict";
import { test } from "node:test";
import { matchKeywordSlug } from "./keywords.ts";

test("specific merchants beat shorter words", () => {
  assert.equal(matchKeywordSlug("Zelle payment to LAKESIDE PROPERTY MGMT"), "housing");
  assert.equal(matchKeywordSlug("VALLEY METRO LIGHT RAIL"), "transport");
  assert.equal(matchKeywordSlug("APS ELECTRIC PAYMENT"), "utilities");
  assert.equal(matchKeywordSlug("UBER EATS"), "dining");
  assert.equal(matchKeywordSlug("UBER TRIP"), "transport");
  assert.equal(matchKeywordSlug("DISNEY STORE"), "personal");
  assert.equal(matchKeywordSlug("DISNEY PLUS"), "subscriptions");
});
