import { sortCharge } from "./auto-sort.ts";
import { displayMerchant, merchantKey, merchantNormalized } from "./merchant.ts";
import { expectedMonthlyOf } from "./income.ts";
import { roundMoney } from "./money.ts";
import { parseAmountToken } from "./money.ts";
import { shiftMonth } from "./parse-date.ts";
import type { AccountKind, BalancePoint, Category, IncomeCadence, IncomeStream, ParsePreviewRow, Profile, Transaction } from "./types.ts";

export type AccountGuess = { kind: AccountKind; reason: string };

export type IncomeSuggestion = {
  name: string;
  amount: number;
  cadence: IncomeCadence;
  matchHints: string[];
  lastDate: string;
  nextExpected: string | null;
  confidence: "high" | "medium";
  merchantKey: string;
};

const PAYROLL = /\b(PAYROLL|DIR DEP|DIRECT DEP|SALARY|GUSTO|ADP)\b/i;
const INTEREST = /\b(INTEREST PAYMENT|INTEREST PAID|ACCT INTEREST)\b/i;
const CHECK = /\b(CHECK|CHK)\s*#?\s*\d+/i;
const CARD_PAY = /\b(PAYMENT THANK YOU|AUTOPAY PAYMENT|PAYMENT - THANK|CR CARDPAYMENT)\b/i;

function daysBetween(a: string, b: string): number {
  const am = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  const bm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (!am || !bm) return 0;
  const ad = Date.UTC(Number(am[1]), Number(am[2]) - 1, Number(am[3]));
  const bd = Date.UTC(Number(bm[1]), Number(bm[2]) - 1, Number(bm[3]));
  return Math.round((bd - ad) / 86400000);
}

function addDays(iso: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function cadenceOf(dates: string[]): { cadence: IncomeCadence; gap: number } {
  const sorted = [...dates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1], sorted[i]);
    if (gap > 0) gaps.push(gap);
  }
  const gap = median(gaps);
  const days = sorted.map((date) => Number(date.slice(8, 10)));
  const anchored = days.filter((day) => day <= 7).length >= 2 && days.filter((day) => day >= 13 && day <= 18).length >= 2;
  if (anchored && gap >= 10 && gap <= 20) return { cadence: "twice-monthly", gap: gap || 15 };
  if (gap >= 5 && gap <= 9) return { cadence: "weekly", gap };
  if (gap >= 12 && gap <= 17) return { cadence: "biweekly", gap };
  if (gap >= 25 && gap <= 35) return { cadence: "monthly", gap };
  return { cadence: "irregular", gap: gap || 30 };
}

/** Guess checking, savings, or a card from the rows and the ending balance. */
export function guessAccountKind(
  rows: { description: string; amount: number | null }[],
  endingBalance: number | null,
): AccountGuess {
  const amounts = rows.map((row) => row.amount).filter((n): n is number => n != null && n !== 0);
  const credits = amounts.filter((n) => n > 0).length;
  const debits = amounts.filter((n) => n < 0).length;
  const text = rows.map((row) => row.description).join(" \n ");
  if (endingBalance != null && endingBalance < 0) {
    return { kind: "credit", reason: "The balance in the file is negative, which is what a card usually shows." };
  }
  if (CARD_PAY.test(text) && debits > credits) {
    return { kind: "credit", reason: "The file has card payments and mostly charges." };
  }
  const interest = rows.filter((row) => INTEREST.test(row.description) && (row.amount ?? 0) > 0).length;
  if (interest >= 1 && debits <= 2 && credits >= interest) {
    return { kind: "savings", reason: "Most of the activity is interest, which is what a savings account usually shows." };
  }
  if (CHECK.test(text) || PAYROLL.test(text)) {
    return { kind: "checking", reason: "The file has pay or checks, which usually means checking." };
  }
  if (debits > 0 && credits > 0) {
    return { kind: "checking", reason: "Money comes in and goes out, which usually means checking." };
  }
  return { kind: "checking", reason: "Nothing in the file points to a card or savings, so this starts as checking." };
}

function alreadyKnown(description: string, streams: IncomeStream[]): boolean {
  const hay = ` ${merchantNormalized(description)} `;
  for (const stream of streams) {
    for (const hint of stream.matchHints ?? []) {
      const needle = merchantNormalized(hint);
      if (needle && hay.includes(` ${needle} `)) return true;
    }
  }
  return false;
}

