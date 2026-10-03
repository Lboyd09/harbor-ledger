import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { safeToSpend } from "@/lib/budget/buckets";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney } from "@/lib/budget/money";
import { groupMonth, type MonthGroup } from "@/lib/budget/month-view";
import { currentMonthKey, monthKeyFromDate, monthLabel, monthShort, shiftMonth } from "@/lib/budget/parse-date";
import { closestAmount, paybackNote } from "@/lib/budget/payback";
import { piecesOf } from "@/lib/budget/splits";
import { downloadText } from "@/lib/budget/download";
import type { Category, Transaction } from "@/lib/budget/types";
import { buildYearWorkbook, monthsOfYear, statusLabel } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { CashChart } from "./cash-chart";
import { CategorizeCoach } from "./categorize-coach";
import { CategorySelect } from "./category-select";
import { LedgerTabs } from "./ledger-tabs";
import { MonthRail } from "./month-rail";
import { SummaryCard } from "./summary-card";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";

function dayLabel(iso: string) {
  return `${monthShort(iso.slice(0, 7))} ${Number(iso.slice(8, 10))}`;
}

function rowFocus(tone: "in" | "out", groupId: string, txId: string) {
  return `${tone}|${groupId}|${txId}`;
}

function isPaycheck(categories: Category[], t: Transaction) {
  const slug = categories.find((c) => c.id === t.categoryId)?.slug ?? "";
  return slug === "paycheck" || slug.startsWith("paycheck-");
}

function catName(categories: Category[], id: string | null) {
  return categories.find((c) => c.id === id)?.name ?? "Needs a category";
}

