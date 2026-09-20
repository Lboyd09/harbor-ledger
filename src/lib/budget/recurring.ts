import type { RecurringGroup, RecurringInterval, Transaction } from "./types.ts";

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a + "T00:00:00");
  const db = Date.parse(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

function classifyInterval(medianDays: number): RecurringInterval {
  if (medianDays >= 5 && medianDays <= 9) return "weekly";
  if (medianDays >= 12 && medianDays <= 17) return "biweekly";
  if (medianDays >= 26 && medianDays <= 36) return "monthly";
  return "irregular";
}

function groupsFor(
  transactions: Transaction[],
  direction: "in" | "out",
): RecurringGroup[] {
  const byKey = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.excluded || t.status === "transfer") continue;
    if (direction === "out" && t.amount >= 0) continue;
    if (direction === "in" && t.amount <= 0) continue;
    const list = byKey.get(t.merchantKey) ?? [];
    list.push(t);
    byKey.set(t.merchantKey, list);
  }

  const groups: RecurringGroup[] = [];
  for (const [merchantKey, list] of byKey) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const g = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (g > 0) gaps.push(g);
    }
    if (!gaps.length) continue;
    const med = median(gaps);
    const interval = classifyInterval(med);
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const avg = amounts.reduce((s, n) => s + n, 0) / amounts.length;
    const spread = Math.max(...amounts) - Math.min(...amounts);
    const similar = spread <= Math.max(8, avg * 0.35);
    if (!similar && interval === "irregular" && list.length < 3) continue;
    if (interval === "irregular" && list.length < 3) continue;

    const catCounts = new Map<string, number>();
    for (const t of sorted) {
      if (!t.categoryId) continue;
      catCounts.set(t.categoryId, (catCounts.get(t.categoryId) ?? 0) + 1);
    }
    let categoryId: string | null = null;
    let best = 0;
    for (const [id, n] of catCounts) {
      if (n > best) {
        best = n;
        categoryId = id;
      }
    }

    groups.push({
      merchantKey,
      interval,
      count: sorted.length,
      avgAmount: Math.round(avg * 100) / 100,
      lastDate: sorted[sorted.length - 1].date,
      firstDate: sorted[0].date,
      categoryId,
      sampleDescription: sorted[sorted.length - 1].description,
      direction,
    });
  }

  groups.sort((a, b) => b.count - a.count || b.avgAmount - a.avgAmount);
  return groups;
}

export function findRecurring(transactions: Transaction[]): RecurringGroup[] {
  return groupsFor(transactions, "out");
}

export function findRecurringAll(transactions: Transaction[]): RecurringGroup[] {
  return [...groupsFor(transactions, "in"), ...groupsFor(transactions, "out")];
}
