import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney } from "@/lib/budget/money";
import { groupMonth, type MonthGroup } from "@/lib/budget/month-view";
import { monthKeyFromDate, monthLabel, monthShort, shiftMonth } from "@/lib/budget/parse-date";
import type { Category, Transaction } from "@/lib/budget/types";
import { buildYearWorkbook, monthsOfYear, statusLabel } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { CashChart } from "./cash-chart";
import { CategorySelect } from "./category-select";
import { MonthRail } from "./month-rail";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

function dayLabel(iso: string) {
  return `${monthShort(iso.slice(0, 7))} ${Number(iso.slice(8, 10))}`;
}

function isPaycheck(categories: Category[], t: Transaction) {
  const slug = categories.find((c) => c.id === t.categoryId)?.slug ?? "";
  return slug === "paycheck" || slug.startsWith("paycheck-");
}

function catName(categories: Category[], id: string | null) {
  return categories.find((c) => c.id === id)?.name ?? "Needs a category";
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function countsLabel(t: Transaction) {
  if (t.excluded || t.status === "transfer") return "Left out";
  if (t.status === "reimbursement") return t.amount < 0 ? "Paid back — not spending" : "Paid back — not income";
  if (t.status === "refund") return "Store refund — lowers spending";
  return "Yes";
}

export function MonthBoard() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const deleteTransaction = useBudgetStore((s) => s.deleteTransaction);
  const markPaidBack = useBudgetStore((s) => s.markPaidBack);
  const undoPaidBack = useBudgetStore((s) => s.undoPaidBack);
  const countAsIncome = useBudgetStore((s) => s.countAsIncome);
  const countHiddenDeposits = useBudgetStore((s) => s.countHiddenDeposits);
  const loadSample = useBudgetStore((s) => s.loadSample);
  const ledgerName = useBudgetStore((s) => s.profile.ledgerName);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);

  const year = ym.slice(0, 4);
  const book = useMemo(() => buildYearWorkbook(transactions, categories, year), [transactions, categories, year]);
  const layout = useMemo(() => groupMonth(transactions, categories, ym), [transactions, categories, ym]);
  const needle = q.trim().toUpperCase();

  function matches(description: string, merchantKey: string) {
    if (!needle) return true;
    return `${description} ${merchantKey}`.toUpperCase().includes(needle);
  }

  function visible(group: MonthGroup) {
    return { ...group, transactions: group.transactions.filter((t) => matches(t.description, t.merchantKey)) };
  }

  const income = layout.income.map(visible).filter((g) => g.transactions.length);
  const expenses = layout.expenses.map(visible).filter((g) => g.transactions.length);
  const monthCell = book.monthSummaries.find((m) => m.ym === ym);
  const inMonth = transactions.filter((t) => monthKeyFromDate(t.date) === ym);
  const hiddenDeposits = layout.aside.filter((t) => t.amount > 0 && matches(t.description, t.merchantKey));
  const hiddenOut = layout.aside.filter((t) => t.amount <= 0 && matches(t.description, t.merchantKey));
  const depositChoices = inMonth.filter((t) => t.amount > 0 && t.status !== "reimbursement" && !t.excluded && !isPaycheck(categories, t));
  const expenseChoices = inMonth.filter((t) => t.amount < 0 && t.status !== "reimbursement" && t.status !== "transfer" && !t.excluded);
  const spentChart = layout.expenses
    .filter((g) => g.total > 0)
    .slice(0, 8)
    .map((g) => ({ name: g.name, Spent: g.total }));

  function onCategory(id: string, merchantKey: string, sample: string, categoryId: string | null) {
    const n = transactions.filter((t) => t.merchantKey === merchantKey).length;
    setTransactionCategory(id, categoryId, true);
    setNotice(`Updated ${n} ${displayMerchant(sample)} charge${n === 1 ? "" : "s"} — every month, not just this one.`);
  }

  function paidBack(expenseId: string, depositId: string | null) {
    markPaidBack(expenseId, depositId);
    setPairing(null);
    setNotice(
      depositId
        ? "Paid back. That purchase is not spending, and the deposit is not income."
        : "Purchase cancelled. It no longer counts as spending.",
    );
  }

  function depositPaysBack(depositId: string, expenseId: string | null) {
    if (expenseId) {
      markPaidBack(expenseId, depositId);
      setNotice("Paid back. That purchase is not spending, and the deposit is not income.");
    } else {
      patchTransaction(depositId, { status: "reimbursement", notes: "payback", excluded: false });
      setNotice("That deposit is not income.");
    }
    setPairing(null);
  }

  if (!transactions.length) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <h1 className="font-display text-3xl font-semibold">Start with one month</h1>
        <p className="text-sm text-muted">
          Import a bank CSV. Income and expenses stay in two lists. If someone pays you back, tap Paid back on the purchase.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/import">
            <Button>Import a CSV</Button>
          </Link>
          <Button variant="outline" onClick={() => loadSample()}>
            Try the demo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{ledgerName || "This month"}</p>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">{monthLabel(ym)}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">Income is money you keep. Expenses are money you spent. They are not mixed.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" aria-label="Previous month" onClick={() => setActiveMonth(shiftMonth(ym, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" aria-label="Next month" onClick={() => setActiveMonth(shiftMonth(ym, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <MonthRail
        months={monthsOfYear(year)}
        active={ym}
        statusOf={(key) => book.monthSummaries.find((m) => m.ym === key)?.status ?? "empty"}
        onPick={(key) => {
          setQ("");
          setNotice(null);
          setPairing(null);
          setActiveMonth(key);
        }}
      />

      <div key={ym} className="rise space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary
            label="Income"
            value={formatMoney(layout.incomeTotal)}
            hint={monthCell && monthCell.planIncome > 0 ? `${formatMoney(monthCell.planIncome)} planned` : "Money you kept"}
            tone="in"
          />
          <Summary
            label="Expenses"
            value={formatMoney(layout.expenseTotal)}
            hint={monthCell ? statusLabel(monthCell.status) : "Money you spent"}
            warn={monthCell?.status === "over"}
            tone="out"
          />
          <Summary
            label="Left"
            value={formatMoney(layout.incomeTotal - layout.expenseTotal, { signed: true })}
            hint="Income minus expenses"
            warn={layout.incomeTotal - layout.expenseTotal < 0}
          />
        </div>

        <section className="rounded-lg border border-danger/30 bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Where the spending went</h2>
          <p className="mt-1 mb-3 text-sm text-muted">Only expenses that still count. A paid-back purchase is not in this chart.</p>
          <CashChart data={spentChart} layout="vertical" bars={[{ key: "Spent", fill: "var(--color-danger)" }]} />
        </section>

        {layout.openCount > 0 ? (
          <p className="rounded-md border border-warn/40 bg-chip px-4 py-3 text-sm">
            {layout.openCount} charge{layout.openCount === 1 ? "" : "s"} in {monthLabel(ym)} still need a category. They are at the top of each list.
          </p>
        ) : null}
        {notice ? <p className="rounded-md bg-chip px-4 py-3 text-sm">{notice}</p> : null}

        <label className="flex max-w-md flex-col gap-1">
          <span className="text-sm text-muted">Search this month</span>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rent, paycheck, Target…" />
        </label>

        {hiddenDeposits.length ? (
          <section className="rounded-lg border border-warn/50 bg-surface p-4">
            <h2 className="font-display text-xl font-semibold">Left out of income ({hiddenDeposits.length})</h2>
            <p className="mt-1 text-sm text-muted">
              These deposits were treated as transfers — often Zelle, Venmo, or a move between your accounts — so they never landed in income. If the money is yours, count it. If a parent paid you back for something you bought, pair it with that purchase instead.
            </p>
            <Button
              className="mt-3"
              size="sm"
              onClick={() => {
                const n = countHiddenDeposits();
                setNotice(n ? `Counted ${n} deposit${n === 1 ? "" : "s"} as income.` : "Those deposits are already in income.");
              }}
            >
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
                    <CategorySelect
                      categories={categories}
                      kind="income"
                      value={t.categoryId}
                      onChange={(id) => setTransactionCategory(t.id, id, true)}
                    />
                  }
                  extra={
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => countAsIncome(t.id)}>
                        Count as income
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPairing(pairing === t.id ? null : t.id)}>
                        Pays back a purchase
                      </Button>
                      <Quiet onClick={() => deleteTransaction(t.id)}>Remove</Quiet>
                    </div>
                  }
                  pair={
                    pairing === t.id ? (
                      <PairList
                        title="Which purchase does this cancel?"
                        empty="No spending in this month to cancel. You can still keep this out of income."
                        choices={expenseChoices.map((e) => ({
                          id: e.id,
                          label: `${dayLabel(e.date)} · ${displayMerchant(e.description)} · ${formatMoney(Math.abs(e.amount))}`,
                        }))}
                        soloLabel="Don't count this as income"
                        onSolo={() => depositPaysBack(t.id, null)}
                        onPick={(id) => depositPaysBack(t.id, id)}
                        onClose={() => setPairing(null)}
                      />
                    ) : null
                  }
                />
              ))}
            </ul>
          </section>
        ) : null}

        <Section
          title="Income"
          kicker="Money in"
          hint="Paychecks and other money you keep. A payback from your parents is not income."
          groups={income}
          empty="No income in this month."
          tone="in"
          categories={categories}
          pairing={pairing}
          choices={expenseChoices}
          onCategory={onCategory}
          onPaid={(depositId, expenseId) => depositPaysBack(depositId, expenseId)}
          onUndo={(id) => {
            undoPaidBack(id);
            setNotice("Counted again.");
          }}
          onHide={(id) => {
            patchTransaction(id, { status: "transfer" });
            setNotice("Hidden. It is not income. You can count it again from Left out of income.");
          }}
          onPair={setPairing}
          onRemove={deleteTransaction}
        />
        <Section
          title="Expenses"
          kicker="Money out"
          hint="Bought something for your family? Tap Paid back, then pick the deposit they sent. Both drop out of the budget."
          groups={expenses}
          empty="No expenses in this month."
          tone="out"
          categories={categories}
          pairing={pairing}
          choices={depositChoices}
          onCategory={onCategory}
          onPaid={(expenseId, depositId) => paidBack(expenseId, depositId)}
          onUndo={(id) => {
            undoPaidBack(id);
            setNotice("That purchase counts as spending again.");
          }}
          onHide={() => {}}
          onPair={setPairing}
          onRemove={deleteTransaction}
        />

        {hiddenOut.length ? (
          <details className="rounded-lg border border-border bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Card payments and account moves ({hiddenOut.length})
            </summary>
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
                  category={
                    <CategorySelect
                      categories={categories}
                      kind="expense"
                      value={t.categoryId}
                      onChange={(id) => setTransactionCategory(t.id, id, true)}
                    />
                  }
                  extra={
                    <Quiet
                      onClick={() => {
                        patchTransaction(t.id, { status: "posted", excluded: false });
                        setNotice("Counted as spending.");
                      }}
                    >
                      Count as spending
                    </Quiet>
                  }
                />
              ))}
            </ul>
          </details>
        ) : null}

        <MonthSheet rows={inMonth} categories={categories} ym={ym} />
      </div>
    </div>
  );
}