function sheetCategory(categories: Category[], t: Transaction) {
  const pieces = piecesOf(t);
  const overall = catName(categories, t.categoryId);
  if (!pieces) return overall;
  return `${overall} (${pieces.map((p) => `${catName(categories, p.categoryId)} ${p.amount.toFixed(2)}`).join(" / ")})`;
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function countsLabel(t: Transaction) {
  if (t.excluded || t.status === "transfer") return "Left out";
  if (t.status === "reimbursement") return t.amount < 0 ? "Paid back — not spending" : "Paid back — not income";
  if (t.status === "refund") return "Money back — lowers spending";
  return "Yes";
}

function ChargeCategory({
  t,
  tone,
  categories,
  onPick,
}: {
  t: Transaction;
  tone: "in" | "out";
  categories: Category[];
  onPick: (id: string | null, every: boolean) => void;
}) {
  const [every, setEvery] = useState(true);
  const name = displayMerchant(t.description);
  return (
    <>
      <CategorySelect
        categories={categories}
        kind={tone === "in" ? "income" : "expense"}
        value={t.categoryId}
        onChange={(id) => onPick(id, every)}
      />
      <label className="flex min-h-8 items-start gap-2 text-xs text-muted">
        <input type="checkbox" className="mt-0.5" checked={every} onChange={(e) => setEvery(e.target.checked)} />
        <span>Every {name}, in every month</span>
      </label>
    </>
  );
}

export function MonthBoard() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const bucketMoves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const countHiddenDeposits = useBudgetStore((s) => s.countHiddenDeposits);
  const loadSample = useBudgetStore((s) => s.loadSample);
  const ledgerName = useBudgetStore((s) => s.profile.ledgerName);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [divideKey, setDivideKey] = useState<string | null>(null);
  const [paybackId, onPayback] = useState<string | null>(null);
  const [coach, setCoach] = useState(false);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem("harbor-open-categorize") === "1") {
      sessionStorage.removeItem("harbor-open-categorize");
      setCoach(true);
    }
  }, []);

  const year = ym.slice(0, 4);
  const book = useMemo(() => buildYearWorkbook(transactions, categories, year), [transactions, categories, year]);
  const layout = useMemo(
    () => groupMonth(transactions, categories, ym, monthBudgets),
    [transactions, categories, ym, monthBudgets],
  );
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
  const spentChart = layout.expenses
    .filter((g) => g.total > 0)
    .slice(0, 8)
    .map((g) => ({ name: g.name, Spent: g.total }));
  const safe = safeToSpend({ ym, transactions, categories, budgets: monthBudgets, buckets: moneyBuckets, moves: bucketMoves });

  function onCategory(id: string, _merchantKey: string, _sample: string, categoryId: string | null) {
    setTransactionCategory(id, categoryId, false);
    setNotice("Saved on this row only. Other charges with the same name are unchanged.");
  }

  if (!transactions.length) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <h1 className="font-display text-3xl font-semibold">Start with one month</h1>
        <p className="text-sm text-muted">
          Import a bank file, then categorize each charge. That is the whole start. Tap a row later to split it or mark it paid back.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/import">
            <Button>Import a CSV</Button>
          </Link>
          <Link to="/categories">
            <Button variant="outline">Merchants</Button>
          </Link>
          <Button variant="ghost" onClick={() => loadSample()}>
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
          <p className="mt-1 max-w-xl text-sm text-muted">
            Tap a category, then a charge. The box under the list applies that category to every charge with the same name, in every month.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" aria-label="Previous month" onClick={() => setActiveMonth(shiftMonth(ym, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setActiveMonth(currentMonthKey())}>
            This month
          </Button>
          <Button variant="outline" size="sm" aria-label="Next month" onClick={() => setActiveMonth(shiftMonth(ym, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <LedgerTabs page="month" />

      <MonthRail
        months={monthsOfYear(year)}
        active={ym}
        statusOf={(key) => book.monthSummaries.find((m) => m.ym === key)?.status ?? "empty"}
        onPick={(key) => {
          setQ("");
          setNotice(null);
          setOpenId(null);
          setFocus(null);
          setDivideKey(null);
          setActiveMonth(key);
        }}
      />

      <div key={ym} className="rise space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Income"
            value={formatMoney(layout.incomeTotal)}
            sentence={monthCell && monthCell.planIncome > 0 ? `${formatMoney(monthCell.planIncome)} was the plan.` : "Money you kept this month."}
            tone="in"
          />
          <SummaryCard
            label="Expenses"
            value={formatMoney(layout.expenseTotal)}
            sentence={monthCell ? statusLabel(monthCell.status) : "Money you spent this month."}
            warn={monthCell?.status === "over"}
            tone="out"
          >
            <p className="text-sm text-muted">Only expenses that still count. A paid-back purchase is not in this chart.</p>
            <div className="chart-rise">
              <CashChart data={spentChart} layout="vertical" bars={[{ key: "Spent", fill: "var(--color-danger)" }]} />
            </div>
          </SummaryCard>
          <SummaryCard
            label="Left"
            value={formatMoney(layout.incomeTotal - layout.expenseTotal, { signed: true })}
            sentence="Income minus expenses. Money you set aside is not in this number."
            warn={layout.incomeTotal - layout.expenseTotal < 0}
          >
            <MonthSheet rows={inMonth} categories={categories} ym={ym} />
          </SummaryCard>
        </div>
        <p className="text-sm">
          Safe to spend {formatMoney(safe.amount, { signed: true })}. Income so far, minus this month’s category amounts, minus what goes into buckets, minus spending that is not already in those amounts.
        </p>

        {coach ? <CategorizeCoach onClose={() => setCoach(false)} /> : null}
        {!coach && layout.openCount > 0 ? (
          <section className="rounded-lg border border-primary/40 bg-surface p-4">
            <h2 className="font-display text-xl font-semibold">
              {layout.openCount} transaction{layout.openCount === 1 ? "" : "s"} need a category
            </h2>
            <p className="mt-1 text-sm text-muted">
              Do this before the month will make sense. You’ll see one charge at a time and tap where it belongs.
            </p>
            <Button className="mt-3" onClick={() => setCoach(true)}>
              Categorize them
            </Button>
          </section>
        ) : null}

        {inMonth.length === 0 ? (
          <EmptyMonth ym={ym} transactions={transactions} onJump={setActiveMonth} />
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
              These deposits were filed as transfers, so they are not in income. Count them if the money is yours. Open a row if it pays back a purchase.
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
                      onChange={(id) => setTransactionCategory(t.id, id, false)}
                    />
                  }
                  open={openId === t.id}
                  onOpen={() => setOpenId(openId === t.id ? null : t.id)}
                  details={openId === t.id ? <RowTools t={t} tone="in" categories={categories} onNotice={setNotice} /> : null}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <Section
          title="Income"
          kicker="Money in"
          hint="Tap a category to see the charges. Tap a charge to change where it goes."
          groups={income}
          empty="No income in this month."
          tone="in"
          categories={categories}
          focus={focus}
          divideKey={divideKey}
          paybackId={paybackId}
          onPayback={onPayback}
          onFocus={setFocus}
          onDivide={setDivideKey}
          onCategory={onCategory}
          onNotice={setNotice}
          ym={ym}
        />
        <Section
          title="Expenses"
          kicker="Money out"
          hint="Each bar is spent against the monthly amount. Tap the category, then a charge, to move it or mark it paid back."
          groups={expenses}
          empty="No expenses in this month."
          tone="out"
          categories={categories}
          focus={focus}
          divideKey={divideKey}
          paybackId={paybackId}
          onPayback={onPayback}
          onFocus={setFocus}
          onDivide={setDivideKey}
          onCategory={onCategory}
          onNotice={setNotice}
          ym={ym}
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
                      onChange={(id) => setTransactionCategory(t.id, id, false)}
                    />
                  }
                  details={
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
  focus,
  divideKey,
  paybackId,
  onPayback,
  onFocus,
  onDivide,
  onCategory,
  onNotice,
  ym,
}: {
  title: string;
  kicker: string;
  hint: string;
  groups: MonthGroup[];
  empty: string;
  tone: "in" | "out";
  categories: Category[];
  focus: string | null;
  divideKey: string | null;
  paybackId: string | null;
  onPayback: (id: string | null) => void;
  onFocus: (key: string | null) => void;
  onDivide: (key: string | null) => void;
  onCategory: (id: string, merchantKey: string, sample: string, categoryId: string | null) => void;
  onNotice: (message: string) => void;
  ym: string;
}) {
  const monthTx = useBudgetStore((s) => s.transactions);
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  return (
    <section className={cn("rounded-xl border p-3 md:p-4", tone === "in" ? "border-good/40" : "border-danger/35")}>
      <div className="mb-3 px-1">
        <p className={cn("text-xs font-medium uppercase tracking-wide", tone === "in" ? "text-good" : "text-danger")}>{kicker}</p>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </div>
      {groups.length === 0 ? <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">{empty}</p> : null}
      <div className="space-y-3">
        {groups.map((g) => {
          const over = tone === "out" && g.plan > 0 && g.total > g.plan + 0.5;
          const behind = tone === "in" && g.plan > 0 && g.total + 0.5 < g.plan;
          const pct = g.plan > 0 ? Math.min(100, Math.round((Math.max(0, g.total) / g.plan) * 100)) : 0;
          const state = over ? "Over" : behind ? "Behind" : g.plan > 0 ? "On track" : "";
          const stored = categories.find((c) => c.id === g.id);
          const expanded = openGroups[g.id] ?? g.open;
          return (
            <div key={g.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className={cn("border-l-4 px-4 py-3", g.open ? "border-warn" : tone === "in" ? "border-good" : "border-danger")}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                  aria-expanded={expanded}
                  onClick={() => setOpenGroups((cur) => ({ ...cur, [g.id]: !expanded }))}
                >
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className={cn("text-xs", over || behind ? "text-danger" : "text-muted")}>
                      {g.transactions.length} charge{g.transactions.length === 1 ? "" : "s"}
                      {state ? ` · ${state}` : ""}
                      {expanded ? " · hide" : " · show"}
                    </div>
                  </div>
                  <div className={cn("tabular font-medium", tone === "in" ? "text-good" : "text-danger")}>{formatMoney(g.total)}</div>
                </button>
                {g.plan > 0 ? (
                  <div className="mt-2">
                    <div className="h-2.5 overflow-hidden rounded-full bg-chip">
                      <div className={cn("h-full", over ? "bg-danger" : "bg-primary")} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatMoney(Math.max(0, g.total))} of {formatMoney(g.plan)}.{" "}
                      <Link to="/plan" className="text-primary">
                        Change the amount
                      </Link>
                    </p>
                  </div>
                ) : moneyBuckets.some((b) => b.categoryIds.includes(g.id)) ? (
                  <p className="mt-1 text-xs text-muted">
                    This is a bucket. What you don’t spend stays.{" "}
                    <Link to="/plan" className="text-primary">
                      See it on Plan
                    </Link>
                  </p>
                ) : stored && !g.open ? (
                  <p className="mt-1 text-xs text-muted">
                    No monthly amount yet.{" "}
                    <Link to="/plan" className="text-primary">
                      Set one on Plan
                    </Link>
                  </p>
                ) : null}
              </div>
              {expanded ? (
              <ul className="divide-y divide-border border-t border-border">
                {g.transactions.map((t) => {
                  const paid = t.status === "reimbursement";
                  const pieces = piecesOf(t);
                  const key = rowFocus(tone, g.id, t.id);
                  const open = focus === key;
                  const share = g.shares[t.id];
                  const shown = share == null ? t.amount : tone === "out" ? -Math.abs(share) : Math.abs(share);
                  const others = monthTx.filter(
                    (x) =>
                      x.id !== t.id &&
                      x.merchantKey === t.merchantKey &&
                      x.date.slice(0, 7) === ym &&
                      x.status !== "transfer" &&
                      !x.excluded,
                  );
                  const otherCats = [...new Set(others.map((x) => x.categoryId))].filter((id) => id !== t.categoryId);
                  const pieceLine = pieces
                    ? `Overall ${catName(categories, t.categoryId)}. This month: ${pieces
                        .map((p) => `${catName(categories, p.categoryId)} ${formatMoney(p.amount)}`)
                        .join(" · ")}.`
                    : null;
                  return (
                    <TxRow
                      key={`${g.id}-${t.id}`}
                      date={dayLabel(t.date)}
                      name={displayMerchant(t.description)}
                      amount={shown}
                      paid={paid}
                      badge={paid ? "Paid back" : t.status === "refund" ? "Money back" : pieces ? "Divided" : undefined}
                      open={open}
                      onOpen={() => {
                        onPayback(null);
                        if (open) {
                          onFocus(null);
                          onDivide(null);
                        } else {
                          onFocus(key);
                          onDivide(null);
                        }
                      }}
                      extra={
                        t.status === "refund" ? (
                          <RefundLine t={t} onNotice={onNotice} />
                        ) : pieceLine ? (
                          <p className="mt-1 text-xs text-muted">{pieceLine}</p>
                        ) : null
                      }
                      category={
                        open || g.open ? (
                        <div className="space-y-1">
                          <ChargeCategory
                            t={t}
                            tone={tone}
                            categories={categories}
                            onPick={(id, every) => {
                              if (t.status === "reimbursement") useBudgetStore.getState().undoPaidBack(t.id);
                              onPayback(null);
                              if (every) {
                                useBudgetStore.getState().setMerchantCategory(t.merchantKey, id, tone);
                                onNotice(
                                  id
                                    ? `Every ${displayMerchant(t.description)} now uses this category, in every month.`
                                    : `Cleared every ${displayMerchant(t.description)}.`,
                                );
                              } else {
                                onCategory(t.id, t.merchantKey, t.description, id);
                              }
                            }}
                          />
                          {open && tone === "out" && t.status === "posted" && !pieces ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onFocus(key);
                                onDivide(null);
                                onPayback(t.id);
                              }}
                            >
                              Someone paid me back
                            </Button>
                          ) : null}
                          {open && t.status === "posted" && !paid ? (
                            <button
                              type="button"
                              className="min-h-8 text-xs text-muted hover:text-fg"
                              onClick={() => {
                                onPayback(null);
                                onFocus(key);
                                onDivide(key);
                              }}
                            >
                              Split into two categories
                            </button>
                          ) : null}
                          {otherCats.length ? (
                            <p className="text-xs text-muted">
                              Another {displayMerchant(t.description)} this month is {otherCats.map((id) => catName(categories, id)).join(" or ")}. This row can differ.
                            </p>
                          ) : null}
                        </div>
                        ) : (
                          <span className="text-xs text-muted">Tap the name</span>
                        )
                      }
                      details={
                        open && paybackId === t.id ? (
                          <div className="detail-in">
                            <PaybackMatch
                              t={t}
                              categories={categories}
                              onNotice={onNotice}
                              onClose={() => onPayback(null)}
                            />
                          </div>
                        ) : open ? (
                          <div className="detail-in">
                            <RowTools
                              t={t}
                              tone={tone}
                              categories={categories}
                              onNotice={onNotice}
                              divide={divideKey === key}
                            />
                          </div>
                        ) : null
                      }
                    />
                  );
                })}
              </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RowTools({
  t,
  tone,
  categories,
  onNotice,
  divide,
}: {
  t: Transaction;
  tone: "in" | "out";
  categories: Category[];
  onNotice: (message: string) => void;
  divide?: boolean;
}) {
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const deleteTransaction = useBudgetStore((s) => s.deleteTransaction);
  const countAsIncome = useBudgetStore((s) => s.countAsIncome);
  const paycheck = isPaycheck(categories, t);
  const note = paybackNote(t.notes);
  const pieces = piecesOf(t);

  return (
    <div className="mt-2 space-y-3 text-sm">
      {t.status === "reimbursement" ? (
        <div className="rounded-md border border-border bg-bg p-3">
          <p className="font-medium">This was paid back{note ? ` — ${note}` : ""}.</p>
          <p className="mt-1 text-muted">It is not spending and the matching deposit is not income.</p>
          <Button
            className="mt-2"
            size="sm"
            variant="outline"
            onClick={() => {
              useBudgetStore.getState().undoPaidBack(t.id);
              onNotice("Counted as spending again.");
            }}
          >
            Undo — count it again
          </Button>
        </div>
      ) : (
        <p className="text-muted">Changing the category here follows the box above. Uncheck it to change only this row.</p>
      )}
      {t.status === "posted" ? (
        <SplitEditor t={t} tone={tone} categories={categories} onNotice={onNotice} openNow={Boolean(divide)} />
      ) : null}
      <div className="flex flex-wrap gap-3">
        {t.status === "refund" ? (
          <Quiet
            onClick={() => {
              patchTransaction(t.id, { status: "posted" });
              onNotice("Counted as a normal charge again.");
            }}
          >
            Not money back
          </Quiet>
        ) : tone === "out" && t.status === "posted" && !pieces ? (
          <Quiet
            onClick={() => {
              patchTransaction(t.id, { status: "refund" });
              onNotice("Marked as money a store gave back. It lowers spending and is not income.");
            }}
          >
            Store gave this back
          </Quiet>
        ) : null}
        {t.status === "transfer" && t.amount > 0 ? (
          <Quiet
            onClick={() => {
              countAsIncome(t.id);
              onNotice("Counted as income.");
            }}
          >
            Count as income
          </Quiet>
        ) : null}
        {tone === "in" && !paycheck && t.status === "posted" ? (
          <Quiet
            onClick={() => {
              patchTransaction(t.id, { status: "transfer" });
              onNotice("Hidden from income. It is listed under Left out of income.");
            }}
          >
            Not income
          </Quiet>
        ) : null}
        <Quiet danger onClick={() => deleteTransaction(t.id)}>Remove</Quiet>
      </div>
    </div>
  );
}

function SplitEditor({
  t,
  tone,
  categories,
  onNotice,
  openNow,
}: {
  t: Transaction;
  tone: "in" | "out";
  categories: Category[];
  onNotice: (message: string) => void;
  openNow?: boolean;
}) {
  const setSplits = useBudgetStore((s) => s.setSplits);
  const existing = t.splits && t.splits.length >= 2 ? t.splits : null;
  const [on, setOn] = useState(Boolean(existing) || Boolean(openNow));
  const abs = Math.abs(t.amount);
  const half = Math.round((abs / 2) * 100) / 100;
  const rest = Math.round((abs - half) * 100) / 100;
  const [aCat, setACat] = useState(existing?.[0]?.categoryId ?? t.categoryId ?? "");
  const [bCat, setBCat] = useState(existing?.[1]?.categoryId ?? "");
  const [aAmt, setAAmt] = useState(String(existing?.[0]?.amount ?? half));
  const [bAmt, setBAmt] = useState(String(existing?.[1]?.amount ?? rest));
  const kind = tone === "in" ? "income" : "expense";
  const overall = categories.find((c) => c.id === t.categoryId);

  useEffect(() => {
    if (openNow) setOn(true);
  }, [openNow]);

  if (!on) {
    return (
      <Quiet onClick={() => setOn(true)}>Divide into two categories</Quiet>
    );
  }

  function save() {
    const a = Number(aAmt);
    const b = Number(bAmt);
    if (!aCat || !bCat) {
      onNotice("Pick a category for each piece.");
      return;
    }
    if (aCat === bCat) {
      onNotice("Pick two different categories. The overall category can still be one of them.");
      return;
    }
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      onNotice("Both amounts need to be more than zero.");
      return;
    }
    if (Math.abs(a + b - abs) > 0.05) {
      onNotice(`The two amounts need to add up to ${formatMoney(abs)}.`);
      return;
    }
    setSplits(t.id, [
      { categoryId: aCat, amount: a },
      { categoryId: bCat, amount: b },
    ]);
    onNotice("Divided. The overall category stays, and only this row changed.");
  }

  return (
    <div className="max-w-md space-y-2 rounded-md border border-border bg-bg p-3">
      <p className="font-medium">Two categories, one row</p>
      <p className="text-xs text-muted">
        {overall ? `${overall.name} stays the overall category. ` : ""}
        The pieces count in this month only. They have to add up to {formatMoney(abs)}.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        <CategorySelect categories={categories} kind={kind} value={aCat || null} onChange={(id) => setACat(id ?? "")} />
        <Input inputMode="decimal" aria-label="First amount" value={aAmt} onChange={(e) => setAAmt(e.target.value)} />
        <CategorySelect categories={categories} kind={kind} value={bCat || null} onChange={(id) => setBCat(id ?? "")} />
        <Input inputMode="decimal" aria-label="Second amount" value={bAmt} onChange={(e) => setBAmt(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save}>
          Save this split
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSplits(t.id, null);
            setOn(false);
            onNotice("Back to one category.");
          }}
        >
          Use one category
        </Button>
      </div>
    </div>
  );
}

function PaybackMatch({
  t,
  categories,
  onNotice,
  onClose,
}: {
  t: Transaction;
  categories: Category[];
  onNotice: (message: string) => void;
  onClose: () => void;
}) {
  const transactions = useBudgetStore((s) => s.transactions);
  const markPaidBack = useBudgetStore((s) => s.markPaidBack);
  const [label, setLabel] = useState("");
  const [pick, setPick] = useState("");
  const month = t.date.slice(0, 7);
  const pool = transactions.filter(
    (x) => x.amount > 0 && x.id !== t.id && x.status !== "reimbursement" && x.status !== "transfer" && !x.excluded && !isPaycheck(categories, x),
  );
  const sameMonth = pool.filter((x) => x.date.slice(0, 7) === month);
  const list = (sameMonth.length ? sameMonth : pool).slice().sort((a, b) => {
    const da = Math.abs(Math.abs(a.amount) - Math.abs(t.amount));
    const db = Math.abs(Math.abs(b.amount) - Math.abs(t.amount));
    return da - db || a.date.localeCompare(b.date);
  });
  const suggested = closestAmount(Math.abs(t.amount), list, t.date);
  const gap = suggested ? Math.abs(Math.abs(suggested.amount) - Math.abs(t.amount)) : Infinity;
  const close = Boolean(suggested) && gap <= Math.max(5, Math.abs(t.amount) * 0.15);
  const chosen = pick || (close ? suggested?.id || "" : "");

  return (
    <div className="mt-2 max-w-lg space-y-2 rounded-md border border-border bg-bg p-3">
      <p className="font-medium">Which deposit paid this back?</p>
      <p className="text-sm text-muted">
        {close && suggested
          ? `${displayMerchant(suggested.description)} on ${dayLabel(suggested.date)} is ${formatMoney(suggested.amount)}, close to this charge. Tap it, then confirm. Both rows leave income and spending.`
          : suggested
            ? `Nothing lines up with ${formatMoney(Math.abs(t.amount))}. The nearest deposit is first. Pick it only if that money really paid this.`
            : "There is no deposit to match. You can still leave this purchase out of spending."}
      </p>
      {list.length ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {list.slice(0, 12).map((x) => {
            const on = chosen === x.id;
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setPick(x.id)}
                  className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${on ? "border-primary bg-chip" : "border-transparent hover:bg-chip"}`}
                >
                  <span>
                    {dayLabel(x.date)} · {displayMerchant(x.description)}
                    {close && suggested?.id === x.id ? <span className="ml-2 text-xs text-muted">Closest</span> : null}
                  </span>
                  <span className="tabular text-good">{formatMoney(x.amount)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Input value={label} placeholder="Note, optional" aria-label="Payback note" onChange={(e) => setLabel(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!chosen && list.length > 0}
          onClick={() => {
            markPaidBack(t.id, chosen || null, label);
            onNotice(chosen ? "Matched. Both rows are out of this month." : "That purchase is out of spending.");
            onClose();
          }}
        >
          {chosen ? "These cancel each other out" : "Leave this purchase out of spending"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RefundLine({ t, onNotice }: { t: Transaction; onNotice: (message: string) => void }) {
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  return (
    <p className="mt-1 max-w-md text-xs text-muted">
      Money a store gave back. It lowers what you spent. It is not a paycheck or new income.{" "}
      <button
        type="button"
        className="underline-offset-2 hover:underline"
        onClick={() => {
          patchTransaction(t.id, { status: "posted" });
          onNotice("Counted as a normal charge again.");
        }}
      >
        Not a return
      </button>
    </p>
  );
}

function EmptyMonth({
  ym,
  transactions,
  onJump,
}: {
  ym: string;
  transactions: Transaction[];
  onJump: (ym: string) => void;
}) {
  const latest = transactions.map((t) => monthKeyFromDate(t.date)).sort().at(-1);
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-4 text-sm">
      <p className="font-medium">Nothing posted in {monthLabel(ym)} yet.</p>
      {latest && latest !== ym ? (
        <p className="mt-1 text-muted">
          Your latest charges are in {monthLabel(latest)}.{" "}
          <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => onJump(latest)}>
            Show {monthLabel(latest)}
          </button>
        </p>
      ) : (
        <p className="mt-1 text-muted">Import a CSV when this month’s file arrives, or move to another month.</p>
      )}
    </div>
  );
}

function TxRow({
  date,
  name,
  amount,
  category,
  details,
  extra,
  muted,
  paid,
  badge,
  open,
  onOpen,
}: {
  date: string;
  name: string;
  amount: number;
  category: ReactNode;
  details?: ReactNode;
  extra?: ReactNode;
  muted?: boolean;
  paid?: boolean;
  badge?: string;
  open?: boolean;
  onOpen?: () => void;
}) {
  const color = paid || (badge === "Money back") ? "text-muted" : amount > 0 ? "text-good" : "text-danger";
  return (
    <li className={cn("grid gap-2 px-4 py-3 md:grid-cols-[5.5rem_1fr_7rem_16rem] md:items-start", muted && "opacity-70")}>
      <div className="text-sm text-muted tabular">{date}</div>
      <div>
        {onOpen ? (
          <button type="button" className="text-left font-medium" onClick={onOpen} aria-expanded={open ? "true" : "false"}>
            {name}
            {badge ? <span className="ml-2 rounded-full bg-chip px-2 py-0.5 text-xs font-normal text-muted">{badge}</span> : null}
          </button>
        ) : (
          <div className="font-medium">
            {name}
            {badge ? <span className="ml-2 rounded-full bg-chip px-2 py-0.5 text-xs font-normal text-muted">{badge}</span> : null}
          </div>
        )}
        {extra}
        {details}
      </div>
      <div className={cn("tabular text-sm md:text-right", color)}>
        {paid ? (
          <>
            <div>Not counted</div>
            <div className="text-xs line-through">{formatMoney(Math.abs(amount))}</div>
          </>
        ) : badge === "Money back" ? (
          <span title="Lowers what you spent">−{formatMoney(Math.abs(amount))}</span>
        ) : (
          formatMoney(amount, { signed: amount > 0 })
        )}
      </div>
      <div className="space-y-2">
        {category}
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
      lines.push(
        [
          t.date,
          csvCell(displayMerchant(t.description)),
          income,
          expense,
          csvCell(sheetCategory(categories, t)),
          csvCell(countsLabel(t)),
        ].join(","),
      );
    }
    downloadText(`harbor-${ym}.csv`, lines.join("\r\n"), "text/csv;charset=utf-8");
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
        <table className="sheet-table sheet-rise w-full min-w-[40rem] text-sm">
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
                  <td className="px-3 py-2">{sheetCategory(categories, t)}</td>
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

function Quiet({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={cn("min-h-9 text-xs text-muted", danger ? "hover:text-danger" : "hover:text-fg")} onClick={onClick}>
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
