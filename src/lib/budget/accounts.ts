import type { Account, AccountKind, BalancePoint, ImportBatch, Transaction } from "./types.ts";

const KINDS: AccountKind[] = ["checking", "savings", "credit", "investment", "retirement", "other"];

export function isAccountKind(value: string): value is AccountKind {
  return (KINDS as string[]).includes(value);
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

function slug(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "account";
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
 * Old ledgers have no accounts. One checking account is created per source label.
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
  function addAccount(name: string, sampleLabel: string | null) {
    if (byName.has(name)) return byName.get(name)!;
    let id = `acct_${slug(name)}`;
    let n = 2;
    while (usedIds.has(id)) {
      id = `acct_${slug(name)}-${n}`;
      n += 1;
    }
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

  if (labels.size === 0 && input.transactions.length > 0 && accounts.length === 0) {
    addAccount("Main account", null);
  }
  for (const label of [...labels].sort()) addAccount(label, label);

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
