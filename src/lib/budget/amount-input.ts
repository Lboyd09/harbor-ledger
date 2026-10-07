import { roundMoney } from "./money.ts";

/**
 * Read what someone typed into an amount box. Accepts "500", "$1,250.50", " 12. ".
 * Returns null for anything that is not a usable amount: empty, letters, or below zero.
 * A blank box never becomes 0 here; the caller decides what blank means.
 */
export function parseAmountInput(raw: string): number | null {
  const s = String(raw ?? "").replace(/[$,\s]/g, "");
  if (!s || !/^\d*\.?\d*$/.test(s) || s === ".") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney(n);
}

/**
 * What to save when the "Usual amount" box is committed (blur or Enter).
 * Returns the amount to store, or null when nothing should change:
 * a cleared or unreadable box keeps the amount that was there.
 * Typing an explicit 0 still saves 0.
 */
export function usualAmountCommit(raw: string, current: number): number | null {
  const next = parseAmountInput(raw);
  if (next == null) return null;
  if (Math.abs(next - (current || 0)) < 0.005) return null;
  return next;
}

export type MonthAmountCommit = { action: "keep" } | { action: "clear" } | { action: "set"; amount: number };

/**
 * What to save when the "This month only" box is committed.
 * Blank means "same as usual", so it removes this month's own amount.
 * An unreadable value keeps what was there.
 */
export function monthAmountCommit(raw: string, current: number | null): MonthAmountCommit {
  if (!String(raw ?? "").trim()) return current == null ? { action: "keep" } : { action: "clear" };
  const next = parseAmountInput(raw);
  if (next == null) return { action: "keep" };
  if (current != null && Math.abs(next - current) < 0.005) return { action: "keep" };
  return { action: "set", amount: next };
}

/** How a stored amount shows in an editable box: blank for 0, no trailing zeros. */
export function amountDraft(value: number | null | undefined): string {
  return value ? String(roundMoney(value)) : "";
}
