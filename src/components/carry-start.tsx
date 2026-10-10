import { useState } from "react";
import { earliestDataMonth } from "@/lib/budget/ledger-month";
import { monthLabel } from "@/lib/budget/parse-date";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";

/** Where leftovers begin. Changing it never deletes a charge. */
export function CarryStartControl() {
  const transactions = useBudgetStore((s) => s.transactions);
  const current = useBudgetStore((s) => s.profile.carryStartMonth);
  const asked = useBudgetStore((s) => s.profile.carryAskSeen);
  const ym = useBudgetStore((s) => s.activeMonth);
  const patchProfile = useBudgetStore((s) => s.patchProfile);
  const first = earliestDataMonth(transactions);
  const [previous, setPrevious] = useState<string | null | undefined>(undefined);
  if (!first) return null;
  const thisMonth = /^\d{4}-\d{2}$/.test(ym) ? ym : first;

  function choose(next: string) {
    setPrevious(current ?? null);
    patchProfile({ carryStartMonth: next });
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-lg font-semibold">When leftovers start</h2>
      <p className="mt-1 text-sm text-muted">Nothing is deleted.</p>
      {current ? <p className="mt-1 text-sm">Leftovers start in {monthLabel(current)}.</p> : null}
      {first && current && first < current && asked !== first ? (
        <div className="mt-3 rounded-md border border-border bg-bg p-3 text-sm">
          <p>A file reaches back to {monthLabel(first)}, before leftovers start. Move the start?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setPrevious(current); patchProfile({ carryStartMonth: first, carryAskSeen: first }); }}>
              Move it
            </Button>
            <Button size="sm" variant="outline" onClick={() => patchProfile({ carryAskSeen: first })}>
              Leave it
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          aria-pressed={current === first}
          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm ${current === first ? "border-primary bg-chip" : "border-border"}`}
          onClick={() => choose(first)}
        >
          Start from {monthLabel(first)}, the first month of your file
        </button>
        <button
          type="button"
          aria-pressed={current === thisMonth && thisMonth !== first}
          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm ${current === thisMonth && current !== first ? "border-primary bg-chip" : "border-border"}`}
          onClick={() => choose(thisMonth)}
        >
          Start from this month
        </button>
      </div>
      {previous !== undefined ? (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm" role="status">
          <span>Leftovers now start in {current ? monthLabel(current) : "no month"}.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              patchProfile({ carryStartMonth: previous });
              setPrevious(undefined);
            }}
          >
            Undo
          </Button>
        </p>
      ) : null}
    </section>
  );
}
