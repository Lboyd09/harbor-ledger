import { useMemo, useState } from "react";
import { monthEndForecast } from "@/lib/budget/analytics";
import { recurringBills } from "@/lib/budget/analytics-depth";
import { monthLedger } from "@/lib/budget/ledger-month";
import { formatMoney } from "@/lib/budget/money";
import { monthLabel } from "@/lib/budget/parse-date";
import { comingUp, monthStrip, paceSentence } from "@/lib/budget/screen-plan";
import { useBudgetStore } from "@/store/budget-store";
import { AmountsPage } from "./budget-amounts";
import { TransactionsPage } from "./budget-transactions";
import { LeftoversCard } from "./category-panel";
import { BudgetMenu } from "./page-menu";
import { CarryStartControl } from "./carry-start";
import { CategorizeCoach } from "./categorize-coach";
import { MonthSwitcher } from "./month-switcher";
import { Button } from "./ui/button";

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function BudgetView({ page }: { page: "month" | "amounts" | "transactions" }) {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const budgets = useBudgetStore((s) => s.monthBudgets);
  const buckets = useBudgetStore((s) => s.moneyBuckets);
  const moves = useBudgetStore((s) => s.bucketMoves);
  const setAsides = useBudgetStore((s) => s.setAsides);
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const carryStartMonth = useBudgetStore((s) => s.profile.carryStartMonth);
  const ledger = useMemo(
    () => monthLedger({ transactions, categories, budgets: budgets ?? [], buckets: buckets ?? [], moves: moves ?? [], setAsides: setAsides ?? [], style, carryStartMonth }, ym),
    [transactions, categories, budgets, buckets, moves, setAsides, style, carryStartMonth, ym],
  );
  const forecast = useMemo(
    () => monthEndForecast({ transactions, categories, ym, today: todayIso(), budgets: budgets ?? [] }),
    [transactions, categories, ym, budgets],
  );
  const strip = monthStrip({ forecast, incomeSoFar: ledger.totals.received, incomeStill: null });
  const today = todayIso();
  const stillComing = page === "month" ? comingUp(recurringBills(transactions, categories, today), today, 45)?.filter((item) => item.status !== "active" || item.nextDate.startsWith(ym)) ?? null : null;
  const [coach, setCoach] = useState(false);
  const [fundsOpen, setFundsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <BudgetMenu page={page} />
        <MonthSwitcher compact={page !== "month"} />
      </div>
      <p className="text-sm text-muted">{monthLabel(ym)}</p>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="This month">
        <Strip label="Received" value={formatMoney(ledger.totals.received)} />
        <Strip label="Spent" value={formatMoney(ledger.totals.spent)} />
        <button type="button" className="rounded-lg border border-border bg-surface px-3 py-3 text-left" onClick={() => setFundsOpen((open) => !open)} aria-expanded={fundsOpen}>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Saved to funds</div>
          <div className="mt-1 font-display text-xl tabular">{formatMoney(ledger.totals.savedToFunds)}</div>
        </button>
        <Strip label="Left" value={formatMoney(ledger.totals.leftOver, { signed: true })} />
      </section>
      {fundsOpen ? (
        <ul className="space-y-1 text-sm">
          {ledger.funds.length ? (
            ledger.funds.map((fund) => (
              <li key={fund.id}>
                {fund.name}: {formatMoney(fund.funding)} funding, {formatMoney(fund.setAsides)} set aside
              </li>
            ))
          ) : (
            <li className="text-muted">Nothing put into a fund this month.</li>
          )}
        </ul>
      ) : null}
      {ledger.fundMoves !== 0 ? (
        <p className="text-sm text-muted">{formatMoney(ledger.fundMoves)} moved between funds, not counted as new savings.</p>
      ) : null}
      {page === "month" ? <LeftoversCard /> : null}
      {strip.ready ? (
        <p className="text-sm text-muted">
          {paceSentence(forecast)} The month ends around {formatMoney(strip.expected ?? 0)}.
        </p>
      ) : null}
      <CarryStartControl />
      {page === "month" && stillComing && stillComing.length ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">Still coming this month</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {stillComing.slice(0, 6).map((item) => (
              <li key={item.merchantKey}>
                {item.description} · {formatMoney(item.usual)} · {item.nextDate}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {page === "month" && ledger.flags.uncategorized > 0 ? (
        <section className="rounded-lg border border-primary/40 bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">
            {ledger.flags.uncategorized} charge{ledger.flags.uncategorized === 1 ? "" : "s"} need a category
          </h2>
          <Button className="mt-3" onClick={() => setCoach(true)}>Put them in categories</Button>
        </section>
      ) : null}
      {coach ? <CategorizeCoach onClose={() => setCoach(false)} /> : null}
      {page === "amounts" ? <AmountsPage showStyle /> : page === "transactions" ? <TransactionsPage /> : <AmountsPage showStyle={false} />}
    </div>
  );
}

function Strip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-xl tabular">{value}</div>
    </div>
  );
}
