import { isLoanKind, latestBalance } from "./accounts.ts";
import type { Account, BalancePoint, DebtItem } from "./types.ts";

function owed(account: Account, balances: BalancePoint[]): number {
  const amount = latestBalance(account.id, balances)?.amount ?? 0;
  if (account.kind === "credit") return Math.max(0, -amount);
  if (isLoanKind(account.kind) || (account.kind === "other" && amount < 0)) return Math.abs(amount);
  return 0;
}

function matchesCard(debt: DebtItem, accounts: Account[], balances: BalancePoint[]): boolean {
  const name = debt.name.trim().toLowerCase();
  return accounts.some((account) => {
    if (account.kind !== "credit") return false;
    const cardOwed = owed(account, balances);
    if (cardOwed <= 0) return false;
    if (account.name.trim().toLowerCase() === name) return true;
    return Math.abs(debt.balance - cardOwed) <= 1;
  });
}

/** Money loans and loan accounts. Calculator copies and card duplicates stay out. */
export function debtsInNetWorth(debts: DebtItem[], accounts: Account[], balances: BalancePoint[]): DebtItem[] {
  return debts.filter((debt) => {
    if (debt.origin === "plan") return false;
    // A loan added on Money always counts, even when the balance matches a card.
    // Only a stored row with no origin is a calculator copy when it matches a card.
    if (debt.origin !== "money" && matchesCard(debt, accounts, balances)) return false;
    return true;
  });
}

/** Rows the debt calculator starts from. Edits stay on the copy. */
export function calculatorDebts(accounts: Account[], balances: BalancePoint[], debts: DebtItem[]): DebtItem[] {
  const rows: DebtItem[] = [];
  const moneyDebts = debtsInNetWorth(debts, accounts, balances);
  for (const account of accounts) {
    const balance = owed(account, balances);
    const isCard = account.kind === "credit" && balance > 0;
    const isLoan = isLoanKind(account.kind) && balance > 0;
    if (!isCard && !isLoan) continue;
    // Prefer a matching saved debt for the real rate and minimum. Never default to 0%.
    const match = moneyDebts.find((debt) => debt.name.trim().toLowerCase() === account.name.trim().toLowerCase());
    // Missing rate is -1 (sentinel). A typed 0 stays 0 and is calculated. Never treat missing as 0%.
    const apr = match?.apr ?? -1;
    const minimum = match?.minimum ?? 0;
    rows.push({ id: `plan_${account.id}`, name: account.name, balance, apr, minimum, origin: "plan" });
  }
  for (const debt of moneyDebts) {
    // Avoid duplicating a debt we already pulled from an account.
    if (rows.some((row) => row.name.trim().toLowerCase() === debt.name.trim().toLowerCase())) continue;
    rows.push({ ...debt, origin: "money" });
  }
  return rows;
}
