import assert from "node:assert/strict";
import { test } from "node:test";
import { checklistOpen, startedChecklist } from "./checklist.ts";

test("an empty budget shows five open items", () => {
  const items = startedChecklist({ hasImport: false, unsorted: 0, hasPlan: false, hasBalance: false, hasGoal: false });
  assert.equal(items.length, 5);
  assert.ok(items.every((item) => !item.done));
  assert.equal(checklistOpen(items, false), true);
  assert.equal(checklistOpen(items, true), false);
});

test("the fixture with a file, plan, balance, and goal is complete", () => {
  const items = startedChecklist({ hasImport: true, unsorted: 0, hasPlan: true, hasBalance: true, hasGoal: true });
  assert.ok(items.every((item) => item.done));
  assert.equal(checklistOpen(items, false), false);
});