function Section({
  title,
  kicker,
  hint,
  groups,
  empty,
  tone,
  categories,
  pairing,
  choices,
  onCategory,
  onPaid,
  onUndo,
  onHide,
  onPair,
  onRemove,
}: {
  title: string;
  kicker: string;
  hint: string;
  groups: MonthGroup[];
  empty: string;
  tone: "in" | "out";
  categories: Category[];
  pairing: string | null;
  choices: Transaction[];
  onCategory: (id: string, merchantKey: string, sample: string, categoryId: string | null) => void;
  onPaid: (id: string, otherId: string | null) => void;
  onUndo: (id: string) => void;
  onHide: (id: string) => void;
  onPair: (id: string | null) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className={cn("rounded-xl border p-3 md:p-4", tone === "in" ? "border-good/40" : "border-danger/35")}>
      <div className="mb-3 px-1">
        <p className={cn("text-xs font-medium uppercase tracking-wide", tone === "in" ? "text-good" : "text-danger")}>{kicker}</p>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </div>
      {groups.length === 0 ? <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">{empty}</p> : null}
      <div className="space-y-3">
        {groups.map((g) => {
          const over = tone === "out" && g.plan > 0 && g.total > g.plan + 0.5;
          const behind = tone === "in" && g.plan > 0 && g.total + 0.5 < g.plan;
          const pct = g.plan > 0 ? Math.min(100, Math.round((Math.max(0, g.total) / g.plan) * 100)) : 0;
          const state = over ? "Over" : behind ? "Behind" : g.plan > 0 ? "On track" : "";
          const slug = categories.find((c) => c.id === g.id)?.slug;
          return (
            <div key={g.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className={cn("border-l-4 px-4 py-3", g.open ? "border-warn" : tone === "in" ? "border-good" : "border-danger")}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className={cn("text-xs", over || behind ? "text-danger" : "text-muted")}>
                      {g.transactions.length} row{g.transactions.length === 1 ? "" : "s"}
                      {g.plan > 0 ? ` · plan ${formatMoney(g.plan)}` : ""}
                      {state ? ` · ${state}` : ""}
                    </div>
                  </div>
                  <div className={cn("tabular font-medium", tone === "in" ? "text-good" : "text-danger")}>{formatMoney(g.total)}</div>
                </div>
                {g.plan > 0 ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                    <div className={cn("h-full transition-[width] duration-300", over ? "bg-danger" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
                {slug === "transfers-in" ? (
                  <p className="mt-2 text-xs text-muted">These count as income. Use Pays back a purchase if someone repaid you.</p>
                ) : null}
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {g.transactions.map((t) => {
                  const paid = t.status === "reimbursement";
                  const paycheck = isPaycheck(categories, t);
                  return (
                    <TxRow
                      key={t.id}
                      date={dayLabel(t.date)}
                      name={displayMerchant(t.description)}
                      amount={t.amount}
                      paid={paid}
                      badge={paid ? "Paid back" : t.status === "refund" ? "Store refund" : undefined}
                      category={
                        <CategorySelect
                          categories={categories}
                          kind={tone === "in" ? "income" : "expense"}
                          value={t.categoryId}
                          onChange={(id) => onCategory(t.id, t.merchantKey, t.description, id)}
                        />
                      }
                      extra={
                        paid ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted">{tone === "out" ? "Not spending" : "Not income"}</span>
                            <Button size="sm" variant="outline" onClick={() => onUndo(t.id)}>
                              Undo
                            </Button>
                          </div>
                        ) : tone === "out" && t.status === "refund" ? (
                          <span className="text-xs text-muted">This store refund already lowers what you spent.</span>
                        ) : tone === "out" ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => (choices.length ? onPair(pairing === t.id ? null : t.id) : onPaid(t.id, null))}>
                              Paid back
                            </Button>
                            <Quiet onClick={() => onRemove(t.id)}>Remove</Quiet>
                          </div>
                        ) : paycheck ? (
                          <Quiet onClick={() => onRemove(t.id)}>Remove</Quiet>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => onPair(pairing === t.id ? null : t.id)}>
                              Pays back a purchase
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onHide(t.id)}>
                              Hide
                            </Button>
                          </div>
                        )
                      }
                      pair={
                        pairing === t.id ? (
                          tone === "out" ? (
                            <PairList
                              title="Which deposit paid you back?"
                              empty="No other deposit this month. Cancelling the purchase is enough."
                              choices={choices
                                .filter((c) => c.id !== t.id)
                                .map((d) => ({
                                  id: d.id,
                                  label: `${dayLabel(d.date)} · ${displayMerchant(d.description)} · ${formatMoney(d.amount)}`,
                                }))}
                              soloLabel="Just cancel this purchase"
                              onSolo={() => onPaid(t.id, null)}
                              onPick={(id) => onPaid(t.id, id)}
                              onClose={() => onPair(null)}
                            />
                          ) : (
                            <PairList
                              title="Which purchase does this cancel?"
                              empty="No purchase in this month to cancel."
                              choices={choices
                                .filter((c) => c.id !== t.id)
                                .map((e) => ({
                                  id: e.id,
                                  label: `${dayLabel(e.date)} · ${displayMerchant(e.description)} · ${formatMoney(Math.abs(e.amount))}`,
                                }))}
                              soloLabel="Don't count this as income"
                              onSolo={() => onPaid(t.id, null)}
                              onPick={(id) => onPaid(t.id, id)}
                              onClose={() => onPair(null)}
                            />
                          )
                        ) : null
                      }
                    />
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PairList({
  title,
  empty,
  choices,
  soloLabel,
  onSolo,
  onPick,
  onClose,
}: {
  title: string;
  empty: string;
  choices: { id: string; label: string }[];
  soloLabel: string;
  onSolo: () => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-2 space-y-2 rounded-md bg-chip p-3">
      <p className="text-sm font-medium">{title}</p>
      {choices.length === 0 ? <p className="text-xs text-muted">{empty}</p> : null}
      <div className="flex flex-col gap-1">
        <button type="button" className="min-h-9 rounded-md bg-surface px-2 text-left text-sm hover:bg-bg" onClick={onSolo}>
          {soloLabel}
        </button>
        {choices.slice(0, 8).map((c) => (
          <button key={c.id} type="button" className="min-h-9 rounded-md bg-surface px-2 text-left text-sm hover:bg-bg" onClick={() => onPick(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <button type="button" className="text-xs text-muted" onClick={onClose}>
        Never mind
      </button>
    </div>
  );
}

function TxRow({
  date,
  name,
  amount,
  category,
  extra,
  pair,
  muted,
  paid,
  badge,
}: {
  date: string;
  name: string;
  amount: number;
  category: ReactNode;
  extra?: ReactNode;
  pair?: ReactNode;
  muted?: boolean;
  paid?: boolean;
  badge?: string;
}) {
  const color = paid ? "text-muted" : amount > 0 ? "text-good" : "text-danger";
  return (
    <li className={cn("grid gap-2 px-4 py-3 md:grid-cols-[5.5rem_1fr_7rem_16rem] md:items-start", muted && "opacity-70")}>
      <div className="text-sm text-muted tabular">{date}</div>
      <div>
        <div className="font-medium">
          {name}
          {badge ? <span className="ml-2 rounded-full bg-chip px-2 py-0.5 text-xs font-normal text-muted">{badge}</span> : null}
        </div>
        {pair}
      </div>
      <div className={cn("tabular text-sm md:text-right", color)}>
        {paid ? (
          <>
            <div>Not counted</div>
            <div className="text-xs line-through">{formatMoney(Math.abs(amount))}</div>
          </>
        ) : (
          formatMoney(amount, { signed: amount > 0 })
        )}
      </div>
      <div className="space-y-2">
        {category}
        {extra}
      </div>
    </li>
  );
}

function MonthSheet({ rows, categories, ym }: { rows: Transaction[]; categories: Category[]; ym: string }) {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  function download() {
    const header = ["Date", "Name", "Income", "Expense", "Category", "Counts"];
    const lines = [header.join(",")];
    for (const t of sorted) {
      const income = t.amount > 0 ? t.amount.toFixed(2) : "";
      const expense = t.amount < 0 ? Math.abs(t.amount).toFixed(2) : "";
      lines.push([t.date, csvCell(displayMerchant(t.description)), income, expense, csvCell(catName(categories, t.categoryId)), csvCell(countsLabel(t))].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `harbor-${ym}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">This month, line by line</h2>
          <p className="mt-1 text-sm text-muted">Income and expenses are separate columns. Paid back means the row is on the sheet but not in the totals.</p>
        </div>
        <Button variant="outline" size="sm" onClick={download}>
          Download this month
        </Button>
      </div>
      <div className="sheet-wrap rounded-lg border border-border bg-surface">
        <table className="sheet-table w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium text-good">Income</th>
              <th className="px-3 py-2 text-right font-medium text-danger">Expense</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Counts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const skipped = t.excluded || t.status === "transfer" || t.status === "reimbursement";
              return (
                <tr key={t.id} className={cn("border-b border-border last:border-0", skipped && "text-muted")}>
                  <td className="whitespace-nowrap px-3 py-2 tabular">{dayLabel(t.date)}</td>
                  <td className="px-3 py-2">{displayMerchant(t.description)}</td>
                  <td className="px-3 py-2 text-right tabular text-good">{t.amount > 0 ? formatMoney(t.amount) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular text-danger">{t.amount < 0 ? formatMoney(Math.abs(t.amount)) : "—"}</td>
                  <td className="px-3 py-2">{catName(categories, t.categoryId)}</td>
                  <td className="px-3 py-2">{countsLabel(t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Quiet({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="min-h-9 text-xs text-muted hover:text-danger" onClick={onClick}>
      {children}
    </button>
  );
}

function Summary({
  label,
  value,
  hint,
  warn,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
  tone?: "in" | "out";
}) {
  return (
    <div className={cn("rounded-lg border bg-surface p-4", tone === "in" ? "border-good/40" : tone === "out" ? "border-danger/35" : "border-border")}>
      <div className={cn("text-xs font-medium uppercase tracking-wide", tone === "in" ? "text-good" : tone === "out" ? "text-danger" : "text-muted")}>
        {label}
      </div>
      <div className={cn("mt-1 font-display text-2xl font-semibold tabular", warn && "text-danger", tone === "in" && !warn && "text-good")}>{value}</div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </div>
  );
}
