import { YourMoney } from "../grow-pictures";
import { EmptyArt } from "../visuals/empty-art";
import { Button } from "../ui/button";
import { Link } from "@tanstack/react-router";
import { useGrow } from "./grow-context";
import type { GrowPage } from "./session-state";

const TILES: { id: GrowPage; label: string; hint: string }[] = [
  { id: "retire", label: "Plan for retirement", hint: "Where you stand, and the gap." },
  { id: "work", label: "Grow money I have", hint: "One amount, left alone." },
  { id: "goal", label: "Save for something", hint: "What to set aside each month." },
  { id: "cushion", label: "Keep a cushion", hint: "Months of spending, in cash." },
  { id: "debt", label: "Pay down debt", hint: "Highest rate, or smallest balance." },
];

export function Overview() {
  const { setPage, accounts, balances, netWorth, transactions } = useGrow();
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold">What do you want to do?</h2>
      {!transactions.length && accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
          <EmptyArt kind="grow" />
          <p className="text-sm">Add a file, or type numbers.</p>
          <Link to="/import" className="mt-3 inline-flex">
            <Button>Add your first bank file</Button>
          </Link>
        </div>
      ) : (
        <YourMoney accounts={accounts} balances={balances} netWorth={netWorth} />
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => setPage(tile.id)}
            className="min-h-16 rounded-lg border border-border bg-surface px-3 py-2 text-left hover:bg-chip"
          >
            <div className="text-sm font-medium">{tile.label}</div>
            <div className="text-xs text-muted">{tile.hint}</div>
          </button>
        ))}
      </div>

    </div>
  );
}
