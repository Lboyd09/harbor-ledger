import type { Transaction } from "./types.ts";

/** Incoming money that often is a parent / roommate paying you back. */
export function looksLikePayback(t: Transaction): boolean {
  if (t.amount <= 0) return false;
  if (t.excluded) return false;
  const hay = ` ${t.description.toUpperCase()} `;
  return (
    hay.includes("ZELLE") ||
    hay.includes("VENMO") ||
    hay.includes("CASH APP") ||
    hay.includes("PAYPAL") ||
    hay.includes("APPLE CASH") ||
    /FROM /.test(hay)
  );
}

export function daysBetween(a: string, b: string): number {
  const ms = Math.abs(Date.parse(a) - Date.parse(b));
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : 999;
}

/** Find later incoming deposits that could cancel this purchase. */
export function findPaybackCandidates(purchase: Transaction, all: Transaction[]): Transaction[] {
  if (purchase.amount >= 0) return [];
  const need = Math.abs(purchase.amount);
  return all
    .filter((t) => t.id !== purchase.id)
    .filter((t) => t.amount > 0 && !t.excluded)
    .filter((t) => t.status !== "transfer")
    .filter((t) => daysBetween(t.date, purchase.date) <= 45)
    .filter((t) => {
      const diff = Math.abs(t.amount - need);
      return diff <= Math.max(1, need * 0.15);
    })
    .sort((a, b) => daysBetween(a.date, purchase.date) - daysBetween(b.date, purchase.date));
}

export function paybackHint(purchase: Transaction, candidate: Transaction): string {
  const days = daysBetween(purchase.date, candidate.date);
  return `${candidate.description.slice(0, 42)} · ${days === 0 ? "same day" : `${days}d later`}`;
}
