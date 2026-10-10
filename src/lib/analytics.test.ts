import assert from "node:assert/strict";
import { test } from "node:test";
import { track } from "./analytics.ts";

test("track drops amounts, names, and free text", () => {
  const kept = track("import_done", { ok: true, amount: 1200, merchant: "COSTCO", source: "csv" });
  assert.deepEqual(kept, { ok: true, source: "csv" });
});
