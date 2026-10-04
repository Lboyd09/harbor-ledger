import { monthShort, shiftMonth } from "./parse-date.ts";
import { roundMoney } from "./money.ts";

export type SlicePart = { label: string; value: number; id?: string };

/**
 * Keep the `n` largest slices and fold the rest into one slice named "Everything else".
 * The sum of the result equals the sum of the input, including zeros that were dropped only when they are not in the top n and not needed.
 */
export function topSlices(parts: SlicePart[], n: number): SlicePart[] {
  const clean = parts.map((part) => ({
    label: part.label,
    value: roundMoney(part.value),
    id: part.id,
  }));
  const limit = Math.max(0, Math.floor(n));
  if (clean.length <= limit) return clean;
  const ranked = clean
    .map((part, index) => ({ part, index }))
    .sort((a, b) => b.part.value - a.part.value || a.index - b.index);
  const kept = ranked.slice(0, limit).sort((a, b) => a.index - b.index).map((row) => row.part);
  const rest = ranked.slice(limit).reduce((sum, row) => sum + row.part.value, 0);
  if (Math.abs(rest) <= 0.004) return kept;
  return [...kept, { label: "Everything else", value: roundMoney(rest) }];
}

export type MonthPoint = { ym: string; label: string; a: number; b: number };

/** Twelve months ending at `endYm`. Months with no row are zero. */
export function monthSeries(endYm: string, rows: { ym: string; a?: number; b?: number }[] = []): MonthPoint[] {
  const end = /^\d{4}-\d{2}$/.test(endYm) ? endYm : "2000-01";
  const byYm = new Map(rows.map((row) => [row.ym, row]));
  const points: MonthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const ym = shiftMonth(end, -i);
    const row = byYm.get(ym);
    points.push({
      ym,
      label: monthShort(ym),
      a: roundMoney(row?.a ?? 0),
      b: roundMoney(row?.b ?? 0),
    });
  }
  return points;
}
