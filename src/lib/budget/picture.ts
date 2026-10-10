import { isLoanKind, latestBalance } from "./accounts.ts";
import { bucketBalance } from "./buckets.ts";
import { roundMoney } from "./money.ts";
import { debtsInNetWorth } from "./real-debts.ts";
import type { Account, BalancePoint, BucketMove, Category, DebtItem, MoneyBucket, Transaction } from "./types.ts";

/** A cushion of three to six months of bills is the usual range. */
export const CUSHION_GOAL = { low: 3, high: 6 };

export type MoneyPicture = {
  /** Checking, savings, and cash in hand. */
  cash: number;
  brokerage: number;
  retirement: number;
  /** Card balances, as a positive amount owed. */
  cards: number;
  /** Loans typed on Plan or stored as debts, as a positive amount owed. */
  loans: number;
  debts: number;
  /** Accounts minus every loan. Cards are already negative on the account. */
  net: number;
  /** Savings, cash in hand, and an emergency or cushion fund. Checking stays out. */
  cushionCash: number;
  bills: number | null;
  cushionMonths: number | null;
};

function emergencyFund(name: string): boolean {
  return /emergency|cushion|rainy/i.test(name);
}

/**
 * One picture of cash, investments, debts, and months of cushion.
 * Every screen that quotes these numbers should call this.
 */
export function moneyPicture(input: {
  accounts: Account[];
  balances: BalancePoint[];
  debts?: DebtItem[];
  funds?: MoneyBucket[];
  transactions?: Transaction[];
  categories?: Category[];
  moves?: BucketMove[];
  ym?: string;
  /** Planned monthly bills. Null when there is no plan to divide by. */
  bills?: number | null;
}): MoneyPicture {
  let cash = 0;
  let brokerage = 0;
  let retirement = 0;
  let cards = 0;
  let loanAccounts = 0;
  for (const account of input.accounts) {
    const amount = latestBalance(account.id, input.balances)?.amount ?? 0;
    if (account.kind === "checking" || account.kind === "savings" || account.kind === "cash") cash += amount;
    if (account.kind === "investment") brokerage += Math.max(0, amount);
    if (account.kind === "retirement") retirement += Math.max(0, amount);
    if (account.kind === "credit") cards += Math.max(0, -amount);
    if (isLoanKind(account.kind) || (account.kind === "other" && amount < 0)) loanAccounts += Math.abs(amount);
  }
  const moneyLoans = debtsInNetWorth(input.debts ?? [], input.accounts, input.balances).reduce(
    (sum, debt) => sum + Math.max(0, debt.balance),
    0,
  );
  const loans = loanAccounts + moneyLoans;
  let cushionCash = 0;
  for (const account of input.accounts) {
    if (account.kind !== "savings" && account.kind !== "cash") continue;
    cushionCash += Math.max(0, latestBalance(account.id, input.balances)?.amount ?? 0);
  }
  const ym = input.ym;
  if (ym && input.transactions && input.categories) {
    for (const fund of input.funds ?? []) {
      if (!emergencyFund(fund.name)) continue;
      cushionCash += Math.max(0, bucketBalance(fund, ym, input.transactions, input.categories, input.moves ?? []));
    }
  }
  const bills = input.bills != null && input.bills > 0 ? input.bills : null;
  const cushionMonths = bills != null ? roundMoney(cushionCash / bills) : null;
  return {
    cash: roundMoney(cash),
    brokerage: roundMoney(brokerage),
    retirement: roundMoney(retirement),
    cards: roundMoney(cards),
    loans: roundMoney(loans),
    debts: roundMoney(cards + loans),
    net: roundMoney(cash + brokerage + retirement - (cards + loans)),
    cushionCash: roundMoney(cushionCash),
    bills: bills == null ? null : roundMoney(bills),
    cushionMonths,
  };
}
