import { countsInCashflow } from "./totals.ts";
import type { Transaction } from "./types.ts";

export type PayeeGroup = {
  merchantKey: string;
  sample: string;
  count: number;
  totalOut: number;
  totalIn: number;
  returned: number;
  categoryId: string | null;
  mixed: boolean;
  lastDate: string;
  firstDate: string;
  unassigned: number;
  likelyBill: boolean;
};

export function groupPayees(transactions: Transaction[]): PayeeGroup[] {
  const map = new Map<string, PayeeGroup & { cats: Map<string, number> }>();
  for (const t of transactions) {
    if (t.excluded) continue;
    const cur = map.get(t.merchantKey) ?? {
      merchantKey: t.merchantKey,
      sample: t.description,
      count: 0,
      totalOut: 0,
      totalIn: 0,
      returned: 0,
      categoryId: null,
      mixed: false,
      lastDate: t.date,
      firstDate: t.date,
      unassigned: 0,
      likelyBill: false,
      cats: new Map<string, number>(),
    };
    cur.count += 1;
    if (t.status === "refund") {
      cur.returned += Math.abs(t.amount);
    } else if (countsInCashflow(t)) {
      if (t.amount < 0) cur.totalOut += -t.amount;
      else cur.totalIn += t.amount;
    }
    if (!t.categoryId) cur.unassigned += 1;
    else cur.cats.set(t.categoryId, (cur.cats.get(t.categoryId) ?? 0) + 1);
    if (t.date > cur.lastDate) {
      cur.lastDate = t.date;
      cur.sample = t.description;
    }
    if (t.date < cur.firstDate) cur.firstDate = t.date;
    map.set(t.merchantKey, cur);
  }

  return [...map.values()]
    .map((g) => {
      const ranked = [...g.cats.entries()].sort((a, b) => b[1] - a[1]);
      const categoryId = ranked[0]?.[0] ?? null;
      return {
        merchantKey: g.merchantKey,
        sample: g.sample,
        count: g.count,
        totalOut: g.totalOut,
        totalIn: g.totalIn,
        returned: g.returned,
        categoryId,
        mixed: ranked.length > 1,
        lastDate: g.lastDate,
        firstDate: g.firstDate,
        unassigned: g.unassigned,
        likelyBill: g.count >= 3,
      };
    })
    .sort((a, b) => b.count - a.count || b.totalOut + b.totalIn - (a.totalOut + a.totalIn));
}
