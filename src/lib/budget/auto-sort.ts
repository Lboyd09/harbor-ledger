import { bankLabelKey, matchBankLabel } from "./bank-label.ts";
import { matchKeyword, SLUG_FALLBACKS } from "./keywords.ts";
import { fingerprint } from "./fingerprint.ts";
import { editDistance, merchantFamily, merchantKey, merchantNormalized, tokenOverlap } from "./merchant.ts";
import { roundMoney } from "./money.ts";
import type {
  Category,
  IncomeStream,
  MerchantRule,
  Profile,
  Transaction,
  TransactionAuto,
  TxStatus,
} from "./types.ts";

export type SortHistory = {
  merchantKey: string;
  categoryId: string | null;
  userSet: boolean;
  date: string;
  amount?: number;
  status?: TxStatus;
};

export type SortContext = {
  categories: Category[];
  rules: MerchantRule[];
  history?: SortHistory[];
  incomeStreams?: IncomeStream[];
  /** Labels the person already confirmed. Missing means none. */
  bankLabelMap?: Record<string, string> | null;
};

export type SortedCharge = {
  categoryId: string | null;
  status: TxStatus;
  auto: TransactionAuto;
};

const MOVE_WORD = /\b(PAYMENT|TRANSFER|XFER|PYMT|AUTOPAY)\b/i;

function resolveSlug(slug: string, categories: Category[]): Category | undefined {
  const direct = categories.find((c) => c.slug === slug);
  if (direct) return direct;
  for (const alt of SLUG_FALLBACKS[slug] ?? []) {
    const hit = categories.find((c) => c.slug === alt);
    if (hit) return hit;
  }
  return undefined;
}

function sideOf(amount: number | undefined, status?: TxStatus): "in" | "out" | "any" {
  if (amount == null || !Number.isFinite(amount)) return "any";
  if (amount < 0 || status === "refund") return "out";
  return "in";
}

function pickRule(rules: MerchantRule[], key: string, amount: number): MerchantRule | undefined {
  const side: "in" | "out" = amount < 0 ? "out" : "in";
  return (
    rules.find((r) => r.merchantKey === key && r.side === side) ??
    rules.find((r) => r.merchantKey === key && !r.side)
  );
}

function hintHit(description: string, hint: string): boolean {
  const needle = merchantNormalized(hint);
  const hay = merchantNormalized(description);
  if (!needle || !hay) return false;
  return ` ${hay} `.includes(` ${needle} `);
}

function isPayroll(description: string): boolean {
  const hit = matchKeyword(description);
  if (hit?.slug === "paycheck") return true;
  return /\b(PAYROLL|SALARY|DIR DEP|DIRECT DEP|DIRECT DEPOSIT)\b/i.test(description);
}

