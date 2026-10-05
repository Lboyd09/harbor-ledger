import { normalizeSnapshot } from "./normalize.ts";
import type {
  Account,
  BalancePoint,
  BucketMove,
  Category,
  DebtItem,
  IraRules,
  LedgerSnapshot,
  MerchantRule,
  MoneyBucket,
  MonthBudget,
  NetWorthPoint,
  Profile,
  SavingsGoal,
  SetAside,
  Transaction,
} from "./types.ts";

/** 1 was the original file with no version field. 2 adds accounts and balances. */
export const BACKUP_VERSION = 2;

export type LedgerBackup = {
  version: number;
  profile: Profile;
  categories: Category[];
  transactions: Transaction[];
  merchantRules: MerchantRule[];
  monthBudgets: MonthBudget[];
  savingsGoals: SavingsGoal[];
  moneyBuckets: MoneyBucket[];
  bucketMoves: BucketMove[];
  netWorth: NetWorthPoint[];
  debts: DebtItem[];
  ira: IraRules;
  accounts: Account[];
  balances: BalancePoint[];
  setAsides: SetAside[];
};

export function ledgerBackup(snap: LedgerSnapshot): LedgerBackup {
  return {
    version: BACKUP_VERSION,
    profile: snap.profile,
    categories: snap.categories,
    transactions: snap.transactions,
    merchantRules: snap.merchantRules,
    monthBudgets: snap.monthBudgets ?? [],
    savingsGoals: snap.savingsGoals ?? [],
    moneyBuckets: snap.moneyBuckets ?? [],
    bucketMoves: snap.bucketMoves ?? [],
    netWorth: snap.netWorth ?? [],
    debts: snap.debts ?? [],
    ira: snap.ira,
    accounts: snap.accounts ?? [],
    balances: snap.balances ?? [],
    setAsides: snap.setAsides ?? [],
  };
}

export function parseBackup(raw: unknown): { ok: true; data: LedgerBackup } | { ok: false; error: string } {
  const snap = normalizeSnapshot(raw);
  if (!snap) return { ok: false, error: "Backup is not a valid ledger file." };
  if (!snap.categories.length) return { ok: false, error: "Backup has no categories." };
  return { ok: true, data: { ...ledgerBackup(snap), profile: { ...snap.profile, completedOnboarding: true } } };
}
