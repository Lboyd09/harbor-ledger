import { roundMoney } from "./money.ts";
import type { Account, AccountKind, BalancePoint, ImportBatch, Transaction } from "./types.ts";

const KINDS: AccountKind[] = ["checking", "savings", "credit", "investment", "retirement", "other"];

export const ACCOUNT_KIND_OPTIONS: { id: AccountKind; label: string }[] = [
  { id: "checking", label: "Checking" },
  { id: "savings", label: "Savings" },
  { id: "credit", label: "Credit card" },
  { id: "retirement", label: "Roth IRA or other retirement" },
  { id: "investment", label: "Investments" },
  { id: "other", label: "Other" },
];

export function isAccountKind(value: string): value is AccountKind {
  return (KINDS as string[]).includes(value);
}

export function accountKindLabel(kind: AccountKind): string {
  return ACCOUNT_KIND_OPTIONS.find((item) => item.id === kind)?.label ?? kind;
}

/** Retirement and investment balances are typed in. They do not take a bank file. */
export function accountAcceptsFile(kind: AccountKind): boolean {
  return kind !== "retirement" && kind !== "investment";
}

export function accountSlug(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "account";
}

/** Stable id, same scheme as migrated accounts. A second account with the same name gets -2, -3, … */
export function nextAccountId(name: string, usedIds: Iterable<string>): string {
  const used = new Set(usedIds);
  const base = accountSlug(name);
  let id = `acct_${base}`;
  let n = 2;
  while (used.has(id)) {
    id = `acct_${base}-${n}`;
    n += 1;
  }
  return id;
}

export function createAccount(
  accounts: Account[],
  input: { name: string; kind: AccountKind; institution?: string | null },
  now = new Date().toISOString(),
): Account | null {
  const name = input.name.trim();
  if (!name || !isAccountKind(input.kind)) return null;
  return {
    id: nextAccountId(name, accounts.map((a) => a.id)),
    name,
    kind: input.kind,
    institution: input.institution?.trim() ? input.institution.trim() : null,
    createdAt: now,
  };
}

export function accountHasActivity(
  id: string,
  transactions: { accountId?: string | null }[],
  imports: { accountId?: string | null }[],
): boolean {
  return transactions.some((t) => t.accountId === id) || imports.some((b) => b.accountId === id);
}

/** What the person typed. A card stores what is owed, as a negative number. */
export function enteredBalanceAmount(kind: AccountKind, amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (kind === "credit") return amount === 0 ? 0 : roundMoney(-Math.abs(amount));
  return roundMoney(amount);
}

/**
 * Balance column from a file. A positive number on a card is what is owed, stored negative.
 * A number that is already negative is kept so a corrected sign is not flipped again.
 */
export function storedFileBalance(kind: AccountKind, fileAmount: number): number {
  if (!Number.isFinite(fileAmount)) return 0;
  if (kind === "credit" && fileAmount > 0) return roundMoney(-fileAmount);
  return roundMoney(fileAmount);
}

/** A positive card balance in a file uses the opposite sign from the one we store. */
export function creditFileSignLooksWrong(kind: AccountKind, fileAmount: number): boolean {
  return kind === "credit" && fileAmount > 0;
}

export function latestBalance(accountId: string, balances: BalancePoint[]): BalancePoint | null {
  const rows = balances.filter((b) => b.accountId === accountId && /^\d{4}-\d{2}-\d{2}$/.test(b.date));
  rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return rows[0] ?? null;
}

export function accountsOfKind(accounts: Account[], kind: AccountKind): Account[] {
  return accounts.filter((a) => a.kind === kind);
}

