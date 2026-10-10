import { matchBankLabel } from "./bank-label.ts";
import { matchKeyword } from "./keywords.ts";
import { displayMerchant, merchantFamily } from "./merchant.ts";
import { roundMoney } from "./money.ts";
import { previewChange, sideOf, type Side } from "./sorting.ts";
import type { Category, MerchantRule, Transaction } from "./types.ts";

export type ReviewCandidate = {
  categoryId: string;
  reason: string;
  score: number;
};

export type ReviewGroup = {
  key: string;
  family: string;
  side: Side;
  displayName: string;
  merchantKeys: string[];
  count: number;
  total: number;
  impact: number;
  sample: Transaction[];
  ids: string[];
  candidates: ReviewCandidate[];
  /** How a default change would land, using the top suggestion. */
  preview: { changes: number; keptByHand: number };
};

export type QueueStats = {
  groups: number;
  charges: number;
  dollars: number;
  /** Share of unsorted dollars covered by the smallest set of names that reaches 60 percent, or by every name. */
  coveredShareOfFirstN: number;
  names: number;
};

function waiting(row: Transaction): boolean {
  if (row.excluded || row.status === "transfer" || row.status === "reimbursement") return false;
  if (!row.categoryId) return true;
  return Boolean(row.auto?.provisional) && !row.userSet;
}

function scoreHistory(
  rows: Transaction[],
  family: string,
  side: Side,
  amount: number,
  categories: Category[],
): ReviewCandidate | null {
  const past = rows.filter((row) => {
    if (!row.userSet || !row.categoryId) return false;
    if (sideOf(row) !== side) return false;
    if (merchantFamily(row.description) !== family && merchantFamily(row.merchantKey) !== family) return false;
    return categories.some((category) => category.id === row.categoryId);
  });
  if (!past.length) return null;
  const counts = new Map<string, { n: number; close: number }>();
  for (const row of past) {
    const id = row.categoryId as string;
    const cur = counts.get(id) ?? { n: 0, close: 0 };
    cur.n += 1;
    if (Math.abs(Math.abs(row.amount) - amount) <= Math.max(20, amount * 0.5)) cur.close += 1;
    counts.set(id, cur);
  }
  let best: { id: string; score: number; n: number } | null = null;
  for (const [id, tally] of counts) {
    const score = tally.n * 10 + tally.close * 4;
    if (!best || score > best.score) best = { id, score, n: tally.n };
  }
  if (!best) return null;
  const name = categories.find((category) => category.id === best.id)?.name ?? "that category";
  return {
    categoryId: best.id,
    score: best.score,
    reason: `Same as your last ${best.n} ${best.n === 1 ? "charge" : "charges"} from this name, filed under ${name}.`,
  };
}

function pushCandidate(list: ReviewCandidate[], next: ReviewCandidate | null) {
  if (!next) return;
  const existing = list.find((item) => item.categoryId === next.categoryId);
  if (!existing) {
    list.push(next);
    return;
  }
  if (next.score > existing.score) {
    existing.score = next.score;
    existing.reason = next.reason;
  }
}

