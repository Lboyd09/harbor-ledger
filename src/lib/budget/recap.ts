import { roundMoney } from "./money.ts";

export function monthRecap(input: {
  onPlan: number;
  categories: number;
  savingsRate: number | null;
  biggest: { name: string; delta: number } | null;
}): string {
  const rate = input.savingsRate == null ? "" : ` · Saved ${Math.round(input.savingsRate * 100)}%`;
  const change =
    input.biggest && Math.abs(input.biggest.delta) >= 1
      ? ` · Biggest change: ${input.biggest.name} ${input.biggest.delta > 0 ? "+" : "−"}$${Math.round(Math.abs(input.biggest.delta))}`
      : "";
  return `On plan in ${input.onPlan} of ${input.categories} categories${rate}${change}`;
}

export function importStreak(dates: string[], todayYm: string): number {
  const months = [...new Set(dates.map((d) => d.slice(0, 7)).filter((ym) => /^\d{4}-\d{2}$/.test(ym)))].sort();
  if (!months.length) return 0;
  let count = 0;
  let cursor = todayYm;
  while (months.includes(cursor)) {
    count += 1;
    const [y, m] = cursor.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    cursor = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }
  return count;
}

export function importIsStale(lastImport: string | null, today: string): boolean {
  if (!lastImport) return false;
  const a = Date.parse(`${lastImport.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return b - a > 30 * 86400000;
}

export function roundDelta(n: number): number {
  return roundMoney(n);
}
