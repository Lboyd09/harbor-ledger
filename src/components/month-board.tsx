import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney } from "@/lib/budget/money";
import { groupMonth, type MonthGroup } from "@/lib/budget/month-view";
import { monthLabel, monthShort, shiftMonth } from "@/lib/budget/parse-date";
import { TX_STATUS_LABEL } from "@/lib/budget/tx-status";
import { buildYearWorkbook, monthsOfYear, statusLabel } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import type { TxStatus } from "@/lib/budget/types";
import { CategorySelect } from "./category-select";
import { MonthRail } from "./month-rail";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";

const STATUSES: TxStatus[] = ["posted", "refund", "transfer", "reimbursement"];

function dayLabel(iso: string) {
  return `${monthShort(iso.slice(0, 7))} ${Number(iso.slice(8, 10))}`;
}

export function MonthBoard() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const deleteTransaction = useBudgetStore((s) => s.deleteTransaction);
  const loadSample = useBudgetStore((s) => s.loadSample);
  const ledgerName = useBudgetStore((s) => s.profile.ledgerName);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

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

  if (!transactions.length) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <h1 className="font-display text-3xl font-semibold">Start with one month</h1>
        <p className="text-sm text-muted">
          Import a bank CSV. Harbor opens that month with income and expenses in two separate lists, so you can set a
          category on each charge.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/import">
            <Button>Import a CSV</Button>
          </Link>
          <Button variant="outline" onClick={() => loadSample()}>
            Try a demo ledger
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
            Income is listed above expenses. Pick a category on a row — that merchant updates in every month.
          </p>
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
          setActiveMonth(key);
        }}
      />

      <div key={ym} className="rise space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary
            label="Income"
            value={formatMoney(layout.incomeTotal)}
            hint={monthCell && monthCell.planIncome > 0 ? `${formatMoney(monthCell.planIncome)} planned` : "Money in this month"}
          />
          <Summary
            label="Expenses"
            value={formatMoney(layout.expenseTotal)}
            hint={monthCell ? statusLabel(monthCell.status) : "Money out this month"}
            warn={monthCell?.status === "over"}
          />
          <Summary
            label="Left"
            value={formatMoney(layout.incomeTotal - layout.expenseTotal, { signed: true })}
            hint="Income minus expenses"
            warn={layout.incomeTotal - layout.expenseTotal < 0}
          />
        </div>

        {layout.openCount > 0 ? (
          <p className="rounded-md border border-warn/40 bg-chip px-4 py-3 text-sm">
            {layout.openCount} charge{layout.openCount === 1 ? "" : "s"} in {monthLabel(ym)} still need a category.
            They are at the top of each list.
          </p>
        ) : null}
        {notice ? <p className="rounded-md bg-chip px-4 py-3 text-sm">{notice}</p> : null}

        <label className="flex max-w-md flex-col gap-1">
          <span className="text-sm text-muted">Search this month</span>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rent, paycheck, Netflix…" />
        </label>

        <Section
          title="Income"
          hint="Deposits and paychecks"
          groups={income}
          empty="No income in this month."
          tone="in"
          onCategory={(id, merchantKey, sample, categoryId) => {
            const n = transactions.filter((t) => t.merchantKey === merchantKey).length;
            setTransactionCategory(id, categoryId, true);
            setNotice(`Updated ${n} ${displayMerchant(sample)} charge${n === 1 ? "" : "s"} — every month, not just this one.`);
          }}
        />
        <Section
          title="Expenses"
          hint="What you spent"
          groups={expenses}
          empty="No expenses in this month."
          tone="out"
          onCategory={(id, merchantKey, sample, categoryId) => {
            const n = transactions.filter((t) => t.merchantKey === merchantKey).length;
            setTransactionCategory(id, categoryId, true);
            setNotice(`Updated ${n} ${displayMerchant(sample)} charge${n === 1 ? "" : "s"} — every month, not just this one.`);
          }}
        />

        {layout.aside.length ? (
          <details className="rounded-lg border border-border bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Not in the budget ({layout.aside.length})
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {layout.aside.map((t) => (
                <TxRow
                  key={t.id}
                  date={dayLabel(t.date)}
                  name={displayMerchant(t.description)}
                  amount={t.amount}
                  muted
                  category={
                    <CategorySelect
                      categories={categories}
                      value={t.categoryId}
                      onChange={(id) => setTransactionCategory(t.id, id, true)}
                    />
                  }
                  extra={
                    <Flags
                      excluded={t.excluded}
                      status={t.status}
                      onStatus={(status) => patchTransaction(t.id, { status })}
                      onExcluded={(excluded) => patchTransaction(t.id, { excluded })}
                      onRemove={() => deleteTransaction(t.id)}
                    />
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
  hint,
  groups,
  empty,
  tone,
  onCategory,
}: {
  title: string;
  hint: string;
  groups: MonthGroup[];
  empty: string;
  tone: "in" | "out";
  onCategory: (id: string, merchantKey: string, sample: string, categoryId: string | null) => void;
}) {
  const categories = useBudgetStore((s) => s.categories);
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const deleteTransaction = useBudgetStore((s) => s.deleteTransaction);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {groups.length === 0 ? <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">{empty}</p> : null}
      <div className="space-y-3">
        {groups.map((g) => {
          const over = tone === "out" && g.plan > 0 && g.total > g.plan + 0.5;
          const behind = tone === "in" && g.plan > 0 && g.total + 0.5 < g.plan;
          const pct = g.plan > 0 ? Math.min(100, Math.round((Math.max(0, g.total) / g.plan) * 100)) : 0;
          const state = over ? "Over" : behind ? "Behind" : g.plan > 0 ? "On track" : "";
          return (
            <div key={g.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className={cn("border-l-4 px-4 py-3", g.open ? "border-warn" : tone === "in" ? "border-good" : "border-danger/70")}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className={cn("text-xs", over || behind ? "text-danger" : "text-muted")}>
                      {g.transactions.length} charge{g.transactions.length === 1 ? "" : "s"}
                      {g.plan > 0 ? ` · plan ${formatMoney(g.plan)}` : ""}
                      {state ? ` · ${state}` : ""}
                    </div>
                  </div>
                  <div className={cn("tabular font-medium", tone === "in" ? "text-good" : "")}>
                    {formatMoney(g.total)}
                  </div>
                </div>
                {g.plan > 0 ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                    <div className={cn("h-full transition-[width] duration-300", over ? "bg-danger" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {g.transactions.map((t) => (
                  <TxRow
                    key={t.id}
                    date={dayLabel(t.date)}
                    name={displayMerchant(t.description)}
                    amount={t.amount}
                    category={
                      <CategorySelect
                        categories={categories}
                        value={t.categoryId}
                        onChange={(id) => onCategory(t.id, t.merchantKey, t.description, id)}
                      />
                    }
                    extra={
                      <Flags
                        excluded={t.excluded}
                        status={t.status}
                        onStatus={(status) => patchTransaction(t.id, { status })}
                        onExcluded={(excluded) => patchTransaction(t.id, { excluded })}
                        onRemove={() => deleteTransaction(t.id)}
                      />
                    }
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TxRow({
  date,
  name,
  amount,
  category,
  extra,
  muted,
}: {
  date: string;
  name: string;
  amount: number;
  category: ReactNode;
  extra?: ReactNode;
  muted?: boolean;
}) {
  return (
    <li className={cn("grid gap-2 px-4 py-3 md:grid-cols-[5.5rem_1fr_7rem_16rem] md:items-center", muted && "opacity-70")}>
      <div className="text-sm text-muted tabular">{date}</div>
      <div className="font-medium">{name}</div>
      <div className={cn("tabular text-sm md:text-right", amount < 0 ? "text-danger" : "text-good")}>
        {formatMoney(amount, { signed: true })}
      </div>
      <div className="space-y-2">
        {category}
        {extra}
      </div>
    </li>
  );
}

function Flags({
  excluded,
  status,
  onStatus,
  onExcluded,
  onRemove,
}: {
  excluded: boolean;
  status: TxStatus;
  onStatus: (status: TxStatus) => void;
  onExcluded: (excluded: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer">Refund, transfer, or exclude</summary>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select className="min-h-9 w-36" value={status} aria-label="Row type" onChange={(e) => onStatus(e.target.value as TxStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {TX_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <label className="flex min-h-9 items-center gap-2">
          <input type="checkbox" checked={excluded} onChange={(e) => onExcluded(e.target.checked)} />
          Exclude
        </label>
        <button type="button" className="hover:text-danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </details>
  );
}

function Summary({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-semibold tabular", warn && "text-danger")}>{value}</div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </div>
  );
}
