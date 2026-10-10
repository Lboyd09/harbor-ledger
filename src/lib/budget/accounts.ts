import { nominalBalance } from "./retirement.ts";
import { PLANNING_MARKET } from "./reference.ts";
import { roundMoney } from "./money.ts";
import type { Account, AccountGrowth, AccountKind, BalancePoint, GrowthBand, ImportBatch, Transaction } from "./types.ts";

const KINDS: AccountKind[] = [
  "checking",
  "savings",
  "credit",
  "cash",
  "investment",
  "retirement",
  "other",
  "car_loan",
  "student_loan",
  "mortgage",
  "personal_loan",
];

export const LOAN_KINDS: readonly AccountKind[] = ["car_loan", "student_loan", "mortgage", "personal_loan"];

export function isLoanKind(kind: AccountKind): boolean {
  return LOAN_KINDS.includes(kind);
}

export const ACCOUNT_KIND_OPTIONS: { id: AccountKind; label: string }[] = [
  { id: "checking", label: "Checking" },
  { id: "savings", label: "Savings" },
  { id: "cash", label: "Cash" },
  { id: "credit", label: "Credit card" },
  { id: "retirement", label: "Retirement" },
  { id: "investment", label: "Brokerage" },
  { id: "other", label: "Other" },
  { id: "car_loan", label: "Car loan" },
  { id: "student_loan", label: "Student loan" },
  { id: "mortgage", label: "Mortgage" },
  { id: "personal_loan", label: "Personal loan" },
];

export function isAccountKind(value: string): value is AccountKind {
  return (KINDS as string[]).includes(value);
}

export function accountKindLabel(kind: AccountKind): string {
  return ACCOUNT_KIND_OPTIONS.find((item) => item.id === kind)?.label ?? kind;
}

/** Cash, retirement, and investment balances are typed in. They do not take a bank file. */
export function accountAcceptsFile(kind: AccountKind): boolean {
  return kind !== "retirement" && kind !== "investment" && kind !== "cash";
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
  if (kind === "credit" || isLoanKind(kind)) return amount === 0 ? 0 : roundMoney(-Math.abs(amount));
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

export type AccountGroupId = "cash" | "investing" | "owed";

const ACCOUNT_GROUP_ORDER: AccountGroupId[] = ["cash", "investing", "owed"];

const ACCOUNT_GROUP_LABEL: Record<AccountGroupId, string> = {
  cash: "Cash",
  investing: "Investments",
  owed: "Debts",
};

export function accountGroup(kind: AccountKind): AccountGroupId {
  if (kind === "investment" || kind === "retirement") return "investing";
  if (kind === "credit" || isLoanKind(kind)) return "owed";
  return "cash";
}

/** Home order: bank and cash, savings, investments, then what is owed. Empty groups are left out. */
export function groupAccounts<T extends { kind: AccountKind; amount?: number }>(rows: T[]): { id: AccountGroupId; label: string; rows: T[] }[] {
  const buckets = new Map<AccountGroupId, T[]>(ACCOUNT_GROUP_ORDER.map((id) => [id, []]));
  for (const row of rows) buckets.get(accountGroup(row.kind))?.push(row);
  return ACCOUNT_GROUP_ORDER.map((id) => ({
    id,
    label: ACCOUNT_GROUP_LABEL[id],
    rows: (buckets.get(id) ?? []).slice().sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0) || 0),
  })).filter((group) => group.rows.length > 0);
}

export type InvestmentPick = "brokerage" | "roth" | "traditional" | "401k" | "other";

const INVESTMENT_PICKS: Record<InvestmentPick, { name: string; kind: AccountKind }> = {
  brokerage: { name: "Brokerage", kind: "investment" },
  roth: { name: "Roth IRA", kind: "retirement" },
  traditional: { name: "Traditional IRA", kind: "retirement" },
  "401k": { name: "401(k)", kind: "retirement" },
  other: { name: "Investment", kind: "investment" },
};

function balanceId(accountId: string, date: string, balances: BalancePoint[]): string {
  let id = `bal_${accountId}_${date}`;
  let n = 2;
  while (balances.some((row) => row.id === id)) {
    id = `bal_${accountId}_${date}_${n}`;
    n += 1;
  }
  return id;
}

/** Demo bank rows are not a real account to import into. */
export function isDemoAccount(account: { id: string; name: string }): boolean {
  return account.id.startsWith("acct_demo") || /demo bank file/i.test(account.name);
}

/** The import picker pre-selects the only real account. It never pre-selects a demo account. */
export function defaultImportAccount(accounts: { id: string; name: string }[], recentId: string | null): string {
  const real = accounts.filter((account) => !isDemoAccount(account));
  if (real.length === 1) return real[0].id;
  if (recentId && real.some((account) => account.id === recentId)) return recentId;
  return "";
}

