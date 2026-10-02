import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoryDrift, monthReview, subscriptionFlags, weekdayHeat } from "@/lib/budget/insights";
import { formatMoney } from "@/lib/budget/money";
import { monthShort } from "@/lib/budget/parse-date";
import { buildYearWorkbook, monthsOfYear, statusLabel, type MonthStatus, type YearWorkbook } from "@/lib/budget/year";
import type { Category, Transaction } from "@/lib/budget/types";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { CashChart } from "./cash-chart";
import { MonthRail } from "./month-rail";
import { SummaryCard } from "./summary-card";
import { useLivelyMotion } from "./use-lively-motion";
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
  const detail = useBudgetStore((s) => s.profile.detail ?? "simple");
  const buckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"summary" | "charts" | "grid">("summary");
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
  const review = monthReview({ ym: activeMonth, transactions, categories, buckets, moves });
  const nerd = detail === "nerd";

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

      {nerd ? <YearNerd year={year} ym={activeMonth} transactions={transactions} categories={categories} /> : null}

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["summary", "Summary"],
            ["charts", "Charts"],
            ["grid", "Spreadsheet"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm",
              panel === id ? "bg-primary text-primary-fg" : "border border-border bg-surface",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Income"
          value={formatMoney(book.income)}
          sentence={income.length ? `${income.length} sources this year.` : "No income categorized yet."}
          tone="in"
        />
        <SummaryCard
          label="Expenses"
          value={formatMoney(book.expenses)}
          sentence={expenses.length ? `${expenses.length} categories this year.` : "No spending categorized yet."}
          tone="out"
        />
        <SummaryCard
          label="Saved"
          value={formatMoney(book.net, { signed: true })}
          sentence={book.income > 0 ? `${Math.round(book.savingsRate * 100)}% of income was left.` : "No income yet."}
          warn={book.net < 0}
        >
          <p>{review.action}</p>
          {review.rolled.length ? (
            <p>Rolled forward: {review.rolled.map((r) => `${r.name} ${formatMoney(r.delta)}`).join(", ")}.</p>
          ) : (
            <p>Nothing extra rolled into a bucket.</p>
          )}
          <p>{review.over.length ? `Over plan: ${review.over.join(", ")}.` : "No category ran past its plan."}</p>
        </SummaryCard>
      </div>

      {panel === "charts" ? (
        <YearCharts book={book} />
      ) : panel === "grid" ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Year spreadsheet</h2>
          <YearSheet embedded />
        </section>
      ) : (
        <>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Income and spending</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Green is money you kept. Red is money you spent. A purchase someone paid you back for is in neither bar.
        </p>
        <div className="chart-rise">
        <CashChart
          data={chart}
          bars={[
            { key: "In", fill: "var(--color-good)" },
            { key: "Out", fill: "var(--color-danger)" },
          ]}
        />
        </div>
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
        <p className="text-sm text-muted">The full grid is also under Spreadsheet, above.</p>
        <YearSheet embedded />
      </section>
        </>
      )}
    </div>
  );
}

function YearCharts({ book }: { book: YearWorkbook }) {
  const lively = useLivelyMotion();
  const active = book.monthSummaries.filter((m) => m.count > 0);
  const bars = active.map((m) => ({ name: monthShort(m.ym), In: m.income, Out: m.expenses }));
  const line = active.map((m) => ({ name: monthShort(m.ym), Left: m.net }));
  const cats = book.expenseRows
    .filter((r) => r.yearTotal > 0)
    .slice(0, 8)
    .map((r) => ({ name: r.name, Spent: r.yearTotal }));
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Income and spending by month</h2>
        <p className="mt-1 mb-3 text-sm text-muted">Green stayed. Red left. Paybacks are in neither.</p>
        <div className="chart-rise">
        <CashChart
          data={bars}
          bars={[
            { key: "In", fill: "var(--color-good)" },
            { key: "Out", fill: "var(--color-danger)" },
          ]}
        />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">What was left each month</h2>
        <div className="chart-rise h-56 w-full">
          {line.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={line} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
                <Tooltip
                  formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))}
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="Left" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={lively} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted">Nothing to chart yet.</p>
          )}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Where the year went</h2>
        <p className="mt-1 mb-3 text-sm text-muted">Largest spending categories. Money a store gave back is already taken out.</p>
        <div className="chart-rise">
        <CashChart data={cats} layout="vertical" bars={[{ key: "Spent", fill: "var(--color-danger)" }]} />
        </div>
      </section>
    </div>
  );
}

function YearNerd({
  year,
  ym,
  transactions,
  categories,
}: {
  year: string;
  ym: string;
  transactions: Transaction[];
  categories: Category[];
}) {
  const heat = weekdayHeat(transactions, year);
  const drift = categoryDrift(transactions, categories, ym);
  const subs = subscriptionFlags(transactions).slice(0, 8);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Nerd notes</h2>
      <div>
        <h3 className="text-sm font-medium">Spending by weekday</h3>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {heat.map((day) => (
            <div key={day.label} className="text-center text-xs">
              <div className="mx-auto h-8 w-full rounded-sm" style={{ background: `color-mix(in srgb, var(--color-primary) ${Math.round(day.level * 80 + 8)}%, var(--color-chip))` }} />
              <div className="mt-1">{day.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium">Drift vs the last 3 months</h3>
        {drift.length ? (
          <ul className="mt-1 text-sm">
            {drift.map((row) => (
              <li key={row.id}>
                {row.name}: {formatMoney(row.current)} now, {formatMoney(row.average)} typical ({formatMoney(row.delta, { signed: true })}).
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">No category moved far from its recent average.</p>
        )}
      </div>
      <div>
        <h3 className="text-sm font-medium">Repeating charges</h3>
        {subs.length ? (
          <ul className="mt-1 text-sm">
            {subs.map((g) => (
              <li key={g.merchantKey}>
                {g.sampleDescription}: {formatMoney(g.last)}
                {g.changed ? ` — price changed from ${formatMoney(g.median)}` : " — same price"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">No repeating charge yet.</p>
        )}
      </div>
    </section>
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
