import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { formatMoney } from "@/lib/budget/money";
import { monthShort } from "@/lib/budget/parse-date";
import { buildYearWorkbook, monthsOfYear, statusLabel, type MonthStatus } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { CashChart } from "./cash-chart";
import { MonthRail } from "./month-rail";
import { Button } from "./ui/button";
import { YearSheet } from "./year-sheet";
import { YearSwitcher } from "./year-switcher";

function tone(status: MonthStatus) {
  if (status === "over") return "text-danger";
  if (status === "on-track") return "text-good";
  return "text-muted";
}

export function YearHome() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const activeMonth = useBudgetStore((s) => s.activeMonth);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const loadSample = useBudgetStore((s) => s.loadSample);
  const navigate = useNavigate();
  const year = activeMonth.slice(0, 4);
  const book = useMemo(() => buildYearWorkbook(transactions, categories, year), [transactions, categories, year]);

  function openMonth(ym: string) {
    setActiveMonth(ym);
    void navigate({ to: "/" });
  }

  if (!transactions.length) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <h1 className="font-display text-3xl font-semibold">The year, once you have a file</h1>
        <p className="text-sm text-muted">Import a CSV, then pick any month from here to edit it.</p>
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

  const income = book.incomeRows.filter((r) => r.yearTotal !== 0);
  const expenses = book.expenseRows.filter((r) => r.yearTotal !== 0);
  const chart = book.monthSummaries
    .filter((m) => m.count > 0)
    .map((m) => ({ name: monthShort(m.ym), In: m.income, Out: m.expenses }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">{year}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Income and expenses stay in two lists. The spreadsheet under this page is the same year as a grid.
          </p>
        </div>
        <YearSwitcher />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Income" value={formatMoney(book.income)} hint={`${income.length} sources`} />
        <Stat label="Expenses" value={formatMoney(book.expenses)} hint={`${expenses.length} categories`} />
        <Stat
          label="Saved"
          value={formatMoney(book.net, { signed: true })}
          hint={book.income > 0 ? `${Math.round(book.savingsRate * 100)}% leftover` : "No income yet"}
          warn={book.net < 0}
        />
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Income and spending</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Green is money you kept. Red is money you spent. A purchase someone paid you back for is in neither bar.
        </p>
        <CashChart
          data={chart}
          bars={[
            { key: "In", fill: "var(--color-good)" },
            { key: "Out", fill: "var(--color-danger)" },
          ]}
        />
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Open a month</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          {book.monthsOnTrack} of {book.activeMonths || 0} months with activity stayed on plan.
        </p>
        <MonthRail
          months={monthsOfYear(year)}
          active={activeMonth}
          statusOf={(ym) => book.monthSummaries.find((m) => m.ym === ym)?.status ?? "empty"}
          onPick={openMonth}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <List title="Income" hint="Money in this year — paychecks and other deposits">
          {income.map((r) => (
            <Row key={r.id} name={r.name} amount={formatMoney(r.yearTotal)} note={`${formatMoney(r.typical)} typical / mo`} />
          ))}
          <Row name="Total income" amount={formatMoney(book.income)} strong />
          {income.length === 0 ? <p className="px-4 py-4 text-sm text-muted">No income categorized yet.</p> : null}
        </List>
        <List title="Expenses" hint="Money out this year — never mixed with income">
          {expenses.map((r) => (
            <Row
              key={r.id}
              name={r.name}
              amount={formatMoney(r.yearTotal)}
              note={statusLabel(r.status)}
              noteClass={tone(r.status)}
            />
          ))}
          <Row name="Total expenses" amount={formatMoney(book.expenses)} strong />
        </List>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Year spreadsheet</h2>
        <YearSheet embedded />
      </section>
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-semibold tabular", warn && "text-danger")}>{value}</div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </div>
  );
}

function List({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

function Row({
  name,
  amount,
  note,
  noteClass,
  strong,
}: {
  name: string;
  amount: string;
  note?: string;
  noteClass?: string;
  strong?: boolean;
}) {
  return (
    <li className={cn("flex items-baseline justify-between gap-3 px-4 py-3", strong && "bg-chip font-medium")}>
      <div>
        <div>{name}</div>
        {note ? <div className={cn("text-xs text-muted", noteClass)}>{note}</div> : null}
      </div>
      <div className="tabular">{amount}</div>
    </li>
  );
}
