import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/budget/money";
import { coverSentence, queueStats, reviewQueue } from "@/lib/budget/review-queue";
import type { CategoryUndo } from "@/lib/budget/sorting";
import type { Transaction } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { CategorySelect } from "./category-select";
import { Button } from "./ui/button";

function prettyDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function SortQueue({
  onlyIds,
  onDone,
  doneLabel = "Done",
}: {
  /** When set, only these charges are in the queue. Omit to use the whole ledger. */
  onlyIds?: string[] | null;
  onDone?: () => void;
  doneLabel?: string;
}) {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const rules = useBudgetStore((s) => s.merchantRules);
  const setCategoryScoped = useBudgetStore((s) => s.setCategoryScoped);
  const setMerchantDefault = useBudgetStore((s) => s.setMerchantDefault);
  const confirmAuto = useBudgetStore((s) => s.confirmAuto);
  const restoreCategories = useBudgetStore((s) => s.restoreCategories);
  const [tab, setTab] = useState<"sort" | "checked">("sort");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [every, setEvery] = useState(true);
  const [undo, setUndo] = useState<CategoryUndo | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [started] = useState(() => {
    const rows = useBudgetStore.getState().transactions;
    const pool = onlyIds ? rows.filter((row) => onlyIds.includes(row.id)) : rows;
    return reviewQueue(pool, useBudgetStore.getState().categories, rows, useBudgetStore.getState().merchantRules);
  });

  const pool = useMemo(
    () => (onlyIds ? transactions.filter((row) => onlyIds.includes(row.id)) : transactions),
    [onlyIds, transactions],
  );
  const queue = useMemo(() => reviewQueue(pool, categories, transactions, rules), [pool, categories, transactions, rules]);
  const needsChoice = (group: { sample: { categoryId: string | null }[]; ids: string[] }) =>
    group.sample.some((row) => !row.categoryId) || group.ids.some((id) => pool.some((row) => row.id === id && !row.categoryId));
  const opening = started.filter((group) => group.sample.some((row) => !row.categoryId));
  const choice = queue.filter(needsChoice);
  const stats = queueStats(choice);
  const current = choice.find((group) => !skipped.includes(group.key));
  const checked = pool.filter((row) => row.auto?.provisional && row.categoryId && !row.userSet);
  const checkedGroups = new Map<string, Transaction[]>();
  for (const row of checked) {
    const name = categories.find((category) => category.id === row.categoryId)?.name ?? "Category";
    const list = checkedGroups.get(name) ?? [];
    list.push(row);
    checkedGroups.set(name, list);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      if (tab !== "sort" || !current) return;
      if (event.key === "1" || event.key === "2" || event.key === "3") {
        const pick = current.candidates[Number(event.key) - 1];
        if (pick) {
          event.preventDefault();
          choose(pick.categoryId);
        }
      } else if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        skip();
      } else if ((event.key === "z" || event.key === "Z") && undo) {
        event.preventDefault();
        restoreCategories(undo);
        setUndo(null);
        setNote("Undone.");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function remember(next: CategoryUndo | null, sentence: string) {
    setUndo(next);
    setNote(sentence);
    setEvery(true);
  }

  function choose(categoryId: string) {
    if (!current) return;
    if (every) {
      let combined: CategoryUndo = { rows: [], rules: null };
      for (const key of current.merchantKeys) {
        const part = setMerchantDefault(key, current.side, categoryId);
        if (!combined.rules) combined = { rows: [...part.rows], rules: part.rules };
        else combined.rows.push(...part.rows);
      }
      remember(combined, `Set ${current.displayName}.`);
    } else {
      const combined: CategoryUndo = { rows: [], rules: null };
      for (const id of current.ids) {
        const part = setCategoryScoped(id, categoryId, "charge");
        if (!part) continue;
        combined.rows.push(...part.rows);
      }
      remember(combined.rows.length ? combined : null, "Changed these charges, not the default.");
    }
  }

  function skip() {
    if (!current) return;
    setSkipped((list) => [...list, current.key]);
    setNote(null);
  }

  function accept(ids: string[], sentence: string) {
    const part = confirmAuto(ids);
    remember(part, sentence);
  }

  const empty = !current;
  const progress = opening.length ? Math.min(100, Math.round(((opening.length - choice.length) / opening.length) * 100)) : choice.length ? 0 : 100;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sorting">
        <button type="button" role="tab" aria-selected={tab === "sort"} className={`min-h-11 rounded-full px-3 text-sm ${tab === "sort" ? "bg-chip font-medium" : "text-muted"}`} onClick={() => setTab("sort")}>
          Still to sort
        </button>
        <button type="button" role="tab" aria-selected={tab === "checked"} className={`min-h-11 rounded-full px-3 text-sm ${tab === "checked" ? "bg-chip font-medium" : "text-muted"}`} onClick={() => setTab("checked")}>
          Checked for you{checked.length ? ` (${checked.length})` : ""}
        </button>
      </div>

      {tab === "checked" ? (
        <div className="space-y-3">
          {checked.length === 0 ? <p className="text-sm text-muted">Nothing is waiting on a check.</p> : null}
          {[...checkedGroups.entries()].map(([name, rows]) => (
            <div key={name} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{name}</p>
                <p className="text-sm text-muted">{rows.length} charges</p>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {rows.slice(0, 4).map((row) => (
                  <li key={row.id}>
                    {row.description} · {formatMoney(row.amount, { signed: true })}
                    {row.auto?.reason ? ` — ${row.auto.reason}` : ""}
                  </li>
                ))}
              </ul>
              <Button className="mt-3" size="sm" onClick={() => accept(rows.map((row) => row.id), `${name} looks right.`)}>
                Looks right
              </Button>
            </div>
          ))}
          {checked.length ? (
            <Button variant="outline" onClick={() => accept(checked.map((row) => row.id), "All of those look right.")}>
              Looks right for all
            </Button>
          ) : null}
        </div>
      ) : empty ? (
        <div>
          <h2 className="font-display text-xl font-semibold">{choice.length ? "Skipped for now." : "All set."}</h2>
          <p className="mt-1 text-sm text-muted">
            {choice.length
              ? `${choice.length} ${choice.length === 1 ? "name is" : "names are"} still unsorted.`
              : "Nothing in this list is still waiting on a category."}
          </p>
          {choice.length ? (
            <Button className="mt-3" variant="outline" onClick={() => setSkipped([])}>
              Look at those again
            </Button>
          ) : null}
          {onDone ? (
            <Button className="mt-3" onClick={onDone}>
              {doneLabel}
            </Button>
          ) : null}
        </div>
      ) : current ? (
        <div>
          <p className="text-sm">{coverSentence(stats)}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-chip" aria-hidden>
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-4 text-xs uppercase tracking-wide text-muted">
            {current.count} {current.count === 1 ? "charge" : "charges"} · {formatMoney(current.total)}
          </p>
          <h2 className="font-display text-2xl font-semibold">{current.displayName}</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {current.sample.map((row) => (
              <li key={row.id}>
                {prettyDate(row.date)} · {formatMoney(row.amount, { signed: true })} · {row.description}
              </li>
            ))}
          </ul>
          {current.preview.changes || current.preview.keptByHand ? (
            <p className="mt-2 text-sm text-muted">
              A choice for every charge from this name changes {current.preview.changes}. {current.preview.keptByHand} set by hand stay.
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            {current.candidates.map((candidate, i) => (
              <button
                key={candidate.categoryId}
                type="button"
                className="block w-full min-h-11 rounded-md border border-border px-3 py-2 text-left hover:border-primary"
                onClick={() => choose(candidate.categoryId)}
              >
                <span className="font-medium">{i + 1}. {categories.find((category) => category.id === candidate.categoryId)?.name ?? "Category"}</span>
                <span className="mt-1 block text-sm text-muted">{candidate.reason}</span>
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm text-muted">
            Pick another
            <CategorySelect
              categories={categories}
              value={null}
              kind={current.side === "in" ? "income" : "expense"}
              onChange={(id) => {
                if (id) choose(id);
              }}
            />
          </label>
          <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={every} onChange={(event) => setEvery(event.target.checked)} />
            Do this for every {current.displayName}
          </label>
          <button type="button" className="min-h-11 text-sm text-muted underline-offset-2 hover:underline" onClick={skip}>
            Skip for now
          </button>
          <p className="mt-2 text-xs text-muted">Keys: 1, 2, or 3 pick a choice. S skips. Z undoes.</p>
        </div>
      ) : null}

      {note ? (
        <p className="text-sm">
          {note}{" "}
          {undo ? (
            <button
              type="button"
              className="font-medium text-primary"
              onClick={() => {
                restoreCategories(undo);
                setUndo(null);
                setNote("Undone.");
              }}
            >
              Undo
            </button>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
