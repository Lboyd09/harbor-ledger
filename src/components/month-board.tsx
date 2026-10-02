import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney } from "@/lib/budget/money";
import { groupMonth, type MonthGroup } from "@/lib/budget/month-view";
import { currentMonthKey, monthKeyFromDate, monthLabel, monthShort, shiftMonth } from "@/lib/budget/parse-date";
import { hasMonthOverride, planAmount } from "@/lib/budget/plans";
import { closestAmount, paybackNote } from "@/lib/budget/payback";
import { piecesOf } from "@/lib/budget/splits";
import { downloadText } from "@/lib/budget/download";
import type { Category, Transaction } from "@/lib/budget/types";
import { buildYearWorkbook, monthsOfYear, statusLabel } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { CashChart } from "./cash-chart";
import { CategorySelect } from "./category-select";
import { MonthRail } from "./month-rail";
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

export function MonthBoard() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const countHiddenDeposits = useBudgetStore((s) => s.countHiddenDeposits);
  const loadSample = useBudgetStore((s) => s.loadSample);
  const ledgerName = useBudgetStore((s) => s.profile.ledgerName);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [divideKey, setDivideKey] = useState<string | null>(null);
  const [paybackId, onPayback] = useState<string | null>(null);

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

  function onCategory(id: string, _merchantKey: string, _sample: string, categoryId: string | null) {
    setTransactionCategory(id, categoryId, false);
    setNotice("Saved on this row only. Other charges with the same name are unchanged.");
  }

  if (!transactions.length) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <h1 className="font-display text-3xl font-semibold">Start with one month</h1>
        <p className="text-sm text-muted">
          Import a bank CSV. Income and expenses stay in two lists. Open a row to divide a deposit, or choose Payback on an expense.
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
          <p className="mt-1 max-w-xl text-sm text-muted">
            Income is money you kept. Expenses are money you spent. Open a row to divide one deposit or charge into two categories. On an expense, Payback is in the category list.
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

        {inMonth.length === 0 ? (
          <EmptyMonth ym={ym} transactions={transactions} onJump={setActiveMonth} />
        ) : null}

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
          hint="Money you kept. Open a row to divide one deposit into two categories. Another deposit can use a different one."
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
          monthBudgets={monthBudgets}
        />
        <Section
          title="Expenses"
          kicker="Money out"
          hint="Money you spent. Payback is at the bottom of the category list. The box on the category is this month only."
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
          monthBudgets={monthBudgets}
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
  focus,
  divideKey,
  paybackId,
  onPayback,
  onFocus,
  onDivide,
  onCategory,
  onNotice,
  ym,
  monthBudgets,
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
  monthBudgets: { categoryId: string; ym: string; amount: number }[];
}) {
  const setMonthPlan = useBudgetStore((s) => s.setMonthPlan);
  const monthTx = useBudgetStore((s) => s.transactions);
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
          return (
            <div key={g.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className={cn("border-l-4 px-4 py-3", g.open ? "border-warn" : tone === "in" ? "border-good" : "border-danger")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className={cn("text-xs", over || behind ? "text-danger" : "text-muted")}>
                      {g.transactions.length} row{g.transactions.length === 1 ? "" : "s"}
                      {state ? ` · ${state}` : ""}
                    </div>
                  </div>
                  <div className={cn("tabular font-medium", tone === "in" ? "text-good" : "text-danger")}>{formatMoney(g.total)}</div>
                </div>
                {stored && stored.id !== "money-back" ? (
                  <label className="mt-2 flex max-w-xs flex-col gap-1 text-xs text-muted">
                    This month only
                    <Input
                      inputMode="decimal"
                      aria-label={`This month's budget for ${g.name}`}
                      value={hasMonthOverride(stored.id, ym, monthBudgets) ? String(planAmount(stored, ym, monthBudgets)) : ""}
                      placeholder={stored.plannedMonthly ? `Usual ${stored.plannedMonthly}` : "Uses usual plan"}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        setMonthPlan(stored.id, ym, raw ? Number(raw) || 0 : null);
                      }}
                    />
                    <span>Usual plan {formatMoney(stored.plannedMonthly)}. Clear the box to use it.</span>
                  </label>
                ) : null}
                {g.plan > 0 ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                    <div className={cn("h-full transition-[width] duration-300", over ? "bg-danger" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </div>
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
                        <div className="space-y-1">
                          <CategorySelect
                            categories={categories}
                            kind={tone === "in" ? "income" : "expense"}
                            payback={tone === "out" && t.status !== "refund"}
                            value={paid || (open && paybackId === t.id) ? "__payback__" : t.categoryId}
                            onPayback={() => {
                              onFocus(key);
                              onDivide(null);
                              onPayback(t.id);
                            }}
                            onChange={(id) => {
                              if (paid) useBudgetStore.getState().undoPaidBack(t.id);
                              onPayback(null);
                              onCategory(t.id, t.merchantKey, t.description, id);
                            }}
                          />
                          {t.status === "posted" && !paid ? (
                            <button
                              type="button"
                              className="min-h-8 text-xs text-muted hover:text-fg"
                              onClick={() => {
                                onPayback(null);
                                onFocus(key);
                                onDivide(key);
                              }}
                            >
                              Divide this row
                            </button>
                          ) : null}
                          {otherCats.length ? (
                            <p className="text-xs text-muted">
                              Another {displayMerchant(t.description)} this month is {otherCats.map((id) => catName(categories, id)).join(" or ")}. This row can differ.
                            </p>
                          ) : null}
                        </div>
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
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const paycheck = isPaycheck(categories, t);
  const note = paybackNote(t.notes);
  const pieces = piecesOf(t);

  return (
    <div className="mt-2 space-y-3 text-sm">
      {t.status === "reimbursement" ? (
        <p className="text-muted">
          Out of this month{note ? ` — ${note}` : ". Someone paid this back."}{" "}
          <Quiet
            onClick={() => {
              useBudgetStore.getState().undoPaidBack(t.id);
              onNotice("Counted again.");
            }}
          >
            Undo payback
          </Quiet>
        </p>
      ) : (
        <p className="text-muted">
          This row only. Another charge with the same name can use a different category. The overall category stays on
          the dropdown.
        </p>
      )}
      {t.status === "posted" ? (
        <SplitEditor t={t} tone={tone} categories={categories} onNotice={onNotice} openNow={Boolean(divide)} />
      ) : null}
      <div className="flex flex-wrap gap-3">
        {t.categoryId && t.status === "posted" ? (
          <Quiet
            onClick={() => {
              setTransactionCategory(t.id, t.categoryId, true);
              onNotice("Every row with this name now uses that category.");
            }}
          >
            Use this category for every {displayMerchant(t.description)}
          </Quiet>
        ) : null}
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
      <p className="font-medium">Match the money that paid this back</p>
      <p className="text-xs text-muted">
        {close && suggested
          ? `Closest in this month: ${dayLabel(suggested.date)} · ${displayMerchant(suggested.description)} · ${formatMoney(suggested.amount)}. Matching takes both rows out of the month.`
          : suggested
            ? `Nothing is close to ${formatMoney(Math.abs(t.amount))}. Nearest is listed first. Pick it only if that money really paid this back.`
            : "No deposit to match yet. You can still leave this purchase out of spending."}
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
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm ${on ? "bg-chip" : "hover:bg-chip"}`}
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
          {chosen ? "Cancel both out" : "Leave out of spending"}
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