/**
 * Deposits that repeat at least three times, within 15 percent of the middle amount.
 * Transfers, refunds, and pay already on the profile are skipped.
 */
export function inferIncomeStreams(
  transactions: { date: string; description: string; amount: number; status?: string; merchantKey?: string }[],
  _categories: Category[],
  profile: Pick<Profile, "incomeStreams">,
): IncomeSuggestion[] {
  const groups = new Map<string, { description: string; amounts: number[]; dates: string[] }>();
  for (const row of transactions) {
    if (row.amount <= 0) continue;
    if (row.status === "transfer" || row.status === "refund" || row.status === "reimbursement") continue;
    if (/\b(REFUND|REVERSAL|INTEREST)\b/i.test(row.description)) continue;
    if (alreadyKnown(row.description, profile.incomeStreams ?? [])) continue;
    const key = row.merchantKey || merchantKey(row.description);
    const cur = groups.get(key) ?? { description: row.description, amounts: [], dates: [] };
    cur.amounts.push(row.amount);
    cur.dates.push(row.date);
    if (row.date >= (cur.dates[cur.dates.length - 1] ?? "")) cur.description = row.description;
    groups.set(key, cur);
  }
  const out: IncomeSuggestion[] = [];
  for (const [key, group] of groups) {
    if (group.amounts.length < 3) continue;
    const mid = median(group.amounts);
    if (!(mid > 0)) continue;
    const close = group.amounts.every((amount) => Math.abs(amount - mid) <= mid * 0.15 + 0.009);
    if (!close) continue;
    const { cadence, gap } = cadenceOf(group.dates);
    const lastDate = [...group.dates].sort().at(-1) ?? group.dates[0];
    const hint = merchantNormalized(group.description).split(" ").find((word) => word.length >= 4) ?? key.split(" ")[0];
    out.push({
      name: displayMerchant(group.description),
      amount: roundMoney(mid),
      cadence,
      matchHints: hint ? [hint.toLowerCase()] : [],
      lastDate,
      nextExpected: gap > 0 ? addDays(lastDate, Math.round(gap)) : null,
      confidence: group.amounts.length >= 4 && close ? "high" : "medium",
      merchantKey: key,
    });
  }
  out.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  return out;
}

function newestFirst(dates: string[]): boolean {
  if (dates.length < 2) return true;
  if (dates[0] > dates[dates.length - 1]) return true;
  if (dates[0] < dates[dates.length - 1]) return false;
  return true;
}