function nearAmount(amount: number, expected: number): boolean {
  if (!(expected > 0) || !(amount > 0)) return false;
  return Math.abs(amount - expected) <= expected * 0.05 + 0.009;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function tally(rows: SortHistory[]): { id: string; n: number } | null {
  const counts = new Map<string, { n: number; date: string }>();
  for (const row of rows) {
    if (!row.categoryId) continue;
    const cur = counts.get(row.categoryId) ?? { n: 0, date: "" };
    cur.n += 1;
    if (row.date > cur.date) cur.date = row.date;
    counts.set(row.categoryId, cur);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || b[1].date.localeCompare(a[1].date));
  if (!ranked.length) return null;
  return { id: ranked[0][0], n: ranked[0][1].n };
}

function sameSide(row: SortHistory, side: "in" | "out" | "any"): boolean {
  const pastSide = sideOf(row.amount, row.status);
  return pastSide === "any" || pastSide === side;
}

const P2P = /\b(VENMO|ZELLE|CASH APP)\b/i;
const CARD_PAY = /\b(PAYMENT TO\b.{0,24}\bCARD|CREDIT CRD|CARDMEMBER|CRD AUTOPAY)\b/i;
const OWN_XFER = /\b(ONLINE TRANSFER|TRANSFER TO|TRANSFER FROM|XFER TO|XFER FROM)\b/i;
const CASH_OUT = /\b(ATM WITHDRAWAL|CASH WITHDRAWAL)\b/i;

function decide(
  description: string,
  amount: number,
  key: string,
  date: string | undefined,
  ctx: SortContext,
  bankCategory?: string | null,
  memo?: string | null,
): TransactionAuto & { refund?: boolean } {
  const categories = ctx.categories;
  const history = ctx.history ?? [];
  const rule = pickRule(ctx.rules, key, amount);
  if (rule && categories.some((c) => c.id === rule.categoryId)) {
    return { source: "rule", confidence: "sure", suggestedCategoryId: rule.categoryId, reason: "This name already has a category." };
  }

  const side = sideOf(amount);
  const past = history.filter((t) => t.userSet && t.merchantKey === key && t.categoryId && categories.some((c) => c.id === t.categoryId) && sameSide(t, side));
  if (past.length) {
    const top = tally(past);
    if (top) {
      const ids = new Set(past.map((row) => row.categoryId));
      const agrees = ids.size === 1;
      return {
        source: "history",
        confidence: agrees ? "sure" : "likely",
        suggestedCategoryId: top.id,
        reason: agrees ? `Same as your last ${past.length} from this name.` : "Your past charges for this name do not all agree. The most common one is used.",
      };
    }
  }

  const family = merchantFamily(description);
  const familyRows = history.filter((t) => {
    if (!t.userSet || !t.categoryId || t.merchantKey === key) return false;
    if (!categories.some((c) => c.id === t.categoryId)) return false;
    if (!sameSide(t, side)) return false;
    return merchantFamily(t.merchantKey) === family && family !== "UNKNOWN";
  });
  if (familyRows.length) {
    const top = tally(familyRows);
    if (top) {
      const sure = top.n >= 2 && familyRows.every((row) => row.categoryId === top.id);
      return {
        source: "family",
        confidence: sure ? "sure" : "likely",
        suggestedCategoryId: top.id,
        reason: sure ? "Same as the other stores under this name." : "One earlier charge under this name pointed here.",
      };
    }
  }

  const text = [description, memo].filter((part) => part && part.trim()).join(" ");

  if (amount > 0) {
    let best: { id: string; len: number } | null = null;
    for (const stream of ctx.incomeStreams ?? []) {
      const id = stream.categoryId;
      if (!id || !categories.some((c) => c.id === id)) continue;
      for (const hint of stream.matchHints ?? []) {
        if (!hintHit(text, hint)) continue;
        const len = merchantNormalized(hint).length;
        if (!best || len > best.len) best = { id, len };
      }
    }
    if (best) return { source: "income", confidence: "sure", suggestedCategoryId: best.id, reason: "This matches pay you already named." };

    if (isPayroll(text)) {
      let closest: { id: string; gap: number } | null = null;
      for (const stream of ctx.incomeStreams ?? []) {
        if (!nearAmount(amount, stream.amount)) continue;
        const id =
          stream.categoryId && categories.some((c) => c.id === stream.categoryId)
            ? stream.categoryId
            : (resolveSlug("paycheck", categories)?.id ?? null);
        if (!id) continue;
        const gap = Math.abs(amount - stream.amount) / stream.amount;
        if (!closest || gap < closest.gap) closest = { id, gap };
      }
      if (closest) return { source: "income", confidence: "likely", suggestedCategoryId: closest.id, reason: "The amount is close to a paycheck you entered." };
    }
  }

  if (!P2P.test(text) && (CARD_PAY.test(text) || OWN_XFER.test(text))) {
    const slug = amount > 0 ? "transfers-in" : "transfers-out";
    const cat = resolveSlug(slug, categories) ?? resolveSlug("transfers-out", categories);
    if (cat) {
      return { source: "transfer", confidence: "sure", suggestedCategoryId: cat.id, reason: "This looks like a transfer or a card payment." };
    }
  }

  if (P2P.test(text)) {
    const slug = amount > 0 ? "other-income" : "transfers-out";
    const cat = resolveSlug(slug, categories);
    return {
      source: "none",
      confidence: "unsure",
      suggestedCategoryId: cat?.id ?? null,
      reason: "Person-to-person payments wait until you have sorted one.",
    };
  }

  const hit = matchKeyword(text);
  if (hit && !hit.weak) {
    const cat = resolveSlug(hit.slug, categories);
    if (!cat) {
      const other = categories.find((c) => c.slug === "other");
      return { source: "keyword", confidence: "unsure", suggestedCategoryId: other?.id ?? null };
    }
    if (amount < 0 && cat.kind === "income") {
      const spend = resolveSlug("personal", categories) ?? resolveSlug("other", categories);
      if (!spend) return { source: "keyword", confidence: "unsure", suggestedCategoryId: null };
      return { source: "keyword", confidence: "sure", suggestedCategoryId: spend.id, reason: `The name looks like ${spend.name}.` };
    }
    const refund = amount > 0 && cat.kind === "expense";
    return {
      source: "keyword",
      confidence: "sure",
      suggestedCategoryId: cat.id,
      reason: `The name looks like ${cat.name}.`,
      refund,
    };
  }

  const label = (bankCategory ?? "").trim();
  if (label) {
    const mappedId = ctx.bankLabelMap?.[bankLabelKey(label)];
    const mapped = mappedId ? categories.find((c) => c.id === mappedId) : undefined;
    if (mapped) {
      return {
        source: "bank",
        confidence: "sure",
        suggestedCategoryId: mapped.id,
        reason: "You already confirmed this bank label.",
        refund: amount > 0 && mapped.kind === "expense",
      };
    }
    const bankHit = matchBankLabel(label, categories);
    const cat = bankHit ? categories.find((item) => item.id === bankHit.categoryId) : undefined;
    const signOk =
      !!cat &&
      (amount < 0 ? cat.kind === "expense" || cat.slug === "transfers-out" : cat.kind === "income" || cat.slug === "transfers-out");
    if (bankHit && cat && signOk) {
      return {
        source: "bank",
        confidence: "sure",
        suggestedCategoryId: cat.id,
        reason: bankHit.reason,
        refund: amount > 0 && cat.kind === "expense",
      };
    }
  }

  const related = history.filter((t) => {
    if (side === "out" && (t.amount ?? 0) >= 0) return false;
    if (side === "in" && (t.amount ?? 0) <= 0) return false;
    return t.merchantKey === key || merchantFamily(t.merchantKey) === family;
  });
  const amounts = [...related.map((t) => Math.abs(t.amount ?? 0)), Math.abs(amount)].filter((n) => n > 0);
  const tight = amounts.length >= 3 && amounts.every((n) => Math.abs(n - median(amounts)) <= Math.max(0.5, median(amounts) * 0.03));
  if (tight) {
    const slug = hit?.slug ?? "subscriptions";
    const cat = resolveSlug(slug, categories) ?? categories.find((c) => c.slug === "other");
    if (cat) {
      return {
        source: "repeat",
        confidence: "likely",
        suggestedCategoryId: cat.id,
        reason: "The same amount shows up about every month.",
      };
    }
  }

  if (family !== "UNKNOWN") {
    let bestNear: { id: string; score: number } | null = null;
    for (const row of history) {
      if (!row.userSet || !row.categoryId || !sameSide(row, side)) continue;
      if (!categories.some((c) => c.id === row.categoryId)) continue;
      const other = merchantFamily(row.merchantKey);
      if (!other || other === family) continue;
      const overlap = tokenOverlap(family, other);
      const distance = editDistance(family.replace(/ /g, ""), other.replace(/ /g, ""));
      if (overlap < 0.8 && distance > 2) continue;
      const score = overlap >= 0.8 ? overlap : 0.8;
      if (!bestNear || score > bestNear.score) bestNear = { id: row.categoryId, score };
    }
    if (bestNear) {
      const cat = categories.find((c) => c.id === bestNear?.id);
      return {
        source: "near",
        confidence: "likely",
        suggestedCategoryId: bestNear.id,
        reason: cat ? `Very close to a name you already sorted as ${cat.name}.` : "Very close to a name you already sorted.",
      };
    }
  }

  if (CASH_OUT.test(text)) {
    const cat = resolveSlug("other", categories) ?? resolveSlug("personal", categories);
    if (cat) return { source: "cash", confidence: "sure", suggestedCategoryId: cat.id, reason: "This looks like cash taken out." };
  }

  if (hit?.weak) {
    const cat = resolveSlug(hit.slug, categories);
    if (cat && !(amount < 0 && cat.kind === "income")) {
      return {
        source: "keyword",
        confidence: "likely",
        suggestedCategoryId: cat.id,
        reason: `The name often belongs in ${cat.name}, but stores like this sell more than one thing.`,
        refund: amount > 0 && cat.kind === "expense",
      };
    }
  }

  return { source: "none", confidence: "unsure", suggestedCategoryId: null };
}

export function sortCharge(
  input: {
    description: string;
    amount: number;
    merchantKey: string;
    date?: string;
    bankCategory?: string | null;
    memo?: string | null;
  },
  ctx: SortContext,
): SortedCharge {
  const decision = decide(
    input.description,
    input.amount,
    input.merchantKey,
    input.date,
    ctx,
    input.bankCategory,
    input.memo,
  );
  const categoryId = decision.confidence === "sure" || decision.confidence === "likely" ? decision.suggestedCategoryId : null;
  let status: TxStatus = "posted";
  if (categoryId) {
    const cat = ctx.categories.find((c) => c.id === categoryId);
    if (decision.source === "transfer" || cat?.slug === "transfers-out" || cat?.slug === "transfers-in") status = "transfer";
    else if (decision.refund && (decision.source === "keyword" || decision.source === "bank")) status = "refund";
  }
  return {
    categoryId,
    status,
    auto: {
      source: decision.source,
      confidence: decision.confidence,
      suggestedCategoryId: decision.suggestedCategoryId,
      ...(decision.reason ? { reason: decision.reason } : {}),
      ...(decision.confidence === "likely" ? { provisional: true } : {}),
    },
  };
}

function daysApart(a: string, b: string): number {
  const am = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  const bm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (!am || !bm) return 99;
  const ad = Date.UTC(Number(am[1]), Number(am[2]) - 1, Number(am[3]));
  const bd = Date.UTC(Number(bm[1]), Number(bm[2]) - 1, Number(bm[3]));
  return Math.abs(ad - bd) / 86400000;
}

function hasMoveWord(description: string): boolean {
  return MOVE_WORD.test(description);
}

function asTransfer(row: Transaction, categories: Category[]): Transaction {
  const transferCat = categories.find((c) => c.slug === "transfers-out");
  const categoryId = row.categoryId ?? transferCat?.id ?? null;
  if (row.userSet) return { ...row, status: "transfer" };
  return {
    ...row,
    status: "transfer",
    categoryId,
    auto: { source: "transfer", confidence: "sure", suggestedCategoryId: categoryId },
  };
}

/** Pair opposite amounts across two accounts, at most once per row. */
export function pairAccountTransfers(rows: Transaction[], freshIds: Set<string>, categories: Category[]): Transaction[] {
  const next = new Map(rows.map((row) => [row.id, row]));
  const used = new Set<string>();
  const fresh = rows.filter((row) => freshIds.has(row.id));
  for (const row of fresh) {
    if (used.has(row.id) || !row.accountId || row.amount === 0) continue;
    const candidates = rows.filter((other) => {
      if (other.id === row.id || used.has(other.id)) return false;
      if (!other.accountId || other.accountId === row.accountId) return false;
      if (roundMoney(other.amount + row.amount) !== 0) return false;
      if (daysApart(row.date, other.date) > 3) return false;
      if (!hasMoveWord(row.description) && !hasMoveWord(other.description)) return false;
      return true;
    });
    if (!candidates.length) continue;
    candidates.sort((a, b) => daysApart(a.date, row.date) - daysApart(b.date, row.date) || a.id.localeCompare(b.id));
    const match = candidates[0];
    used.add(row.id);
    used.add(match.id);
    next.set(row.id, asTransfer(next.get(row.id) ?? row, categories));
    next.set(match.id, asTransfer(next.get(match.id) ?? match, categories));
  }
  return rows.map((row) => next.get(row.id) ?? row);
}

export type ImportRow = {
  date: string | null;
  description: string;
  amount: number | null;
  bankCategory?: string | null;
  memo?: string | null;
};

function blocks(
  existing: Pick<Transaction, "fingerprint" | "accountId">,
  fp: string,
  accountId: string | null | undefined,
): boolean {
  if (existing.fingerprint !== fp) return false;
  if (!accountId) return true;
  if (!existing.accountId) return true;
  return existing.accountId === accountId;
}

export function importNewRows(args: {
  rows: ImportRow[];
  sourceLabel: string;
  existing: Transaction[];
  categories: Category[];
  rules: MerchantRule[];
  incomeStreams?: IncomeStream[];
  bankLabelMap?: Record<string, string> | null;
  accountId?: string | null;
  createId?: () => string;
}): { added: Transaction[]; skipped: number; transactions: Transaction[] } {
  const accountId = args.accountId || null;
  const createId = args.createId ?? (() => `tx_${Math.random().toString(36).slice(2, 10)}`);
  const pool = args.existing.map((row) => ({ ...row }));
  const added: Transaction[] = [];
  let skipped = 0;
  for (const row of args.rows) {
    if (!row.date || row.amount == null || !row.description) {
      skipped += 1;
      continue;
    }
    const fp = fingerprint(row.date, row.amount, row.description);
    if (pool.some((t) => blocks(t, fp, accountId))) {
      skipped += 1;
      continue;
    }
    const key = merchantKey(row.description);
    const history = pool.map((t) => ({
      merchantKey: t.merchantKey,
      categoryId: t.categoryId,
      userSet: t.userSet,
      date: t.date,
      amount: t.amount,
      status: t.status,
    }));
    const sorted = sortCharge(
      {
        description: row.description,
        amount: row.amount,
        merchantKey: key,
        date: row.date,
        bankCategory: row.bankCategory,
        memo: row.memo,
      },
      {
        categories: args.categories,
        rules: args.rules,
        history,
        incomeStreams: args.incomeStreams,
        bankLabelMap: args.bankLabelMap,
      },
    );
    const memo = (row.memo ?? "").trim();
    const tx: Transaction = {
      id: createId(),
      date: row.date,
      description: row.description,
      merchantKey: key,
      amount: row.amount,
      sourceLabel: args.sourceLabel,
      fingerprint: fp,
      categoryId: sorted.categoryId,
      userSet: false,
      notes: memo && memo !== row.description.trim() ? memo : "",
      excluded: false,
      status: sorted.status,
      auto: sorted.auto,
      accountId,
      ...(row.bankCategory?.trim() ? { bankLabel: row.bankCategory.trim() } : {}),
    };
    pool.push(tx);
    added.push(tx);
  }
  const fresh = new Set(added.map((t) => t.id));
  const transactions = accountId ? pairAccountTransfers(pool, fresh, args.categories) : pool;
  const addedIds = fresh;
  return {
    added: transactions.filter((t) => addedIds.has(t.id)),
    skipped,
    transactions,
  };
}

/** Accept the guess. The category stays, the check mark goes away, and a bank label is remembered. */
export function applyConfirmAuto(
  transactions: Transaction[],
  ids: string[],
  profile: Profile,
): { transactions: Transaction[]; profile: Profile } {
  const wanted = new Set(ids);
  let nextProfile = profile;
  const next = transactions.map((row) => {
    if (!wanted.has(row.id) || !row.categoryId) return row;
    nextProfile = rememberBankLabel(nextProfile, row.bankLabel, row.categoryId);
    return { ...row, userSet: true, auto: null };
  });
  return { transactions: next, profile: nextProfile };
}

export function rememberBankLabel(profile: Profile, label: string | null | undefined, categoryId: string | null): Profile {
  const key = bankLabelKey(label ?? "");
  if (!key || !categoryId) return profile;
  const map = { ...(profile.bankLabelMap ?? {}) };
  if (map[key] === categoryId) return profile;
  map[key] = categoryId;
  return { ...profile, bankLabelMap: map };
}
