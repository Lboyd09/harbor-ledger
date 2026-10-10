import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldRemindBackup } from "./backup-reminder.ts";

test("backup reminder shows after 7 days, not before", () => {
  assert.equal(shouldRemindBackup({ signedIn: false, hasImport: true, lastDismiss: null, today: "2026-10-09" }), true);
  assert.equal(shouldRemindBackup({ signedIn: false, hasImport: true, lastDismiss: "2026-10-08", today: "2026-10-09" }), false);
  assert.equal(shouldRemindBackup({ signedIn: false, hasImport: true, lastDismiss: "2026-10-01", today: "2026-10-09" }), true);
  assert.equal(shouldRemindBackup({ signedIn: true, hasImport: true, lastDismiss: null, today: "2026-10-09" }), false);
});
