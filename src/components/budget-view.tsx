import { useMemo, useState } from "react";
import { recurringBills } from "@/lib/budget/analytics-depth";
import { monthLedger } from "@/lib/budget/ledger-month";
import { formatMoney } from "@/lib/budget/money";
import { formatDay, monthLabel } from "@/lib/budget/parse-date";
import { FRESH_EACH_MONTH } from "@/lib/budget/presets";
import { stillComingThisMonth, yearlyComingLine } from "@/lib/budget/screen-plan";
import { categoryCarries } from "@/lib/budget/style";
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
  return formatDay(iso);
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
    page === "month" ? stillComingThisMonth(recurringBills(transactions, categories, today), today, transactions) ?? [] : [];
  const [leftWhy, setLeftWhy] = useState(false);
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
          <div className="money mt-1 font-display tabular" data-money>{formatMoney(ledger.totals.savedToFunds)}</div>
        </button>
        <div className="rounded-lg border border-border bg-surface px-3 py-3 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Left</div>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-sm"
              aria-label="How left relates to safe to spend"
              onClick={() => setLeftWhy((open) => !open)}
            >
              ?
            </button>
          </div>
          <div className="money mt-1 break-words font-display tabular" data-money>{formatMoney(ledger.totals.leftOver, { signed: true })}</div>
          {leftWhy ? <p className="mt-1 text-xs text-muted">Safe to spend also holds back what&apos;s still planned.</p> : null}
        </div>
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
            <li className="text-muted">No fund savings yet</li>
          )}
        </ul>
      ) : null}
      {ledger.fundMoves !== 0 ? (
        <p className="text-sm text-muted" title="Moves between funds are not new savings.">{formatMoney(ledger.fundMoves)} moved between funds</p>
      ) : null}
      {page === "month" ? <FreshBillCard /> : null}
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
          <p className="mt-2 text-xs text-muted">{yearlyComingLine(stillComing)}.</p>
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
      {page === "transactions" ? <TransactionsPage /> : <AmountsPage />}
    </div>
  );
}

const FRESH_KEY = "budgetflow-fresh-bills";

function FreshBillCard() {
  const categories = useBudgetStore((s) => s.categories);
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const updateCategory = useBudgetStore((s) => s.updateCategory);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      if (typeof localStorage === "undefined") return [];
      const raw = localStorage.getItem(FRESH_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  const next = categories.find(
    (category) => category.kind === "expense" && FRESH_EACH_MONTH.has(category.slug) && categoryCarries(category, style) && !dismissed.includes(category.id),
  );
  if (!next) return null;
  function remember(id: string) {
    const ids = [...dismissed, id];
    setDismissed(ids);
    localStorage.setItem(FRESH_KEY, JSON.stringify(ids));
  }
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm">{next.name} is a fixed bill. Start fresh each month?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            updateCategory(next.id, { carry: false });
            remember(next.id);
          }}
        >
          Yes
        </Button>
        <Button size="sm" variant="outline" onClick={() => remember(next.id)}>
          Keep
        </Button>
      </div>
    </section>
  );
}

function Strip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="money mt-1 break-words font-display tabular" data-money>{value}</div>
    </div>
  );
}
