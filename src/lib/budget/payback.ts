import type { Transaction } from "./types.ts";

export function daysBetween(a: string, b: string): number {
  const ms = Math.abs(Date.parse(a) - Date.parse(b));
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : 999;
}

/** Id of the other row in a payback pair. Notes look like `payback:<id>|optional label`. */
export function paybackPartnerId(notes: string): string {
  if (!notes.startsWith("payback:")) return "";
  const id = notes.slice("payback:".length).split("|")[0] ?? "";
  return id && id !== "payback" ? id : "";
}

export function paybackNote(notes: string): string {
  const i = notes.indexOf("|");
  return i >= 0 ? notes.slice(i + 1) : "";
}

export function paybackNotes(otherId: string | null, label: string): string {
  const clean = label.trim().replace(/\|/g, " ").slice(0, 80);
  const head = otherId ? `payback:${otherId}` : "payback";
  return clean ? `${head}|${clean}` : head;
}

/** Closest row by dollar amount, then by date. */
export function closestAmount(need: number, rows: Transaction[], nearDate: string): Transaction | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const da = Math.abs(Math.abs(a.amount) - need);
    const db = Math.abs(Math.abs(b.amount) - need);
    if (Math.abs(da - db) > 0.009) return da - db;
    return daysBetween(a.date, nearDate) - daysBetween(b.date, nearDate);
  })[0];
}
