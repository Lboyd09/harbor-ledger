import type { Account, BalancePoint, Category, DebtItem, Profile, Transaction } from "../types.ts";
import { DEFAULT_PROFILE } from "../presets.ts";

/** Alex: one household used by Today, Budget, Money, and the calculators. */
export function alexHousehold(): {
  profile: Profile;
  categories: Category[];
  accounts: Account[];
  balances: BalancePoint[];
  debts: DebtItem[];
  transactions: Transaction[];
} {
  const profile: Profile = { ...DEFAULT_PROFILE, monthlyIncome: 4200, birthYear: 1991, completedOnboarding: true };
  const categories: Category[] = [
    { id: "pay", slug: "paycheck", name: "Pay", kind: "income", plannedMonthly: 4200 },
    { id: "rent", slug: "housing", name: "Rent", kind: "expense", plannedMonthly: 1800 },
    { id: "food", slug: "food", name: "Groceries", kind: "expense", plannedMonthly: 750 },
    { id: "car", slug: "transport", name: "Car", kind: "expense", plannedMonthly: 515 },
    { id: "util", slug: "utilities", name: "Utilities", kind: "expense", plannedMonthly: 400 },
    { id: "other", slug: "other", name: "Other", kind: "expense", plannedMonthly: 600 },
    { id: "save", slug: "savings", name: "Savings transfers", kind: "expense", plannedMonthly: 0 },
  ];
  const accounts: Account[] = [
    { id: "chk", name: "Checking", kind: "checking", createdAt: "2026-01-01" },
    { id: "sav", name: "Savings", kind: "savings", createdAt: "2026-01-01" },
    { id: "visa", name: "Visa", kind: "credit", createdAt: "2026-01-01" },
    { id: "carloan", name: "Car loan", kind: "car_loan", createdAt: "2026-01-01" },
    { id: "roth", name: "Roth IRA", kind: "retirement", createdAt: "2026-01-01" },
    { id: "brok", name: "Brokerage", kind: "investment", createdAt: "2026-01-01" },
  ];
  const balances: BalancePoint[] = [
    { id: "b-chk", accountId: "chk", date: "2026-10-01", amount: 5000, source: "entered" },
    { id: "b-sav", accountId: "sav", date: "2026-10-01", amount: 6130, source: "entered" },
    { id: "b-visa", accountId: "visa", date: "2026-10-01", amount: -1240, source: "entered" },
    { id: "b-car", accountId: "carloan", date: "2026-10-01", amount: -9800, source: "entered" },
    { id: "b-roth", accountId: "roth", date: "2026-10-01", amount: 36900, source: "entered" },
    { id: "b-brok", accountId: "brok", date: "2026-10-01", amount: 6950, source: "entered" },
  ];
  const debts: DebtItem[] = [
    { id: "student", name: "Student loan", balance: 18500, apr: 5.5, minimum: 190, origin: "money" },
    { id: "visa-debt", name: "Visa", balance: 1240, apr: 24.99, minimum: 40, origin: "plan" },
  ];
  const transactions: Transaction[] = [];
  for (const ym of ["2026-07", "2026-08", "2026-09"]) {
    transactions.push(row(`in-${ym}`, `${ym}-02`, "PAYROLL", 4200, "pay"));
    transactions.push(row(`rent-${ym}`, `${ym}-03`, "RENT", -1800, "rent"));
    transactions.push(row(`save-${ym}`, `${ym}-04`, "TRANSFER TO SAVINGS", -500, "save"));
  }
  transactions.push(row("in-2026-10", "2026-10-02", "PAYROLL", 4200, "pay"));
  return { profile, categories, accounts, balances, debts, transactions };
}

function row(id: string, date: string, description: string, amount: number, categoryId: string): Transaction {
  return {
    id,
    date,
    description,
    merchantKey: description,
    amount,
    sourceLabel: "Bank",
    fingerprint: id,
    categoryId,
    userSet: true,
    notes: "",
    excluded: false,
    status: "posted",
  };
}
