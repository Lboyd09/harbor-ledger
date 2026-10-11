import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { displayMerchant } from "@/lib/budget/merchant";
import { recurringBills } from "@/lib/budget/analytics-depth";
import { formatMoney } from "@/lib/budget/money";
import { monthLedger } from "@/lib/budget/ledger-month";
import { stillComingThisMonth, yearlyComingLine } from "@/lib/budget/screen-plan";
import { groupMonth } from "@/lib/budget/month-view";
import { formatDay, monthKeyFromDate, monthLabel } from "@/lib/budget/parse-date";
import type { CategoryUndo } from "@/lib/budget/sorting";
import { useBudgetStore } from "@/store/budget-store";
import { CategorizeCoach } from "./categorize-coach";
import { CategorySelect } from "./category-select";
import { EmptyMonth, MonthSheet, RowTools, Section, TxRow } from "./month-parts";
import { Button } from "./ui/button";

const NO_BUDGETS: never[] = [];

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dayLabel(iso: string) {
  return formatDay(iso);
}

export function TransactionsPage() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const countHiddenDeposits = useBudgetStore((s) => s.countHiddenDeposits);
  const restoreCategories = useBudgetStore((s) => s.restoreCategories);
  const loadSample = useBudgetStore((s) => s.loadSample);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets);
  const budgets = monthBudgets ?? NO_BUDGETS;
  const [notice, setNotice] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ sentence: string; undo: CategoryUndo } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [divideKey, setDivideKey] = useState<string | null>(null);
  const [paybackId, onPayback] = useState<string | null>(null);
  const [coach, setCoach] = useState(false);
  const today = todayIso();
  const upcoming = stillComingThisMonth(recurringBills(transactions, categories, today), today, transactions);
  const stillComing = upcoming?.filter((item) => item.status !== "active" || item.nextDate.startsWith(ym)) ?? null;

  useEffect(() => {
    setUndo(null);
  }, [ym]);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem("harbor-open-categorize") === "1") {
      sessionStorage.removeItem("harbor-open-categorize");
      setCoach(true);
    }
  }, []);

  const layout = useMemo(
    () => groupMonth(transactions, categories, ym, budgets),
    [transactions, categories, ym, budgets],
  );
  const buckets = useBudgetStore((s) => s.moneyBuckets);
  const moves = useBudgetStore((s) => s.bucketMoves);
  const setAsides = useBudgetStore((s) => s.setAsides);
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const carryStart = useBudgetStore((s) => s.profile.carryStartMonth);
  const ledger = useMemo(
    () => monthLedger({ transactions, categories, budgets, buckets: buckets ?? [], moves: moves ?? [], setAsides: setAsides ?? [], style, carryStartMonth: carryStart }, ym),
    [transactions, categories, budgets, buckets, moves, setAsides, style, carryStart, ym],
  );
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const [accountFilter, setAccountFilter] = useState("all");
  const inMonth = transactions.filter((t) => monthKeyFromDate(t.date) === ym && (accountFilter === "all" || t.accountId === accountFilter));
  const hiddenDeposits = layout.aside.filter((t) => t.amount > 0);
  const hiddenOut = layout.aside.filter((t) => t.amount <= 0);

  function onChanged(sentence: string, next: CategoryUndo) {
    setNotice(null);
    setUndo({ sentence, undo: next });
  }

  if (!transactions.length) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h2 className="font-display text-2xl font-semibold">Start with one month</h2>
        <p className="text-sm text-muted">
          Import a bank file to begin.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/import"><Button>Import a CSV</Button></Link>
          <Link to="/rules"><Button variant="outline">Categories</Button></Link>
          <Button variant="ghost" onClick={() => loadSample()}>Try the demo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        {formatMoney(ledger.totals.received)} received · {formatMoney(ledger.totals.spent)} spent · {formatMoney(ledger.totals.savedToFunds)} moved to savings · {formatMoney(ledger.totals.leftOver, { signed: true })} left
      </p>
      {accounts.length > 1 ? (
        <label className="block text-sm text-muted">
          Account
          <select className="ml-2 min-h-11 rounded-md border border-border bg-surface px-2" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} aria-label="Account filter">
            <option value="all">All</option>
            {accounts.filter((account) => !account.archived).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {stillComing && stillComing.length ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">Still coming this month</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {stillComing.slice(0, 6).map((item) => (
              <li key={item.merchantKey}>
                {item.description} · {formatMoney(item.usual)} · {item.nextDate}
                {item.status === "late" ? " · late" : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            {yearlyComingLine(stillComing)}.
          </p>
        </section>
      ) : null}
      {coach ? (
        <CategorizeCoach onClose={() => setCoach(false)} />
      ) : layout.openCount > 0 ? (
        <section className="rounded-lg border border-primary/40 bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">
            {layout.openCount} charge{layout.openCount === 1 ? "" : "s"} in {monthLabel(ym).replace(/ \d{4}$/, "")} need a category
          </h2>
          <Button className="mt-3" onClick={() => setCoach(true)}>Put them in categories</Button>
        </section>
      ) : null}
      {undo ? (
        <p className="flex flex-wrap items-center gap-3 rounded-md bg-chip px-4 py-3 text-sm" role="status">
          <span>{undo.sentence}</span>
          <Button size="sm" variant="outline" onClick={() => { restoreCategories(undo.undo); setUndo(null); }}>Undo</Button>
        </p>
      ) : null}
      {notice ? <p className="rounded-md bg-chip px-4 py-3 text-sm">{notice}</p> : null}
      {inMonth.length === 0 ? <EmptyMonth ym={ym} transactions={transactions} onJump={setActiveMonth} /> : null}
      {hiddenDeposits.length ? (
        <section className="rounded-lg border border-warn/50 bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Left out of income ({hiddenDeposits.length})</h2>
          <p className="mt-1 text-sm text-muted">
            Left out of income. Yours? Count them.
          </p>
          <Button className="mt-3" size="sm" onClick={() => {
            const n = countHiddenDeposits();
            setNotice(n ? `Counted ${n} deposit${n === 1 ? "" : "s"} as income.` : "Those deposits are already in income.");
          }}>
            Count all as income
          </Button>
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {hiddenDeposits.map((t) => (
              <TxRow
                key={t.id}
                date={dayLabel(t.date)}
                name={displayMerchant(t.description)}
                amount={t.amount}
                category={
                  <CategorySelect categories={categories} kind="income" value={t.categoryId} onChange={(id) => setTransactionCategory(t.id, id, false)} />
                }
                open={openId === t.id}
                onOpen={() => setOpenId(openId === t.id ? null : t.id)}
                details={openId === t.id ? <RowTools t={t} tone="in" categories={categories} onNotice={setNotice} onChanged={onChanged} /> : null}
              />
            ))}
          </ul>
        </section>
      ) : null}
      <Section
        title="Money in"
        kicker="Money in"
        hint=""
        groups={layout.income}
        empty="No income in this month."
        tone="in"
        categories={categories}
        focus={focus}
        divideKey={divideKey}
        paybackId={paybackId}
        onPayback={onPayback}
        onFocus={setFocus}
        onDivide={setDivideKey}
        onChanged={onChanged}
        onNotice={setNotice}
        ym={ym}
      />
      <Section
        title="Money out"
        kicker="Money out"
        hint=""
        groups={layout.expenses}
        empty="No expenses in this month."
        tone="out"
        categories={categories}
        focus={focus}
        divideKey={divideKey}
        paybackId={paybackId}
        onPayback={onPayback}
        onFocus={setFocus}
        onDivide={setDivideKey}
        onChanged={onChanged}
        onNotice={setNotice}
        ym={ym}
      />
      {hiddenOut.length ? (
        <details className="rounded-lg border border-border bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Card payments and account moves ({hiddenOut.length})</summary>
          <p className="px-4 pb-3 text-sm text-muted">
            Already counted as purchases.
          </p>
          <ul className="divide-y divide-border border-t border-border">
            {hiddenOut.map((t) => (
              <TxRow
                key={t.id}
                date={dayLabel(t.date)}
                name={displayMerchant(t.description)}
                amount={t.amount}
                muted
                category={<CategorySelect categories={categories} kind="expense" value={t.categoryId} onChange={(id) => setTransactionCategory(t.id, id, false)} />}
                details={
                  <button type="button" className="min-h-9 text-xs text-muted hover:text-fg" onClick={() => { patchTransaction(t.id, { status: "posted", excluded: false }); setNotice("Counted as spending."); }}>
                    Count as spending
                  </button>
                }
              />
            ))}
          </ul>
        </details>
      ) : null}
      {inMonth.length ? <MonthSheet rows={inMonth} categories={categories} ym={ym} /> : null}
    </div>
  );
}
