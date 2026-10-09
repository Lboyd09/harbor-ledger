import { useMemo, useState } from "react";
import { recurringBills } from "@/lib/budget/analytics-depth";
import { monthLedger } from "@/lib/budget/ledger-month";
import { formatMoney } from "@/lib/budget/money";
import { monthLabel } from "@/lib/budget/parse-date";
import { comingUp } from "@/lib/budget/screen-plan";
import { useBudgetStore } from "@/store/budget-store";
import { AmountsPage } from "./budget-amounts";
import { TransactionsPage } from "./budget-transactions";
import { LeftoversCard } from "./category-panel";
import { BudgetMenu } from "./page-menu";
import { CategorizeCoach } from "./categorize-coach";
import { MonthSwitcher } from "./month-switcher";
import { Button } from "./ui/button";

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function shortDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BudgetView({ page }: { page: "month" | "amounts" | "transactions" }) {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const budgets = useBudgetStore((s) => s.monthBudgets);
  const buckets = useBudgetStore((s) => s.moneyBuckets);
  const moves = useBudgetStore((s) => s.bucketMoves);
  const setAsides = useBudgetStore((s) => s.setAsides);
  const profile = useBudgetStore((s) => s.profile);
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const carryStartMonth = useBudgetStore((s) => s.profile.carryStartMonth);
  const ledger = useMemo(
    () =>
      monthLedger(
        {
          transactions,
          categories,
          budgets: budgets ?? [],
          buckets: buckets ?? [],
          moves: moves ?? [],
          setAsides: setAsides ?? [],
          style,
          carryStartMonth,
          profile,
        },
        ym,
      ),
    [transactions, categories, budgets, buckets, moves, setAsides, style, carryStartMonth, profile, ym],
  );
  const today = todayIso();
  const stillComing =
    page === "month"
      ? (comingUp(recurringBills(transactions, categories, today), today, 45) ?? []).filter(
          (item) => item.status === "active" && item.nextDate >= today && item.nextDate.startsWith(ym),
        )
      : [];
  const expectedIncome = ledger.income.reduce((sum, line) => sum + line.expected, 0);
  const incomeLabel = ledger.totals.received > 0.5 ? "Received" : "Income";
  const incomeValue = ledger.totals.received > 0.5 ? ledger.totals.received : expectedIncome;
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
        <Strip label={incomeLabel} value={formatMoney(incomeValue)} />
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
      {page === "month" && stillComing.length ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">Still coming this month</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {stillComing.slice(0, 6).map((item) => (
              <li key={item.merchantKey}>
                {item.description} · {formatMoney(item.usual)} · {shortDate(item.nextDate)}
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
