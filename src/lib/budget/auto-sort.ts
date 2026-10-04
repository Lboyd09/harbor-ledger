import { matchBankLabel } from "./bank-label.ts";
import { matchKeyword, SLUG_FALLBACKS } from "./keywords.ts";
import { fingerprint } from "./fingerprint.ts";
import { merchantKey, merchantNormalized } from "./merchant.ts";
import { roundMoney } from "./money.ts";
import type {
  Category,
  IncomeStream,
  MerchantRule,
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
    return { source: "rule", confidence: "sure", suggestedCategoryId: rule.categoryId };
  }

  const side = sideOf(amount);
  const past = history.filter((t) => {
    if (!t.userSet || t.merchantKey !== key || !t.categoryId) return false;
    if (!categories.some((c) => c.id === t.categoryId)) return false;
    const pastSide = sideOf(t.amount, t.status);
    return pastSide === "any" || pastSide === side;
  });
  if (past.length) {
    const counts = new Map<string, { n: number; date: string }>();
    for (const row of past) {
      const id = row.categoryId as string;
      const cur = counts.get(id) ?? { n: 0, date: "" };
      cur.n += 1;
      if (row.date > cur.date) cur.date = row.date;
      counts.set(id, cur);
    }
    const ranked = [...counts.entries()].sort(
      (a, b) => b[1].n - a[1].n || b[1].date.localeCompare(a[1].date),
    );
    const top = ranked[0][0];
    const agrees = ranked.length === 1;
    return {
      source: "history",
      confidence: agrees ? "sure" : "unsure",
      suggestedCategoryId: top,
    };
  }

  const label = (bankCategory ?? "").trim();
  if (label) {
    const hit = matchBankLabel(label, categories);
    const cat = hit ? categories.find((item) => item.id === hit.categoryId) : undefined;
    const signOk =
      !!cat &&
      (amount < 0
        ? cat.kind === "expense" || cat.slug === "transfers-out"
        : cat.kind === "income" || cat.slug === "transfers-out");
    if (hit && cat && signOk) {
      return {
        source: "bank",
        confidence: "sure",
        suggestedCategoryId: cat.id,
        reason: hit.reason,
        refund: amount > 0 && cat.kind === "expense",
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
    if (best) return { source: "income", confidence: "sure", suggestedCategoryId: best.id };

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
      if (closest) return { source: "income", confidence: "likely", suggestedCategoryId: closest.id };
    }
  }

  const hit = matchKeyword(text);
  if (hit) {
    const cat = resolveSlug(hit.slug, categories);
    if (!cat) {
      const other = categories.find((c) => c.slug === "other");
      return { source: "keyword", confidence: "unsure", suggestedCategoryId: other?.id ?? null };
    }
    if (amount < 0 && cat.kind === "income") {
      const spend = resolveSlug("personal", categories) ?? resolveSlug("other", categories);
      if (!spend) return { source: "keyword", confidence: "unsure", suggestedCategoryId: null };
      return { source: "keyword", confidence: "sure", suggestedCategoryId: spend.id };
    }
    const refund = amount > 0 && cat.kind === "expense";
    return {
      source: "keyword",
      confidence: hit.weak ? "likely" : "sure",
      suggestedCategoryId: cat.id,
      refund,
    };
  }

  const seen = history.filter((t) => t.merchantKey === key);
  if (seen.length) {
    const months = new Set(seen.map((t) => t.date.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)));
    if (date && /^\d{4}-\d{2}/.test(date)) months.add(date.slice(0, 7));
    if (months.size >= 3 && !seen.some((t) => t.categoryId)) {
      return { source: "repeat", confidence: "unsure", suggestedCategoryId: null };
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
  const categoryId = decision.confidence === "sure" ? decision.suggestedCategoryId : null;
  let status: TxStatus = "posted";
  if (categoryId) {
    const cat = ctx.categories.find((c) => c.id === categoryId);
    if (cat?.slug === "transfers-out") status = "transfer";
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