/** One file balance per month, on the last date that month shows a balance. */
export function monthEndBalances(rows: ParsePreviewRow[]): BalancePoint[] {
  const points = rows.filter((row) => row.date && row.balance != null && Number.isFinite(row.balance));
  if (!points.length) return [];
  const order = newestFirst(points.map((row) => row.date as string));
  const byMonth = new Map<string, ParsePreviewRow[]>();
  for (const row of points) {
    const ym = (row.date as string).slice(0, 7);
    const list = byMonth.get(ym) ?? [];
    list.push(row);
    byMonth.set(ym, list);
  }
  const out: BalancePoint[] = [];
  for (const [ym, list] of byMonth) {
    const latest = list.reduce((max, row) => ((row.date as string) > max ? (row.date as string) : max), list[0].date as string);
    const onDay = list.filter((row) => row.date === latest);
    const pick = order ? onDay[0] : onDay[onDay.length - 1];
    out.push({
      id: `bal_file_${ym}`,
      accountId: "",
      date: latest,
      amount: roundMoney(pick.balance as number),
      source: "file",
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export type ChecklistLine = { label: string; value: string };

/** Short lines for the import screen, each a number and a word. */
export function fileChecklist(input: {
  rows: ParsePreviewRow[];
  categories: Category[];
  profile: Pick<Profile, "incomeStreams">;
  endingBalance: { amount: number; asOf: string } | null;
}): ChecklistLine[] {
  const usable = input.rows.filter((row) => row.date && row.amount != null && row.description);
  const months = new Set(usable.map((row) => (row.date as string).slice(0, 7)));
  const drafts = usable.map((row) => ({
    date: row.date as string,
    description: row.description,
    amount: row.amount as number,
    merchantKey: merchantKey(row.description),
  }));
  const pay = inferIncomeStreams(drafts, input.categories, input.profile);
  const labeled = usable.filter((row) => (row.bankCategory ?? "").trim()).length;
  const counts = new Map<string, number>();
  for (const row of drafts) {
    if (row.amount >= 0) continue;
    counts.set(row.merchantKey, (counts.get(row.merchantKey) ?? 0) + 1);
  }
  let repeating = 0;
  for (const count of counts.values()) if (count >= 2) repeating += 1;
  const lines: ChecklistLine[] = [
    { label: "Charges", value: String(usable.length) },
    { label: "Months", value: String(months.size) },
  ];
  if (input.endingBalance) lines.push({ label: "Balance", value: input.endingBalance.asOf });
  if (pay.length) lines.push({ label: "Pay patterns", value: String(pay.length) });
  if (repeating) lines.push({ label: "Repeating bills", value: String(repeating) });
  if (labeled) lines.push({ label: "Bank categories", value: String(labeled) });
  return lines;
}

export function nextExpectedInMonth(date: string | null, ym: string): boolean {
  return Boolean(date && date.startsWith(ym));
}

/** Used by tests that build a balance column without going through the parser. */
export function balanceFromToken(raw: string): number | null {
  return parseAmountToken(raw);
}

export function monthAfter(ym: string): string {
  return shiftMonth(ym, 1);
}

function incomeSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "income";
}

/**
 * Add the pay patterns the person accepted. Matching deposits that were not set by hand are sorted again.
 * A hint that is already on a stream is left alone.
 */
export function applyAdoptedIncome(input: {
  profile: Profile;
  categories: Category[];
  transactions: Transaction[];
  suggestions: IncomeSuggestion[];
  createCategoryId: () => string;
  createStreamId: () => string;
}): { profile: Profile; categories: Category[]; transactions: Transaction[] } {
  let streams = [...(input.profile.incomeStreams ?? [])];
  let categories = input.categories.map((category) => ({ ...category }));
  const freshHints: string[] = [];
  for (const suggestion of input.suggestions) {
    const hints = suggestion.matchHints.map((hint) => hint.trim()).filter(Boolean);
    if (hints.some((hint) => alreadyKnown(hint, streams))) continue;
    let category =
      categories.find((item) => item.kind === "income" && merchantNormalized(item.name) === merchantNormalized(suggestion.name)) ??
      (/pay|salary|wage|payroll/.test(suggestion.name.toLowerCase()) ? categories.find((item) => item.slug === "paycheck") : undefined);
    if (!category) {
      let slug = incomeSlug(suggestion.name);
      if (categories.some((item) => item.slug === slug)) slug = `${slug}-${categories.length + 1}`;
      category = {
        id: input.createCategoryId(),
        slug,
        name: suggestion.name.trim() || "Pay",
        kind: "income",
        plannedMonthly: expectedMonthlyOf({
          id: "draft",
          name: suggestion.name,
          amount: suggestion.amount,
          cadence: suggestion.cadence,
          matchHints: hints,
        }),
      };
      categories = [...categories, category];
    }
    streams = [
      ...streams,
      {
        id: input.createStreamId(),
        name: suggestion.name.trim() || "Pay",
        amount: suggestion.amount,
        cadence: suggestion.cadence,
        matchHints: hints,
        categoryId: category.id,
      },
    ];
    freshHints.push(...hints);
  }
  const profile = { ...input.profile, incomeStreams: streams };
  if (!freshHints.length) return { profile, categories, transactions: input.transactions };
  const transactions = input.transactions.map((row) => {
    if (row.userSet || row.amount <= 0 || row.status === "transfer" || row.status === "refund") return row;
    const hay = merchantNormalized(row.description);
    if (!freshHints.some((hint) => hay.includes(merchantNormalized(hint)))) return row;
    const sorted = sortCharge(
      {
        description: row.description,
        amount: row.amount,
        merchantKey: row.merchantKey,
        date: row.date,
        bankCategory: row.bankLabel,
        memo: row.notes,
      },
      { categories, rules: [], incomeStreams: streams, bankLabelMap: profile.bankLabelMap },
    );
    if (sorted.auto.source !== "income" || !sorted.categoryId) return row;
    return { ...row, categoryId: sorted.categoryId, status: sorted.status, auto: sorted.auto, userSet: false };
  });
  return { profile, categories, transactions };
}
