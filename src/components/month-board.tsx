import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { bucketBalance, safeToSpend } from "@/lib/budget/buckets";
import { formatMoney } from "@/lib/budget/money";
import { groupMonth } from "@/lib/budget/month-view";
import { useBudgetStore } from "@/store/budget-store";
import { CategorizeCoach } from "./categorize-coach";
import { queueFundWizard } from "./fund-wizard";
import { MonthPage } from "./month-page";
import { Button } from "./ui/button";

const NO_BUDGETS: never[] = [];

function HomeTop({
  amount,
  openCount,
  coach,
  setCoach,
}: {
  amount: number;
  openCount: number;
  coach: boolean;
  setCoach: (next: boolean) => void;
}) {
  const [why, setWhy] = useState(false);
  const funds = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const ym = useBudgetStore((s) => s.activeMonth);
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold md:text-4xl">Safe to spend: {formatMoney(amount, { signed: true })}</h1>
        <button type="button" className="min-h-11 min-w-11 rounded-full border border-border text-sm" aria-expanded={why} aria-label="What does safe to spend mean?" onClick={() => setWhy((v) => !v)}>
          ?
        </button>
      </div>
      {why ? (
        <p className="text-sm text-muted">Income so far, minus this month’s amounts, minus what goes into funds, minus spending that is not already counted.</p>
      ) : null}
      {coach ? (
        <CategorizeCoach onClose={() => setCoach(false)} />
      ) : openCount > 0 ? (
        <section className="rounded-lg border border-primary/40 bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Needs a look</h2>
          <p className="mt-1 text-sm text-muted">{openCount} charge{openCount === 1 ? "" : "s"} have no category.</p>
          <Button className="mt-3" onClick={() => setCoach(true)}>Put them in categories</Button>
        </section>
      ) : null}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Funds</h2>
          <Link to="/funds" className="text-sm font-medium text-primary">See all</Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {funds.map((fund) => (
            <Link key={fund.id} to="/funds" className="min-w-36 rounded-lg border border-border bg-surface p-3">
              <div className="text-sm text-muted">{fund.name}</div>
              <div className="font-display text-xl tabular">{formatMoney(bucketBalance(fund, ym, transactions, categories, moves))}</div>
            </Link>
          ))}
          <Link to="/funds" className="flex min-w-36 items-center rounded-lg border border-dashed border-line p-3 text-sm" onClick={() => queueFundWizard()}>
            Add a fund
          </Link>
        </div>
      </div>
      <Link to="/year" className="block rounded-lg border border-border bg-surface p-4">
        <div className="font-medium">Look back</div>
        <p className="text-sm text-muted">The calendar year, one month at a time. Charts and a spreadsheet are there too.</p>
      </Link>
    </div>
  );
}

export function MonthBoard() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets);
  const budgets = monthBudgets ?? NO_BUDGETS;
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const bucketMoves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const [coach, setCoach] = useState(false);
  const layout = useMemo(() => groupMonth(transactions, categories, ym, budgets), [transactions, categories, ym, budgets]);
  const safe = safeToSpend({ ym, transactions, categories, budgets, buckets: moneyBuckets, moves: bucketMoves });
  return (
    <div className="space-y-6">
      <HomeTop amount={safe.amount} openCount={layout.openCount} coach={coach} setCoach={setCoach} />
      <MonthPage titleAs="h2" />
    </div>
  );
}
