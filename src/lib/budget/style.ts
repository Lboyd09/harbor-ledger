import { currentMonthKey } from "./parse-date.ts";
import type { BudgetStyle, LedgerSnapshot, Profile } from "./types.ts";

function monthOrNull(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : null;
}

/** Sets the app-wide style. Carry-over's start month is kept when switching back. */
export function withBudgetStyle(
  profile: Profile,
  style: BudgetStyle,
  options?: { carryStartMonth?: string; today?: string },
): Profile {
  if (style === "monthly") return { ...profile, budgetStyle: "monthly" };
  const today = monthOrNull(options?.today) ?? currentMonthKey();
  const carryStartMonth = monthOrNull(options?.carryStartMonth) ?? monthOrNull(profile.carryStartMonth) ?? today;
  return { ...profile, budgetStyle: "buckets", carryStartMonth };
}

/** What setBudgetStyle writes: the profile changes, and nothing else does. */
export function setBudgetStyleState<T extends { profile: Profile }>(
  state: T,
  style: BudgetStyle,
  options?: { carryStartMonth?: string; today?: string },
): T {
  return { ...state, profile: withBudgetStyle(state.profile, style, options) };
}

export function applyBudgetStyle(
  snapshot: LedgerSnapshot,
  style: BudgetStyle,
  options?: { carryStartMonth?: string; today?: string },
): LedgerSnapshot {
  return setBudgetStyleState(snapshot, style, options);
}
