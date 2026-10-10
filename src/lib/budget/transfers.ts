import { roundMoney } from "./money.ts";
import type { Transaction } from "./types.ts";

const HINT = /transfer|savings|xfer|move to|moved to/i;

function day(iso: string): string {
  return iso.slice(0, 10);
}

function daysApart(a: string, b: string): number {
  const am = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  const bm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (!am || !bm) return 99;
  const ad = Date.UTC(Number(am[1]), Number(am[2]) - 1, Number(am[3]));
  const bd = Date.UTC(Number(bm[1]), Number(bm[2]) - 1, Number(bm[3]));
  return Math.abs(Math.round((bd - ad) / 86400000));
}

export type TransferPair = { outId: string; inId: string };

/** Pair equal-and-opposite rows across accounts within 3 days. */
export function pairTransfers(rows: Transaction[]): TransferPair[] {
  const live = rows.filter((row) => !row.excluded && row.accountId);
  const used = new Set<string>();
  const pairs: TransferPair[] = [];
  const outs = live.filter((row) => row.amount < 0);
  const ins = live.filter((row) => row.amount > 0);
  for (const out of outs) {
    if (used.has(out.id)) continue;
    const match = ins.find((row) => {
      if (used.has(row.id) || row.accountId === out.accountId) return false;
      if (roundMoney(row.amount + out.amount) !== 0) return false;
      if (daysApart(day(out.date), day(row.date)) > 3) return false;
      const text = `${out.description} ${row.description}`.toLowerCase();
      const names = [out, row].map((item) => item.description);
      return HINT.test(text) || names.some((name) => HINT.test(name));
    });
    if (!match) continue;
    used.add(out.id);
    used.add(match.id);
    pairs.push({ outId: out.id, inId: match.id });
  }
  return pairs;
}

export function isPairedTransfer(id: string, pairs: TransferPair[]): boolean {
  return pairs.some((pair) => pair.outId === id || pair.inId === id);
}

export function spendingWithoutTransfers(rows: Transaction[]): number {
  const pairs = pairTransfers(rows);
  return roundMoney(
    rows
      .filter((row) => !row.excluded && row.amount < 0 && !isPairedTransfer(row.id, pairs))
      .reduce((sum, row) => sum + row.amount, 0),
  );
}
