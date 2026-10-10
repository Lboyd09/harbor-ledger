import { IRA_LIMITS } from "./reference.ts";
import type { IraRules } from "./types.ts";

/**
 * 2026 figures from IRS Notice 2025-67, published November 2025.
 * The person can edit every number. The projection functions only read this object.
 * The amounts live in reference.ts so every screen cites the same source.
 */
export const DEFAULT_IRA: IraRules = {
  year: IRA_LIMITS.year,
  under50: IRA_LIMITS.under50,
  catchUp: IRA_LIMITS.catchUp,
  rothSingleStart: IRA_LIMITS.rothSingleStart,
  rothSingleEnd: IRA_LIMITS.rothSingleEnd,
  rothJointStart: IRA_LIMITS.rothJointStart,
  rothJointEnd: IRA_LIMITS.rothJointEnd,
  note: "Check the current IRS figures before you rely on these. BudgetFlow does not update them for you.",
};

function num(v: unknown, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function normalizeIra(raw: unknown): IraRules {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    year: Math.round(num(p.year, DEFAULT_IRA.year)),
    under50: Math.max(0, num(p.under50, DEFAULT_IRA.under50)),
    catchUp: Math.max(0, num(p.catchUp, DEFAULT_IRA.catchUp)),
    rothSingleStart: Math.max(0, num(p.rothSingleStart, DEFAULT_IRA.rothSingleStart)),
    rothSingleEnd: Math.max(0, num(p.rothSingleEnd, DEFAULT_IRA.rothSingleEnd)),
    rothJointStart: Math.max(0, num(p.rothJointStart, DEFAULT_IRA.rothJointStart)),
    rothJointEnd: Math.max(0, num(p.rothJointEnd, DEFAULT_IRA.rothJointEnd)),
    note: typeof p.note === "string" && p.note.trim() ? p.note : DEFAULT_IRA.note,
  };
}

export function iraLimit(rules: IraRules, age50: boolean) {
  return rules.under50 + (age50 ? rules.catchUp : 0);
}

/** Full, partial, or none. Joint uses the joint band; anything else uses the single band. */
export function rothRoom(rules: IraRules, magi: number, joint: boolean): "full" | "partial" | "none" {
  const start = joint ? rules.rothJointStart : rules.rothSingleStart;
  const end = joint ? rules.rothJointEnd : rules.rothSingleEnd;
  if (magi < start) return "full";
  if (magi >= end) return "none";
  return "partial";
}

/**
 * Reduced Roth limit in the phase-out (IRS Pub 590-A):
 * round the remaining amount up to the next $10, then raise a positive result under $200 to $200.
 */
export function reducedRothLimit(rules: IraRules, magi: number, joint: boolean, limit: number): number {
  const room = rothRoom(rules, magi, joint);
  if (room === "none" || !(limit > 0)) return 0;
  if (room === "full") return limit;
  const start = joint ? rules.rothJointStart : rules.rothSingleStart;
  const end = joint ? rules.rothJointEnd : rules.rothSingleEnd;
  const span = end - start;
  if (!(span > 0)) return 0;
  const raw = limit - (limit * (magi - start)) / span;
  if (!(raw > 0)) return 0;
  const rounded = Math.ceil((raw - 1e-9) / 10) * 10;
  if (rounded > 0 && rounded < 200) return Math.min(limit, 200);
  return Math.min(limit, rounded);
}
