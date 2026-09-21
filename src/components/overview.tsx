import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { countsInCashflow } from "@/lib/budget/totals";
import { formatMoney } from "@/lib/budget/money";
import { displayMerchant } from "@/lib/budget/merchant";
import { monthShort } from "@/lib/budget/parse-date";
import { buildYearWorkbook, statusLabel, yearInsights, type MonthStatus, type YearWorkbook } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { GuideCard } from "./guide-card";
import { YearSwitcher } from "./year-switcher";
import { Button } from "./ui/button";

function tone(status: MonthStatus) {
  if (status === "over" || status === "behind") return "text-danger";
  if (status === "on-track") return "text-good";
  return "text-muted";
}

function Kpi({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-semibold tabular", warn && "text-danger")}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

function EmptyLedger() {
  const loadSample = useBudgetStore((s) => s.loadSample);
  return (
    <div className="mx-auto max-w-lg space-y-4 py-6">
      <h1 className="font-display text-3xl font-semibold">Start with a bank file</h1>
      <p className="text-sm text-muted">
        Import a CSV. Harbor builds a year sheet — income sources, expense categories, and whether each month stayed on
        plan. Nothing logs into a bank.
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

function YearMatrix({ book, activeYm, onPick }: { book: YearWorkbook; activeYm: string; onPick: (ym: string) => void }) {
  const rows: { label: string; values: number[]; year: number; signed?: boolean }[] = [
    { label: "Income", values: book.monthSummaries.map((m) => m.income), year: book.income },
    { label: "Spending", values: book.monthSummaries.map((m) => m.expenses), year: book.expenses },
    { label: "Leftover", values: book.monthSummaries.map((m) => m.net), year: book.net, signed: true },
  ];
  return (
    <div className="sheet-wrap rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b border-border text-muted">
            <th className="sticky left-0 bg-surface px-3 py-2 text-left font-medium"> </th>
            {book.monthSummaries.map((m) => (
              <th key={m.ym} className="px-1 py-2 text-right font-medium">
                <button
                  type="button"
                  onClick={() => onPick(m.ym)}
                  className={cn("rounded-sm px-1", m.ym === activeYm && "bg-chip text-fg")}
                >
                  {monthShort(m.ym)}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Year</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/70">
              <th className="sticky left-0 bg-surface px-3 py-1.5 text-left font-medium">{r.label}</th>
              {r.values.map((n, i) => (
                <td
                  key={book.months[i]}
                  className={cn(
                    "whitespace-nowrap px-2 py-1.5 text-right tabular",
                    r.signed && n < 0 && "text-danger",
                    r.signed && n > 0 && "text-good",
                  )}
                >
                  {formatMoney(n, { dashZero: true, signed: r.signed })}
                </td>
              ))}
              <td
                className={cn(
                  "whitespace-nowrap px-3 py-1.5 text-right font-medium tabular",
                  r.signed && r.year < 0 && "text-danger",
                  r.signed && r.year > 0 && "text-good",
                )}
              >
                {formatMoney(r.year, { signed: r.signed })}
              </td>
            </tr>
          ))}
          <tr>
            <th className="sticky left-0 bg-surface px-3 py-1.5 text-left font-medium text-muted">Status</th>
            {book.monthSummaries.map((m) => (
              <td key={m.ym} className={cn("px-2 py-1.5 text-right text-xs", tone(m.status))}>
                {m.count ? statusLabel(m.status) : "—"}
              </td>
            ))}
            <td className="px-3 py-1.5 text-right text-xs text-muted">
              {book.monthsOnTrack}/{book.activeMonths} on track
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function DesktopOverview() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const profile = useBudgetStore((s) => s.profile);
  const ym = useBudgetStore((s) => s.activeMonth);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const year = ym.slice(0, 4);
  const book = buildYearWorkbook(transactions, categories, year);
  const insights = yearInsights(book).slice(0, 2);
  const chart = book.monthSummaries.map((m) => ({
    name: monthShort(m.ym),
    In: Math.round(m.income),
    Out: Math.round(m.expenses),
  }));
  const deposits = transactions
    .filter((t) => t.date.startsWith(year) && countsInCashflow(t) && t.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!transactions.length) return <EmptyLedger />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{profile.ledgerName || "Year outlook"}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            {year} as a whole. Income is every paycheck and side source. Spending is every expense category. Saved is
            what was left after spending.
          </p>
        </div>
        <YearSwitcher />
      </div>

      <GuideCard />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Income"
          value={formatMoney(book.income)}
          hint={`${book.incomeRows.length} sources · typical ${formatMoney(book.avgMonthlyIncome)} / mo`}
        />
        <Kpi
          label="Spending"
          value={formatMoney(book.expenses)}
          hint={`${book.expenseRows.length} categories · typical ${formatMoney(book.avgMonthlyExpenses)} / mo`}
        />
        <Kpi
          label="Saved"
          value={formatMoney(book.net, { signed: true })}
          hint={book.savingsMoved > 0 ? `Moved to savings ${formatMoney(book.savingsMoved)}` : "Income minus spending"}
          warn={book.net < 0}
        />
        <Kpi
          label="Savings rate"
          value={book.income > 0 ? `${Math.round(book.savingsRate * 100)}%` : "—"}
          hint={
            book.usingSuggestedPlan
              ? `On-track uses typical months (${formatMoney(book.planExpenses)} / mo)`
              : `Plan leftover ${formatMoney(book.planLeftover, { signed: true })} / mo`
          }
          warn={book.net < 0}
        />
      </div>

      {insights.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {insights.map((i) => (
            <li key={i.id} className="rounded-lg border border-border bg-surface px-4 py-3">
              <div className={cn("text-sm font-medium", i.tone === "warn" && "text-danger", i.tone === "good" && "text-good")}>
                {i.title}
              </div>
              <p className="mt-1 text-sm text-muted">{i.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {book.uncategorized > 0 ? (
        <Link to="/categories" className="block rounded-md border border-warn/40 bg-chip px-4 py-3 text-sm">
          {book.uncategorized} row{book.uncategorized === 1 ? "" : "s"} still need a category. Open Categories — most
          repeated merchants are at the top. One change updates every matching row.
        </Link>
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold">{year} by month</h2>
            <p className="text-sm text-muted">
              On track means spending stayed at or under the monthly plan
              {book.usingSuggestedPlan ? " (typical months from your file)" : ""}. Tap a month name to inspect it on
              Activity.
            </p>
          </div>
          <Link to="/year" className="text-sm text-primary underline-offset-2 hover:underline">
            Open the full year sheet
          </Link>
        </div>
        <div className="mt-3">
          <YearMatrix book={book} activeYm={ym} onPick={setActiveMonth} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Income sources</h2>
          <p className="mt-1 text-sm text-muted">What came in this year, and the typical month for each source.</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 text-left font-medium">Source</th>
                <th className="py-2 text-right font-medium">Year</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">Typical / mo</th>
              </tr>
            </thead>
            <tbody>
              {book.incomeRows
                .filter((r) => r.yearTotal !== 0)
                .map((r) => (
                <tr key={r.id} className="border-b border-border/70">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right tabular">{formatMoney(r.yearTotal)}</td>
                  <td className="hidden py-2 text-right tabular text-muted sm:table-cell">
                    {formatMoney(r.typical, { dashZero: true })}
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2">Total income</td>
                <td className="py-2 text-right tabular">{formatMoney(book.income)}</td>
                <td className="hidden sm:table-cell" />
              </tr>
              {book.incomeRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-muted">
                    No income categorized yet. Assign paychecks on Categories.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Expense categories</h2>
          <p className="mt-1 text-sm text-muted">Largest buckets first. Over means the year ran past the monthly plan.</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 text-left font-medium">Category</th>
                <th className="py-2 text-right font-medium">Year</th>
                <th className="py-2 text-right font-medium">Typical</th>
                <th className="py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {book.expenseRows
                .filter((r) => r.yearTotal !== 0)
                .map((r) => (
                <tr key={r.id} className="border-b border-border/70">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right tabular">{formatMoney(r.yearTotal, { dashZero: true })}</td>
                  <td className="py-2 text-right tabular text-muted">{formatMoney(r.typical, { dashZero: true })}</td>
                  <td className={cn("py-2 text-right text-xs", tone(r.status))}>{statusLabel(r.status)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2">Total spending</td>
                <td className="py-2 text-right tabular">{formatMoney(book.expenses)}</td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Every deposit</h2>
        <p className="mt-1 text-sm text-muted">Each income row this year, newest first.</p>
        <ul className="mt-3 divide-y divide-border">
          {deposits.slice(0, 12).map((t) => (
            <li key={t.id} className="flex justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="text-muted">{t.date}</span>
                <span className="mx-2 text-muted">·</span>
                {displayMerchant(t.description)}
              </span>
              <span className="shrink-0 tabular text-good">{formatMoney(t.amount, { signed: true })}</span>
            </li>
          ))}
          {deposits.length === 0 ? <li className="py-3 text-sm text-muted">No income posted this year yet.</li> : null}
        </ul>
        {deposits.length > 12 ? (
          <p className="mt-2 text-xs text-muted">{deposits.length - 12} more on Activity.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Cash in and out</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => formatMoney(Number(v))} />
              <Bar dataKey="In" fill="var(--color-good)" radius={2} />
              <Bar dataKey="Out" fill="var(--color-danger)" radius={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

export function MobileOverview() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const loadSample = useBudgetStore((s) => s.loadSample);
  const year = ym.slice(0, 4);
  const book = buildYearWorkbook(transactions, categories, year);
  const max = Math.max(...book.expenseRows.map((r) => r.yearTotal), 1);

  if (!transactions.length) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold">Start with a file</h1>
        <p className="text-sm text-muted">Import a CSV to see the year: income, spending, and whether each month stayed on plan.</p>
        <Link to="/import">
          <Button className="w-full">Import a CSV</Button>
        </Link>
        <Button variant="outline" className="w-full" onClick={() => loadSample()}>
          Try a demo ledger
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <YearSwitcher />
      <GuideCard />
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{year} leftover</div>
        <div className={cn("font-display text-4xl font-semibold tabular", book.net < 0 ? "text-danger" : "text-good")}>
          {formatMoney(book.net, { signed: true })}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
          <span>In {formatMoney(book.income)}</span>
          <span>Out {formatMoney(book.expenses)}</span>
          <span>{book.income > 0 ? `${Math.round(book.savingsRate * 100)}% saved` : "No income yet"}</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Typical month {formatMoney(book.avgMonthlyIncome)} in, {formatMoney(book.avgMonthlyExpenses)} out ·{" "}
          {book.monthsOnTrack}/{book.activeMonths} months on track
        </p>
      </div>
      {book.uncategorized > 0 ? (
        <Link to="/categories" className="block rounded-md bg-chip px-3 py-3 text-sm">
          {book.uncategorized} need a category — fix them on Categories
        </Link>
      ) : null}
      <div>
        <div className="text-sm font-medium">Income each month</div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {book.monthSummaries.map((m) => (
            <button
              key={m.ym}
              type="button"
              onClick={() => setActiveMonth(m.ym)}
              className={cn(
                "min-w-20 shrink-0 rounded-md border px-3 py-2 text-left",
                m.ym === ym ? "border-primary bg-chip" : "border-border bg-surface",
              )}
            >
              <div className="text-xs text-muted">{monthShort(m.ym)}</div>
              <div className="text-sm tabular">{formatMoney(m.income, { dashZero: true })}</div>
              <div className={cn("text-xs", tone(m.status))}>{m.count ? statusLabel(m.status) : "—"}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Spending this year</h2>
          <Link to="/year" className="text-sm text-primary">
            Sheet
          </Link>
        </div>
        <ul className="mt-3 space-y-3">
          {book.expenseRows.slice(0, 6).map((r) => (
            <li key={r.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{r.name}</span>
                <span className="tabular">{formatMoney(r.yearTotal)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-chip">
                <div className="h-full bg-primary" style={{ width: `${(r.yearTotal / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold">Income sources</h2>
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
          {book.incomeRows.map((r) => (
            <li key={r.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
              <span>{r.name}</span>
              <span className="tabular">{formatMoney(r.yearTotal)}</span>
            </li>
          ))}
          {book.incomeRows.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">Assign paychecks on Categories.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
