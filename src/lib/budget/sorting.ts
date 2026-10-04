import { replaceMerchantRule } from "./categorize.ts";
import type { MerchantRule, Transaction, TransactionAuto, TxSplit } from "./types.ts";

export type Side = "in" | "out";
export type ChangeScope = "charge" | "month" | "default";
export type Pin = "charge" | "month";

/** One row, as it was before a category change, so Undo can put it back. */
export type RowBefore = {
  id: string;
  categoryId: string | null;
  userSet: boolean;
  pinned: Pin | null;
  splits: TxSplit[] | null;
  auto: TransactionAuto | null;
};

export type ChangePreview = {
  changes: number;
  keptByHand: number;
  skippedDivided: number;
};

export type CategoryUndo = {
  rows: RowBefore[];
  rules: MerchantRule[] | null;
};

export type AppliedChange = {
  transactions: Transaction[];
  merchantRules: MerchantRule[];
  before: RowBefore[];
  rulesBefore: MerchantRule[] | null;
  preview: ChangePreview;
};

export type ChangeInput = {
  transactions: Transaction[];
  merchantKey: string;
  side: Side;
  ym?: string;
  categoryId: string | null;
  scope: ChangeScope;
  /** Required when scope is "charge". */
  id?: string;
  includePinned?: boolean;
  merchantRules?: MerchantRule[];
};

/** Out for a negative amount or a refund. Same rule the category actions use. */
export function sideOf(t: Pick<Transaction, "amount" | "status">): Side {
  return t.amount < 0 || t.status === "refund" ? "out" : "in";
}

export function isDivided(t: Pick<Transaction, "splits">): boolean {
  return Boolean(t.splits && t.splits.length >= 2);
}

/** Side-specific rule wins. A rule with no side still applies. */
export function ruleFor(rules: MerchantRule[], merchantKey: string, side: Side): MerchantRule | undefined {
  return (
    rules.find((rule) => rule.merchantKey === merchantKey && rule.side === side) ??
    rules.find((rule) => rule.merchantKey === merchantKey && !rule.side)
  );
}

function sameName(t: Transaction, merchantKey: string, side: Side): boolean {
  return t.merchantKey === merchantKey && sideOf(t) === side;
}

function handSet(t: Transaction): boolean {
  return t.pinned === "charge" || t.pinned === "month";
}

type Target = { row: Transaction; reason: "change" | "kept" | "divided" };

function targets(input: ChangeInput): Target[] {
  const { transactions, merchantKey, side, scope, ym, id, includePinned } = input;
  if (scope === "charge") {
    const row = id ? transactions.find((t) => t.id === id) : undefined;
    if (!row || !sameName(row, merchantKey, side)) return [];
    return [{ row, reason: "change" }];
  }
  const rows = transactions.filter((t) => {
    if (!sameName(t, merchantKey, side)) return false;
    if (scope === "month") return Boolean(ym) && t.date.slice(0, 7) === ym;
    return true;
  });
  return rows.map((row) => {
    if (scope === "month" && isDivided(row)) return { row, reason: "divided" as const };
    if (scope === "default" && handSet(row) && !includePinned) return { row, reason: "kept" as const };
    return { row, reason: "change" as const };
  });
}

export function previewChange(input: ChangeInput): ChangePreview {
  const list = targets(input);
  return {
    changes: list.filter((item) => item.reason === "change").length,
    keptByHand: list.filter((item) => item.reason === "kept").length,
    skippedDivided: list.filter((item) => item.reason === "divided").length,
  };
}

export function captureRow(t: Transaction): RowBefore {
  return {
    id: t.id,
    categoryId: t.categoryId,
    userSet: t.userSet,
    pinned: t.pinned === "charge" || t.pinned === "month" ? t.pinned : null,
    splits: t.splits ?? null,
    auto: t.auto ?? null,
  };
}

function writeRow(t: Transaction, categoryId: string | null, pinned: Pin | null): Transaction {
  return { ...t, categoryId, userSet: true, pinned, auto: null };
}

export function applyChange(input: ChangeInput): AppliedChange {
  const list = targets(input);
  const preview = previewChange(input);
  const changing = new Map(list.filter((item) => item.reason === "change").map((item) => [item.row.id, item.row]));
  const before = [...changing.values()].map(captureRow);
  const pin: Pin | null = input.scope === "charge" ? "charge" : input.scope === "month" ? "month" : null;
  const transactions = input.transactions.map((t) =>
    changing.has(t.id) ? writeRow(t, input.categoryId, pin) : t,
  );
  const rules = input.merchantRules ?? [];
  let merchantRules = rules;
  let rulesBefore: MerchantRule[] | null = null;
  if (input.scope === "default") {
    rulesBefore = rules.map((rule) => ({ ...rule }));
    merchantRules = replaceMerchantRule(rules, input.merchantKey, input.categoryId, input.side);
  }
  return { transactions, merchantRules, before, rulesBefore, preview };
}

export function restoreChanges(transactions: Transaction[], before: RowBefore[]): Transaction[] {
  const map = new Map(before.map((row) => [row.id, row]));
  return transactions.map((t) => {
    const prev = map.get(t.id);
    if (!prev) return t;
    return {
      ...t,
      categoryId: prev.categoryId,
      userSet: prev.userSet,
      pinned: prev.pinned,
      splits: prev.splits,
      auto: prev.auto,
    };
  });
}

/** Back to the name's default. No rule means no category. */
export function resetToDefault(t: Transaction, rules: MerchantRule[]): Transaction {
  const rule = ruleFor(rules, t.merchantKey, sideOf(t));
  return {
    ...t,
    categoryId: rule?.categoryId ?? null,
    userSet: false,
    pinned: null,
    auto: null,
  };
}
