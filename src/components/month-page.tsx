import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney } from "@/lib/budget/money";
import { groupMonth } from "@/lib/budget/month-view";
import { incomeRows, spendingRows } from "@/lib/budget/readout";
import { monthKeyFromDate, monthLabel } from "@/lib/budget/parse-date";
import type { CategoryUndo } from "@/lib/budget/sorting";
import { useBudgetStore } from "@/store/budget-store";
import { CategorizeCoach } from "./categorize-coach";
import { CategorySelect } from "./category-select";
import { HomeSwitch } from "./home-switch";
import { LedgerTabs } from "./ledger-tabs";
import { MonthSwitcher } from "./month-switcher";
import { EmptyMonth, MonthSheet, RowTools, Section, TxRow } from "./month-parts";
import { Button } from "./ui/button";

const NO_BUDGETS: never[] = [];

function dayLabel(iso: string) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(iso.slice(5, 7)) - 1] ?? ""} ${Number(iso.slice(8, 10))}`;
}

export function MonthPage({ titleAs = "h1" }: { titleAs?: "h1" | "h2" }) {
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
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const carryStart = useBudgetStore((s) => s.profile.carryStartMonth);
  const incomeSide = useMemo(
    () => incomeRows({ transactions, categories, ym, budgets }).filter((row) => row.amount > 0.004 || row.mark > 0.004).slice(0, 4),
    [transactions, categories, ym, budgets],
  );
  const spendSide = useMemo(
    () =>
      spendingRows({ transactions, categories, ym, budgets, style, carryStartMonth: carryStart })
        .filter((row) => row.amount > 0.004 || row.mark > 0.004)
        .slice(0, 4),
    [transactions, categories, ym, budgets, style, carryStart],
  );
  const inMonth = transactions.filter((t) => monthKeyFromDate(t.date) === ym);
  const hiddenDeposits = layout.aside.filter((t) => t.amount > 0);
  const hiddenOut = layout.aside.filter((t) => t.amount <= 0);
  const left = layout.incomeTotal - layout.expenseTotal;
  const Title = titleAs;

  function onChanged(sentence: string, next: CategoryUndo) {
    setNotice(null);
    setUndo({ sentence, undo: next });
  }

  if (!transactions.length) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <HomeSwitch />
        <h2 className="font-display text-2xl font-semibold">Start with one month</h2>
        <p className="text-sm text-muted">
          Import a bank file, then categorize each charge. That is the whole start. Tap a row later to split it or mark it paid back.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/import"><Button>Import a CSV</Button></Link>
          <Link to="/categories"><Button variant="outline">Sorting</Button></Link>
          <Button variant="ghost" onClick={() => loadSample()}>Try the demo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HomeSwitch />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Title className="font-display text-2xl font-semibold md:text-3xl">{monthLabel(ym)}</Title>
          <p className="mt-1 text-sm text-muted">
            {formatMoney(layout.incomeTotal)} in · {formatMoney(layout.expenseTotal)} out · {formatMoney(left, { signed: true })} left
          </p>
        </div>
        <MonthSwitcher />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">Money in</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {incomeSide.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3">
                <span>{row.name}</span>
                <span className="tabular text-muted">{row.primary}</span>
              </li>
            ))}
            {incomeSide.length === 0 ? <li className="text-muted">No income in this month yet.</li> : null}
          </ul>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">Money out</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {spendSide.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3">
                <span>{row.name}</span>
                <span className={`tabular ${row.tone === "danger" ? "text-danger" : "text-muted"}`}>{row.primary}</span>
              </li>
            ))}
            {spendSide.length === 0 ? <li className="text-muted">No spending categories with an amount yet.</li> : null}
          </ul>
          <Link to="/plan" className="mt-3 inline-flex text-sm font-medium text-primary">
            Open the budget
          </Link>
        </section>
      </div>
      <LedgerTabs page="month" />
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
            These deposits were filed as transfers, so they are not in income. Count them if the money is yours. Open a row if it pays back a purchase.
          </p>
          <Button className="mt-3" size="sm" onClick={() => {
            const n = countHiddenDeposits();
            setNotice(n ? `Counted ${n} deposit${n === 1 ? "" : "s"} as income.` : "Those deposits are already in income.");
          }}>
            Count every hidden deposit as income
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
        hint="Tap a category to see the deposits."
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
        hint="Tap a category to see the charges. Tap a charge to change where it goes."
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
            A payment to a credit card is not new spending — the purchases are already in expenses. These stay out so you do not count them twice.
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