/** One tap. Adds to the cash account when one already exists. */
export function quickCash(
  accounts: Account[],
  balances: BalancePoint[],
  amount: number,
  today: string,
  name = "Cash in wallet",
): { accounts: Account[]; balances: BalancePoint[] } | null {
  if (!Number.isFinite(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const existing = accounts.find((account) => account.kind === "cash");
  const account = existing ?? createAccount(accounts, { name: name.trim() || "Cash in wallet", kind: "cash" }, `${today}T00:00:00.000Z`);
  if (!account) return null;
  const nextAccounts = existing ? accounts : [...accounts, account];
  const point: BalancePoint = {
    id: balanceId(account.id, today, balances),
    accountId: account.id,
    date: today,
    amount: roundMoney(amount),
    source: "entered",
  };
  return { accounts: nextAccounts, balances: [...balances, point] };
}

export function quickInvestment(
  accounts: Account[],
  balances: BalancePoint[],
  input: { name?: string | null; pick: InvestmentPick; amount: number },
  today: string,
): { accounts: Account[]; balances: BalancePoint[] } | null {
  if (!Number.isFinite(input.amount) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const preset = INVESTMENT_PICKS[input.pick];
  if (!preset) return null;
  const name = input.name?.trim() || preset.name;
  const account = createAccount(accounts, { name, kind: preset.kind }, `${today}T00:00:00.000Z`);
  if (!account) return null;
  const point: BalancePoint = {
    id: balanceId(account.id, today, balances),
    accountId: account.id,
    date: today,
    amount: roundMoney(input.amount),
    source: "entered",
  };
  return { accounts: [...accounts, account], balances: [...balances, point] };
}

export type GrowthPoint = { years: number; label: string; low: number; likely: number; high: number };

export type AccountGrowthResult = {
  estimateNow: number | null;
  lastTyped: number | null;
  lastTypedDate: string | null;
  expectedThisYear: number | null;
  path: GrowthPoint[] | null;
  ready: boolean;
};

function yearsBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / (365.25 * 86_400_000);
}

function chosenRate(growth: AccountGrowth): number | null {
  if (growth.returnPercent != null && Number.isFinite(growth.returnPercent)) return growth.returnPercent / 100;
  const band: GrowthBand | null | undefined = growth.band;
  if (band === "cautious") return PLANNING_MARKET.conservative;
  if (band === "bold") return PLANNING_MARKET.optimistic;
  if (band === "typical") return PLANNING_MARKET.expected;
  return null;
}

/**
 * A guess from the last typed balance. It does not write a balance.
 * Ready only when a return and a monthly amount are both set.
 */
export function accountGrowth(
  account: Account,
  balances: BalancePoint[],
  today: string,
  options?: { yearsToRetire?: number | null },
): AccountGrowthResult {
  const latest = latestBalance(account.id, balances);
  const lastTyped = latest ? latest.amount : null;
  const lastTypedDate = latest?.date ?? null;
  const growth = account.growth;
  const rate = growth ? chosenRate(growth) : null;
  const ready = Boolean(growth && rate != null && growth.monthlyAdd != null && Number.isFinite(growth.monthlyAdd));
  if (!ready || rate == null || !growth) {
    return { estimateNow: null, lastTyped, lastTypedDate, expectedThisYear: null, path: null, ready: false };
  }
  const fee = Math.max(0, Number.isFinite(growth.yearlyFeePercent ?? 0) ? (growth.yearlyFeePercent ?? 0) / 100 : 0);
  const lowRate = Math.min(PLANNING_MARKET.conservative, rate) - fee;
  const highRate = Math.max(PLANNING_MARKET.optimistic, rate) - fee;
  const midRate = rate - fee;
  const monthly = Math.max(0, growth.monthlyAdd ?? 0);
  const start = Math.max(0, lastTyped ?? 0);
  const from = lastTypedDate && lastTypedDate < today ? lastTypedDate : today;
  const elapsed = yearsBetween(from, today);
  const estimateNow = roundMoney(nominalBalance(start, monthly, midRate, elapsed));
  const expectedThisYear = roundMoney(nominalBalance(estimateNow, monthly, midRate, 1));
  const marks = new Map<number, string>([
    [10, "10 years"],
    [20, "20 years"],
    [30, "30 years"],
  ]);
  const retire = options?.yearsToRetire;
  if (retire != null && retire > 0) marks.set(Math.round(retire * 100) / 100, "Retire age");
  const path = [...marks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([years, label]) => ({
      years,
      label,
      low: roundMoney(nominalBalance(estimateNow, monthly, lowRate, years)),
      likely: roundMoney(nominalBalance(estimateNow, monthly, midRate, years)),
      high: roundMoney(nominalBalance(estimateNow, monthly, highRate, years)),
    }));
  return { estimateNow, lastTyped, lastTypedDate, expectedThisYear, path, ready: true };
}

/** Typed balance, unless this investment is allowed to show its estimate. */
export function shownBalance(account: Account, balances: BalancePoint[], today: string): number {
  const typed = latestBalance(account.id, balances)?.amount ?? 0;
  if (!account.growth?.useEstimates) return roundMoney(typed);
  if (account.kind !== "investment" && account.kind !== "retirement") return roundMoney(typed);
  const grown = accountGrowth(account, balances, today);
  return grown.estimateNow == null ? roundMoney(typed) : grown.estimateNow;
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