export function balanceHistory(accountId: string, balances: BalancePoint[]): BalancePoint[] {
  return balances
    .filter((b) => b.accountId === accountId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Sum of each account's latest balance. Accounts with no point count as zero. */
export function totalBalance(accounts: Account[], balances: BalancePoint[], kinds?: readonly AccountKind[]): number {
  const list = kinds?.length ? accounts.filter((a) => kinds.includes(a.kind)) : accounts;
  let sum = 0;
  for (const account of list) sum += latestBalance(account.id, balances)?.amount ?? 0;
  return Math.round(sum * 100) / 100;
}

/** Replace a file balance for the same account and date. Entered balances stay. */
export function upsertFileBalance(
  balances: BalancePoint[],
  point: { accountId: string; date: string; amount: number },
): BalancePoint[] {
  const rest = balances.filter(
    (b) => !(b.source === "file" && b.accountId === point.accountId && b.date === point.date),
  );
  const id = `bal_${point.accountId}_${point.date}`;
  const taken = rest.some((b) => b.id === id);
  return [
    ...rest,
    {
      id: taken ? `${id}_file` : id,
      accountId: point.accountId,
      date: point.date,
      amount: roundMoney(point.amount),
      source: "file" as const,
    },
  ];
}

function dayOf(value: string): string | null {
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function createdAt(label: string | null, transactions: Transaction[], imports: ImportBatch[]): string {
  const days: string[] = [];
  for (const t of transactions) {
    if (label != null && t.sourceLabel !== label) continue;
    const day = dayOf(t.date);
    if (day) days.push(day);
  }
  for (const batch of imports) {
    if (label != null && batch.sourceLabel !== label) continue;
    const day = dayOf(batch.importedAt);
    if (day) days.push(day);
  }
  days.sort();
  return `${days[0] ?? "2020-01-01"}T00:00:00.000Z`;
}

/**
 * Old ledgers have no accounts. One checking account is created per source label
 * that still has a row with no account. A file already filed under an account
 * does not grow a second account from the bank name on the file.
 * No labels and some transactions means a single "Main account". An empty ledger stays empty.
 * Already-saved accounts are kept. Ids are stable so a second load does not fork them.
 */
export function migrateLedgerAccounts(input: {
  accounts: Account[];
  balances: BalancePoint[];
  transactions: Transaction[];
  imports: ImportBatch[];
}): { accounts: Account[]; balances: BalancePoint[]; transactions: Transaction[]; imports: ImportBatch[] } {
  const accounts = input.accounts.map((a) => ({ ...a }));
  const byName = new Map(accounts.map((a) => [a.name, a]));
  const labels = new Set<string>();
  for (const t of input.transactions) {
    const label = t.sourceLabel.trim();
    if (label) labels.add(label);
  }
  for (const batch of input.imports) {
    const label = batch.sourceLabel.trim();
    if (label) labels.add(label);
  }
  const usedIds = new Set(accounts.map((a) => a.id));
  function addMigrated(name: string, sampleLabel: string | null) {
    if (byName.has(name)) return byName.get(name)!;
    const id = nextAccountId(name, usedIds);
    usedIds.add(id);
    const account: Account = {
      id,
      name,
      kind: "checking",
      institution: null,
      createdAt: createdAt(sampleLabel, input.transactions, input.imports),
    };
    accounts.push(account);
    byName.set(name, account);
    return account;
  }
  function rowOpen(accountId: string | null | undefined): boolean {
    return !(accountId && accounts.some((a) => a.id === accountId));
  }
  function labelOpen(label: string): boolean {
    const txOpen = input.transactions.some((t) => t.sourceLabel.trim() === label && rowOpen(t.accountId));
    const impOpen = input.imports.some((batch) => batch.sourceLabel.trim() === label && rowOpen(batch.accountId));
    return txOpen || impOpen;
  }

  if (labels.size === 0 && input.transactions.length > 0 && accounts.length === 0) {
    addMigrated("Main account", null);
  }
  for (const label of [...labels].sort()) {
    if (!labelOpen(label)) continue;
    addMigrated(label, label);
  }

  const main = accounts.find((a) => a.name === "Main account") ?? null;
  const transactions = input.transactions.map((t) => {
    if (t.accountId && accounts.some((a) => a.id === t.accountId)) return t;
    const label = t.sourceLabel.trim();
    const account = (label && byName.get(label)) || (!label ? main : null);
    if (!account) return { ...t, accountId: t.accountId ?? null };
    return { ...t, accountId: account.id };
  });
  const imports = input.imports.map((batch) => {
    if (batch.accountId && accounts.some((a) => a.id === batch.accountId)) return batch;
    const label = batch.sourceLabel.trim();
    const account = (label && byName.get(label)) || (!label && labels.size === 0 ? main : null);
    if (!account) return { ...batch, accountId: batch.accountId ?? null };
    return { ...batch, accountId: account.id };
  });

  const balances = input.balances.map((b) => ({ ...b }));
  const seen = new Set(balances.map((b) => `${b.accountId}|${b.date}|${b.amount}`));
  for (const batch of imports) {
    const end = batch.endingBalance;
    if (!batch.accountId || !end || !/^\d{4}-\d{2}-\d{2}$/.test(end.asOf)) continue;
    const key = `${batch.accountId}|${end.asOf}|${end.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    balances.push({
      id: `bal_${batch.accountId}_${end.asOf}`,
      accountId: batch.accountId,
      date: end.asOf,
      amount: end.amount,
      source: "file",
    });
  }
  return { accounts, balances, transactions, imports };
}
