/**
 * Reading calculator boxes. A blank box is "not entered", never 0.
 * An explicit 0 that someone typed stays 0.
 */

/**
 * Optional money box, such as an extra payment or "already saved".
 * A blank box is 0 on purpose and marked assumed. An unreadable box is invalid.
 * A typed 0 stays 0 and is not assumed.
 */
export function optionalAmount(raw: string | number | null | undefined): { amount: number; assumed: boolean; invalid: boolean } {
  if (raw == null || (typeof raw === "string" && raw.trim() === "")) return { amount: 0, assumed: true, invalid: false };
  const amount = readNumber(raw);
  if (amount == null) return { amount: 0, assumed: false, invalid: true };
  return { amount, assumed: false, invalid: false };
}

/** Read a typed number. Blank or unreadable gives null. Accepts "$1,200", "6.5%", "-2". */
export function readNumber(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = raw.replace(/[$,%\s]/g, "");
  if (!s || !/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type Need = {
  /** Reads after "Enter", e.g. "the interest rate". */
  label: string;
  value: number | null;
  /** Lowest allowed value, inclusive. */
  min?: number;
  /** Value must be strictly above this. */
  above?: number;
};

/** The label of the first box that still needs a usable number. Null when everything is there. */
export function firstMissing(needs: Need[]): string | null {
  for (const need of needs) {
    const v = need.value;
    const bad = v == null || (need.above != null && !(v > need.above)) || (need.min != null && v < need.min);
    if (bad) return need.label;
  }
  return null;
}

/** The first missing box as one plain sentence, e.g. "Enter the interest rate to see payments." */
export function needsPrompt(needs: Need[], goal: string): string | null {
  const label = firstMissing(needs);
  return label == null ? null : `Enter ${label} to see ${goal}.`;
}

export type LoanFields = { balance: string; apr: string; years: string; extra: string };
export type LoanRead =
  | { ok: true; balance: number; apr: number; years: number; extra: number }
  | { ok: false; prompt: string };

/** Loan boxes. The rate is required (0 typed on purpose is fine). A blank extra means no extra. */
export function readLoan(fields: LoanFields): LoanRead {
  const balance = readNumber(fields.balance);
  const apr = readNumber(fields.apr);
  const years = readNumber(fields.years);
  const extra = fields.extra.trim() ? readNumber(fields.extra) : 0;
  const prompt = needsPrompt(
    [
      { label: "the loan balance", value: balance, above: 0 },
      { label: "the interest rate", value: apr, min: 0 },
      { label: "how many years the loan lasts", value: years, above: 0 },
      { label: "an extra payment of 0 or more", value: extra, min: 0 },
    ],
    "payments",
  );
  if (prompt || balance == null || apr == null || years == null || extra == null) return { ok: false, prompt: prompt ?? "" };
  return { ok: true, balance, apr, years, extra };
}

/**
 * One clean helper line for a pre-filled box: where the number came from, then the note.
 * "typed" and "default" are not shown; they only produced text like "Not entered yet. typed."
 */
export function factNote(fact: { note: string; source: string }): string {
  const parts: string[] = [];
  const source = fact.source.trim();
  if (source && source !== "typed" && source !== "default") parts.push(sentence(source));
  if (fact.note.trim()) parts.push(sentence(fact.note));
  return parts.join(" ");
}

function sentence(text: string): string {
  const t = text.trim();
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}
