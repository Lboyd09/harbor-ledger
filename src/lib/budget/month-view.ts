import { monthKeyFromDate } from "./parse-date.ts";
import { categoryLabel, planAmount } from "./plans.ts";
import { roundMoney } from "./money.ts";
import type { Category, MonthBudget, Transaction } from "./types.ts";

export type MonthGroup = {
  id: string;
  name: string;
  plan: number;
  total: number;
  open: boolean;
  transactions: Transaction[];
};

export type MonthLayout = {
  income: MonthGroup[];
  expenses: MonthGroup[];
  aside: Transaction[];
  incomeTotal: number;
  expenseTotal: number;
  openCount: number;
};

function inMonth(t: Transaction, ym: string) {
  return monthKeyFromDate(t.date) === ym;
}

function cashPart(kind: "income" | "expense", t: Transaction) {
  if (t.status === "reimbursement") return 0;
  if (t.status === "refund") return kind === "expense" ? -Math.abs(t.amount) : 0;
  return kind === "income" ? t.amount : -t.amount;
}

function totalFor(kind: "income" | "expense", txs: Transaction[]) {
  return roundMoney(txs.reduce((s, t) => s + cashPart(kind, t), 0));
}

function byDate(a: Transaction, b: Transaction) {
  return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
}

export function groupMonth(
  transactions: Transaction[],
  categories: Category[],
  ym: string,
  budgets: MonthBudget[] = [],
): MonthLayout {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const incomeMap = new Map<string, Transaction[]>();
  const expenseMap = new Map<string, Transaction[]>();
  const aside: Transaction[] = [];

  for (const t of transactions) {
    if (!inMonth(t, ym)) continue;
    if (t.excluded || t.status === "transfer") {
      aside.push(t);
      continue;
    }
    if (t.status === "refund") {
      const cat = t.categoryId ? byId.get(t.categoryId) : undefined;
      const id = cat && cat.kind === "expense" ? cat.id : "__refund__";
      const list = expenseMap.get(id) ?? [];
      list.push(t);
      expenseMap.set(id, list);
      continue;
    }
    const cat = t.categoryId ? byId.get(t.categoryId) : undefined;
    if (!cat) {
      const bucket = t.amount >= 0 ? incomeMap : expenseMap;
      const list = bucket.get("") ?? [];
      list.push(t);
      bucket.set("", list);
      continue;
    }
    const bucket = cat.kind === "income" ? incomeMap : expenseMap;
    const list = bucket.get(cat.id) ?? [];
    list.push(t);
    bucket.set(cat.id, list);
  }

  function build(kind: "income" | "expense", map: Map<string, Transaction[]>): MonthGroup[] {
    const groups: MonthGroup[] = [];
    for (const [id, txs] of map) {
      txs.sort(byDate);
      if (!id || id === "__refund__") {
        groups.push({
          id: id === "__refund__" ? "money-back" : `${kind}-open`,
          name: id === "__refund__" ? "Money a store gave back" : "Needs a category",
          plan: 0,
          total: totalFor(kind, txs),
          open: id !== "__refund__",
          transactions: txs,
        });
        continue;
      }
      const cat = byId.get(id);
      groups.push({
        id,
        name: cat ? categoryLabel(categories, cat.id) : "Category",
        plan: cat ? planAmount(cat, ym, budgets) : 0,
        total: totalFor(kind, txs),
        open: false,
        transactions: txs,
      });
    }
    groups.sort((a, b) => Number(b.open) - Number(a.open) || Math.abs(b.total) - Math.abs(a.total));
    return groups;
  }

  const income = build("income", incomeMap);
  const expenses = build("expense", expenseMap);
  aside.sort(byDate);
  const incomeTotal = roundMoney(income.reduce((s, g) => s + g.total, 0));
  const expenseTotal = roundMoney(expenses.reduce((s, g) => s + g.total, 0));
  const openCount = [...income, ...expenses].filter((g) => g.open).reduce((s, g) => s + g.transactions.length, 0);

  return { income, expenses, aside, incomeTotal, expenseTotal, openCount };
}
