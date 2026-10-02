import { roundMoney } from "./money.ts";
import type { TxSplit } from "./types.ts";

/** Positive pieces of one row that add up to its amount. Null when the row is a single category. */
export function piecesOf(t: { amount: number; status?: string; splits?: TxSplit[] | null }): TxSplit[] | null {
  if (t.status && t.status !== "posted") return null;
  const raw = t.splits;
  if (!raw || raw.length < 2) return null;
  const parts = raw
    .filter((p) => p.categoryId && Number.isFinite(p.amount) && p.amount > 0)
    .map((p) => ({ categoryId: p.categoryId, amount: roundMoney(Math.abs(p.amount)) }));
  if (parts.length < 2) return null;
  const sum = roundMoney(parts.reduce((s, p) => s + p.amount, 0));
  if (Math.abs(sum - Math.abs(t.amount)) > 0.05) return null;
  return parts;
}
