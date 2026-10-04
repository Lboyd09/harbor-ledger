import { useState } from "react";
import { formatMoney } from "@/lib/budget/money";
import type { Category, Transaction } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { SortQueue } from "./sort-queue";

function isSorted(row: Transaction): boolean {
  return Boolean(row.categoryId) || row.status === "transfer";
}

function groupName(row: Transaction, categories: Category[]): string {
  if (row.categoryId) return categories.find((category) => category.id === row.categoryId)?.name ?? "Category";
  if (row.status === "transfer") return "Transfers";
  return "Sorted";
}

export function ImportReview({ addedIds, skipped }: { addedIds: string[]; skipped: number }) {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const rows = addedIds
    .map((id) => transactions.find((row) => row.id === id))
    .filter((row): row is Transaction => Boolean(row));
  const [headline] = useState(() => {
    const all = useBudgetStore.getState().transactions;
    const imported = addedIds.map((id) => all.find((row) => row.id === id)).filter((row): row is Transaction => Boolean(row));
    return { sorted: imported.filter(isSorted).length, total: imported.length };
  });

  if (headline.total === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
        <p>Nothing new. Those rows were already in this account.</p>
        {skipped ? <p className="text-muted">Skipped {skipped} that {skipped === 1 ? "was" : "were"} already there.</p> : null}
      </div>
    );
  }

  const groups = new Map<string, Transaction[]>();
  for (const row of rows.filter(isSorted)) {
    const name = groupName(row, categories);
    const list = groups.get(name) ?? [];
    list.push(row);
    groups.set(name, list);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">
          We sorted {headline.sorted} of {headline.total} for you.
        </h2>
        <p className="mt-1 text-sm text-muted">
          Fair guesses are marked Check. Only names with no good guess wait.
          {skipped ? ` Skipped ${skipped} that ${skipped === 1 ? "was" : "were"} already in this account.` : ""}
        </p>
      </div>
      <SortQueue onlyIds={addedIds} />
      <details className="rounded-lg border border-border bg-surface px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">See what was sorted</summary>
        <ul className="mt-3 space-y-3">
          {[...groups.entries()].map(([name, list]) => (
            <li key={name}>
              <p className="font-medium">
                {name} · {list.length} · {formatMoney(list.reduce((sum, row) => sum + row.amount, 0), { signed: true })}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-muted">
                {list.slice(0, 6).map((row) => (
                  <li key={row.id}>
                    {row.description}
                    {row.auto?.reason ? ` — ${row.auto.reason}` : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
