import { useMemo, useState } from "react";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney } from "@/lib/budget/money";
import { monthShort } from "@/lib/budget/parse-date";
import type { Category } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";

function needsCategory(t: { categoryId: string | null; excluded: boolean; status: string }) {
  return !t.categoryId && !t.excluded && t.status !== "transfer" && t.status !== "reimbursement";
}

export function CategorizeCoach({ onClose, doneLabel = "Back to the month" }: { onClose: () => void; doneLabel?: string }) {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const setMerchantCategory = useBudgetStore((s) => s.setMerchantCategory);
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const [also, setAlso] = useState(true);
  const [started] = useState(() => transactions.filter(needsCategory).length);

  const left = useMemo(() => transactions.filter(needsCategory), [transactions]);
  const current = left[0];
  const done = started === 0 ? 1 : Math.min(1, (started - left.length) / started);

  if (!current) {
    return (
      <section className="rounded-lg border border-primary/40 bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Every row has a category.</h2>
        <p className="mt-1 text-sm text-muted">Income and spending on this month now know where the money went.</p>
        <Button className="mt-3" onClick={onClose}>
          {doneLabel}
        </Button>
      </section>
    );
  }

  const incoming = current.amount > 0;
  const choices = categories.filter((c) => c.kind === (incoming ? "income" : "expense") && !c.parentId);
  const name = displayMerchant(current.description);

  function pick(cat: Category) {
    if (also) setMerchantCategory(current.merchantKey, cat.id);
    else setTransactionCategory(current.id, cat.id, false);
    setAlso(true);
  }

  return (
    <section className="rounded-lg border border-primary/40 bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Where did this go?</h2>
        <button type="button" className="text-sm text-muted" onClick={onClose}>
          Stop for now
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        {left.length} still need a category. Tap one. If the box stays checked, every other charge from this name gets the same category.
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-chip">
        <div className="h-full bg-primary" style={{ width: `${Math.round(done * 100)}%` }} />
      </div>
      <div className="mt-4">
        <div className="text-xs uppercase tracking-wide text-muted">
          {monthShort(current.date.slice(0, 7))} {Number(current.date.slice(8, 10))}
        </div>
        <div className="font-display text-2xl font-semibold">{name}</div>
        <div className={`mt-1 font-display text-xl tabular ${incoming ? "text-good" : ""}`}>
          {formatMoney(current.amount, { signed: true })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c)}
            className="min-h-11 rounded-full border border-border bg-bg px-3 text-sm hover:border-primary hover:bg-chip"
          >
            {c.name}
          </button>
        ))}
      </div>
      <label className="mt-4 flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} />
        Use this for every {name}
      </label>
      <button type="button" className="mt-2 text-sm text-muted underline-offset-2 hover:underline" onClick={() => patchTransaction(current.id, { excluded: true })}>
        Skip — leave this one out of the budget
      </button>
    </section>
  );
}
