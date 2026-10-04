import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney, roundMoney } from "@/lib/budget/money";
import type { Category, Transaction } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { CategorySelect } from "./category-select";
import { ReadoutCard } from "./readout-card";
import { Button } from "./ui/button";

function prettyDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isSorted(t: Transaction): boolean {
  return t.auto?.confidence === "sure" || t.status === "transfer" || Boolean(t.categoryId);
}

function groupName(t: Transaction, categories: Category[]): string {
  if (t.categoryId) return categories.find((c) => c.id === t.categoryId)?.name ?? "Category";
  if (t.status === "transfer") return "Transfers";
  return "Sorted";
}

export function ImportReview({ addedIds, skipped }: { addedIds: string[]; skipped: number }) {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const rows = addedIds
    .map((id) => transactions.find((t) => t.id === id))
    .filter((t): t is Transaction => Boolean(t));
  const [headline] = useState(() => {
    const all = useBudgetStore.getState().transactions;
    const imported = addedIds
      .map((id) => all.find((t) => t.id === id))
      .filter((t): t is Transaction => Boolean(t));
    return {
      sorted: imported.filter(isSorted).length,
      total: imported.length,
    };
  });
  const [queue] = useState<string[]>(() => {
    const all = useBudgetStore.getState().transactions;
    return addedIds.filter((id) => {
      const t = all.find((row) => row.id === id);
      return t && !isSorted(t);
    });
  });
  const [cursor, setCursor] = useState(0);
  const [forEvery, setForEvery] = useState(true);

  if (headline.total === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
        <p>Nothing new. Those rows were already in this account.</p>
        {skipped ? (
          <p className="text-muted">
            Skipped {skipped} that {skipped === 1 ? "was" : "were"} already there.
          </p>
        ) : null}
      </div>
    );
  }

  const sortedRows = rows.filter(isSorted);
  const groups = new Map<string, Transaction[]>();
  for (const row of sortedRows) {
    const name = groupName(row, categories);
    const list = groups.get(name) ?? [];
    list.push(row);
    groups.set(name, list);
  }
  const grouped = [...groups.entries()].sort(
    (a, b) => Math.abs(b[1].reduce((sum, t) => sum + t.amount, 0)) - Math.abs(a[1].reduce((sum, t) => sum + t.amount, 0)),
  );

  const currentId = queue[cursor];
  const current = currentId ? transactions.find((t) => t.id === currentId) : undefined;
  const suggestion = current?.auto?.suggestedCategoryId
    ? categories.find((c) => c.id === current.auto?.suggestedCategoryId)
    : undefined;
  const done = cursor >= queue.length;

  function accept(categoryId: string) {
    if (!current) return;
    setTransactionCategory(current.id, categoryId, forEvery);
    setForEvery(true);
    setCursor((n) => n + 1);
  }

  return (
    <div className="space-y-5">
      <ReadoutCard transactions={rows} categories={categories} title="From this file" />
      <div>
        <h2 className="font-display text-2xl font-semibold">
          We sorted {headline.sorted} of {headline.total} charges for you.
        </h2>
        <p className="mt-1 text-sm text-muted">
          {queue.length
            ? "The ones we were sure about are grouped below. The rest take one tap."
            : "Nothing needs a look. Everything in this file was sorted."}
          {skipped
            ? ` Skipped ${skipped} that ${skipped === 1 ? "was" : "were"} already in this account.`
            : ""}
        </p>
      </div>

      {grouped.length ? (
        <section className="space-y-2">
          <h3 className="font-display text-lg font-semibold">Sorted for you</h3>
          {grouped.map(([name, list]) => (
            <details key={name} className="rounded-lg border border-border bg-surface">
              <summary className="cursor-pointer px-3 py-3 text-sm">
                <span className="font-medium">{name}</span>
                <span className="text-muted">
                  {" "}
                  · {list.length} · {formatMoney(roundMoney(list.reduce((sum, t) => sum + t.amount, 0)), { signed: true })}
                </span>
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {list.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{displayMerchant(t.description)}</span>
                      <span className="text-muted"> · {prettyDate(t.date)}</span>
                    </span>
                    <span className="tabular">{formatMoney(t.amount, { signed: true })}</span>
                    <span className="text-muted">Change</span>
                    <CategorySelect
                      categories={categories}
                      value={t.categoryId}
                      className="max-w-xs"
                      onChange={(id) => setTransactionCategory(t.id, id, false)}
                    />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      ) : null}

      {queue.length === 0 ? <DoneLinks /> : null}

      {queue.length > 0 && !done && current ? (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-semibold">Needs a look ({queue.length})</h3>
            <span className="text-sm text-muted">
              {cursor + 1} of {queue.length}
            </span>
          </div>
          <p className="font-display text-xl font-semibold">{displayMerchant(current.description)}</p>
          <p className="text-sm text-muted">
            {prettyDate(current.date)} · {formatMoney(current.amount, { signed: true })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {suggestion ? (
              <Button onClick={() => accept(suggestion.id)}>Yes, {suggestion.name}</Button>
            ) : null}
            <CategorySelect
              categories={categories}
              value={null}
              emptyLabel="Pick another"
              className="max-w-xs"
              onChange={(id) => {
                if (id) accept(id);
              }}
            />
            <Button
              variant="ghost"
              onClick={() => {
                setForEvery(true);
                setCursor((n) => n + 1);
              }}
            >
              Skip for now
            </Button>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={forEvery} onChange={(e) => setForEvery(e.target.checked)} />
            Do this for every {displayMerchant(current.description)}
          </label>
        </section>
      ) : null}

      {queue.length > 0 && done ? (
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <h3 className="font-display text-lg font-semibold">All set</h3>
          <p className="text-sm text-muted">You can change any of them later.</p>
          <DoneLinks />
        </section>
      ) : null}
    </div>
  );
}

function DoneLinks() {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <Link to="/" className="font-medium text-primary">
        Open this month
      </Link>
      <Link to="/year" className="font-medium text-primary">
        See the year
      </Link>
    </div>
  );
}
