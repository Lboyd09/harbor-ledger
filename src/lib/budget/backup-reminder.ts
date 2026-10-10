export function shouldRemindBackup(input: { signedIn: boolean; hasImport: boolean; lastDismiss: string | null; today: string }): boolean {
  if (input.signedIn || !input.hasImport) return false;
  if (!input.lastDismiss) return true;
  const a = Date.parse(`${input.lastDismiss.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${input.today.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return b - a >= 7 * 86400000;
}