/** Unsure charges and fair guesses, one name at a time, biggest dollars first. */
export function reviewQueue(
  transactions: Transaction[],
  categories: Category[],
  history?: Transaction[],
  rules: MerchantRule[] = [],
): ReviewGroup[] {
  const past = history ?? transactions;
  const open = transactions.filter(waiting);
  const groups = new Map<string, Transaction[]>();
  for (const row of open) {
    const family = merchantFamily(row.description);
    const side = sideOf(row);
    const key = `${family}|${side}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const out: ReviewGroup[] = [];
  for (const [key, rows] of groups) {
    const [family, side] = key.split("|") as [string, Side];
    const impact = roundMoney(rows.reduce((sum, row) => sum + Math.abs(row.amount), 0));
    const sample = [...rows].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 3);
    const lead = sample[0];
    const keys = [...new Set(rows.map((row) => row.merchantKey))];
    const candidates: ReviewCandidate[] = [];
    pushCandidate(candidates, scoreHistory(past, family, side, Math.abs(lead?.amount ?? 0), categories));
    const text = rows.map((row) => `${row.description} ${row.notes ?? ""}`).join(" ");
    const keyword = matchKeyword(text);
    if (keyword) {
      const category = categories.find((item) => item.slug === keyword.slug && (side === "out" ? item.kind === "expense" : item.kind === "income" || item.kind === "expense"));
      if (category) {
        pushCandidate(candidates, {
          categoryId: category.id,
          score: keyword.weak ? 6 : 9,
          reason: keyword.weak
            ? `The name often belongs in ${category.name}, but stores like this sell more than one thing.`
            : `The name looks like ${category.name}.`,
        });
      }
    }
    const label = rows.find((row) => row.bankLabel?.trim())?.bankLabel ?? "";
    const bank = label ? matchBankLabel(label, categories) : null;
    if (bank) {
      pushCandidate(candidates, {
        categoryId: bank.categoryId,
        score: 8,
        reason: bank.reason,
      });
    }
    const days = new Set(rows.map((row) => row.date));
    const sameDay = new Map<string, number>();
    for (const row of transactions) {
      if (!days.has(row.date) || !row.categoryId || rows.some((item) => item.id === row.id)) continue;
      if (sideOf(row) !== side) continue;
      sameDay.set(row.categoryId, (sameDay.get(row.categoryId) ?? 0) + 1);
    }
    let dayBest: { id: string; n: number } | null = null;
    for (const [id, n] of sameDay) {
      if (!dayBest || n > dayBest.n) dayBest = { id, n };
    }
    if (dayBest && dayBest.n >= 1) {
      const name = categories.find((category) => category.id === dayBest?.id)?.name;
      if (name) {
        pushCandidate(candidates, {
          categoryId: dayBest.id,
          score: 3 + dayBest.n,
          reason: `Other charges that day were ${name}.`,
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.reason.localeCompare(b.reason));
    const top = candidates[0];
    let changes = 0;
    let keptByHand = 0;
    if (top) {
      for (const merchantKey of keys) {
        const preview = previewChange({
          transactions,
          merchantRules: rules,
          merchantKey,
          side,
          categoryId: top.categoryId,
          scope: "default",
        });
        changes += preview.changes;
        keptByHand += preview.keptByHand;
      }
    }
    out.push({
      key,
      family,
      side,
      displayName: displayMerchant(lead?.description ?? family),
      merchantKeys: keys,
      count: rows.length,
      total: impact,
      impact,
      sample,
      ids: rows.map((row) => row.id),
      candidates: candidates.slice(0, 3),
      preview: { changes, keptByHand },
    });
  }
  out.sort((a, b) => b.impact - a.impact || a.displayName.localeCompare(b.displayName));
  return out;
}

/** How many names it takes to cover most of the unsorted dollars. */
export function queueStats(queue: ReviewGroup[]): QueueStats {
  const dollars = roundMoney(queue.reduce((sum, group) => sum + group.impact, 0));
  const charges = queue.reduce((sum, group) => sum + group.count, 0);
  if (!queue.length || dollars <= 0) {
    return { groups: queue.length, charges, dollars, coveredShareOfFirstN: 0, names: 0 };
  }
  let running = 0;
  let names = queue.length;
  for (let i = 0; i < queue.length; i++) {
    running += queue[i].impact;
    if (running / dollars >= 0.6) {
      names = i + 1;
      break;
    }
  }
  const covered = queue.slice(0, names).reduce((sum, group) => sum + group.impact, 0);
  return {
    groups: queue.length,
    charges,
    dollars,
    coveredShareOfFirstN: roundMoney(covered / dollars),
    names,
  };
}

export function coverSentence(stats: QueueStats): string {
  if (!stats.groups) return "Nothing left to sort.";
  return `${stats.charges} ${stats.charges === 1 ? "charge" : "charges"} to sort`;
}
