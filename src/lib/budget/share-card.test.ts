import assert from "node:assert/strict";
import { test } from "node:test";
import { shareCardText } from "./share-card.ts";

test("share text has no dollar amounts when amounts are off", () => {
  const text = shareCardText("debt-free", false);
  assert.doesNotMatch(text, /\$/);
  assert.doesNotMatch(text, /\d{1,3},\d{3}/);
  assert.match(text, /Made with BudgetFlow/);
});
