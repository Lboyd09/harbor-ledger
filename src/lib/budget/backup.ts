import { normalizeSnapshot } from "./normalize.ts";
import type { Category, MerchantRule, MonthBudget, Profile, SavingsGoal, Transaction } from "./types.ts";

export type LedgerBackup = {
  profile: Profile;
  categories: Category[];
  transactions: Transaction[];
  merchantRules: MerchantRule[];
  monthBudgets: MonthBudget[];
  savingsGoals: SavingsGoal[];
};

export function parseBackup(raw: unknown): { ok: true; data: LedgerBackup } | { ok: false; error: string } {
  const snap = normalizeSnapshot(raw);
  if (!snap) return { ok: false, error: "Backup is not a valid ledger file." };
  if (!snap.categories.length) return { ok: false, error: "Backup has no categories." };
  return {
    ok: true,
    data: {
      profile: { ...snap.profile, completedOnboarding: true },
      categories: snap.categories,
      transactions: snap.transactions,
      merchantRules: snap.merchantRules,
      monthBudgets: snap.monthBudgets,
      savingsGoals: snap.savingsGoals ?? [],
    },
  };
}
