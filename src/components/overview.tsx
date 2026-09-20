import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryShares, dailyAverage, habitInsights, topMerchants, weekdaySpend } from "@/lib/budget/habits";
import { formatMoney } from "@/lib/budget/money";
import { monthLabel, shiftMonth, shiftWeek, weekLabel } from "@/lib/budget/parse-date";
import { periodNoun } from "@/lib/budget/period";
import { findRecurring } from "@/lib/budget/recurring";
import { envelopeRows, inPeriod, monthlySeries, periodCash, plannedTotals, weeklySeries, yearCash } from "@/lib/budget/totals";
import { useBudgetStore } from "@/store/budget-store";
import { MonthSwitcher } from "./month-switcher";
import { Button } from "./ui/button";

const PIE = [
  "var(--color-primary)",
  "var(--color-warn)",
  "var(--color-danger)",
  "var(--color-muted)",
  "var(--color-line)",
  "var(--color-good)",
];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

function EmptyLedger() {
  const loadSample = useBudgetStore((s) => s.loadSample);
  return (
    <div className="mx-auto max-w-lg space-y-4 py-6">
      <h1 className="font-display text-3xl font-semibold">Nothing imported yet</h1>
      <p className="text-sm text-muted">
        Categories are ready and saved to your account. Next, bring in a CSV from your bank, or load the demo to see
        how the ledger reads.
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

export function DesktopOverview() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const profile = useBudgetStore((s) => s.profile);
  const ym = useBudgetStore((s) => s.activeMonth);
  const wk = useBudgetStore((s) => s.activeWeek);
  const period = profile.budgetPeriod;
  const key = period === "week" ? wk : ym;
  const prevKey = period === "week" ? shiftWeek(wk, -1) : shiftMonth(ym, -1);
  const cash = periodCash(transactions, period, key, categories);
  const year = yearCash(transactions, ym, categories);
  const plan = plannedTotals(categories, period);
  const rec = findRecurring(transactions).slice(0, 6);
  const months = period === "week" ? weeklySeries(transactions, categories) : monthlySeries(transactions, categories);
  const shares = categoryShares(transactions, categories, period, key);
  const inKeyTx = transactions.filter((t) => inPeriod(t, period, key));
  const merchants = topMerchants(inKeyTx, 6);
  const days = weekdaySpend(inKeyTx);
  const insights = habitInsights(transactions, categories, period, key, prevKey);
  const envelopes = envelopeRows(transactions, categories, period, key).filter((r) => r.category.kind === "expense");
  const avg = dailyAverage(inKeyTx, period);

  const chart = envelopes
    .map((r) => ({
      name: r.category.name,
      Planned: r.plan,
      Actual: Math.round(r.actual * 100) / 100,
    }))
    .filter((r) => r.Planned > 0 || r.Actual > 0);

  const pie = shares.filter((s) => s.actual > 0).map((s) => ({ name: s.name, value: Math.round(s.actual * 100) / 100 }));
  const trend = months.map((m) => ({
    name: period === "week" ? m.key.replace("W", "") : m.key.slice(5),
    In: Math.round(m.income),
    Out: Math.round(m.expenses),
  }));

  if (!transactions.length) return <EmptyLedger />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{profile.ledgerName || "Your outlook"}</h1>
          <p className="mt-1 text-sm text-muted">
            {period === "week" ? weekLabel(wk) : monthLabel(ym)}. Excluded rows and transfers stay out of these
            figures. Refunds reduce the matching expense bucket.
          </p>
        </div>
        <MonthSwitcher />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Income" value={formatMoney(cash.income)} hint={`Plan ${formatMoney(plan.income)}`} />
        <Kpi label="Spending" value={formatMoney(cash.expenses)} hint={`Plan ${formatMoney(plan.expenses)}`} />
        <Kpi
          label={plan.leftover >= 0 ? "Ready to assign" : "Over-assigned"}
          value={formatMoney(plan.leftover, { signed: true, dashZero: true })}
          hint="Planned income minus planned envelopes"
        />
        <Kpi
          label="Daily average"
          value={formatMoney(avg)}
          hint={`${cash.uncategorized} still open · ${cash.refunds} refunds`}
        />
      </div>
      <div className="rounded-lg border border-border bg-surface p-4 text-sm">
        <span className="font-medium">{year.year} so far</span>
        <span className="text-muted">
          {" "}
          · in {formatMoney(year.income)} · out {formatMoney(year.expenses)} · net{" "}
          {formatMoney(year.net, { signed: true })} · {year.count} rows
          {year.uncategorized ? ` · ${year.uncategorized} still open` : ""}
        </span>
      </div>
      {cash.uncategorized > 0 ? (
        <Link to="/activity" className="block rounded-md border border-warn/40 bg-chip px-4 py-3 text-sm text-fg">
          {cash.uncategorized} row{cash.uncategorized === 1 ? "" : "s"} still {cash.uncategorized === 1 ? "needs" : "need"} a category this {periodNoun(period)}.
        </Link>
      ) : null}

      {insights.length ? (
        <section className="grid gap-3 md:grid-cols-2">
          {insights.map((ins) => (
            <article key={ins.id} className="rounded-lg border border-border bg-surface p-4">
              <div className={`text-xs font-medium uppercase tracking-wide ${ins.tone === "warn" ? "text-warn" : ins.tone === "good" ? "text-good" : "text-muted"}`}>
                {ins.title}
              </div>
              <p className="mt-1 text-sm">{ins.body}</p>
            </article>
          ))}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Where spending went</h2>
          <div className="mt-4 h-72">
            {pie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} paddingAngle={2}>
                    {pie.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE[i % PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted">Assign categories to fill this chart.</p>
            )}
          </div>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Cash flow</h2>
          <div className="mt-4 h-72">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  <Line type="monotone" dataKey="In" stroke="var(--color-good)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Out" stroke="var(--color-danger)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted">Import a CSV to fill this chart.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Plan vs actual</h2>
          <div className="mt-4 h-72">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 32 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  <Bar dataKey="Planned" fill="var(--color-line)" radius={2} />
                  <Bar dataKey="Actual" fill="var(--color-primary)" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted">Import a CSV to fill this chart.</p>
            )}
          </div>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Weekday pattern</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Bar dataKey="spend" name="Spend" fill="var(--color-primary)" radius={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Top merchants</h2>
          <ul className="mt-3 space-y-2">
            {merchants.map((m) => (
              <li key={m.merchantKey} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{m.sample}</span>
                <span className="tabular text-muted">
                  {m.count}× · {formatMoney(m.spend)}
                </span>
              </li>
            ))}
            {merchants.length === 0 ? <li className="text-sm text-muted">No expenses yet.</li> : null}
          </ul>
          <h2 className="mt-6 font-display text-xl font-semibold">Repeating charges</h2>
          <ul className="mt-3 space-y-2">
            {rec.map((r) => (
              <li key={r.merchantKey} className="flex justify-between text-sm">
                <span className="truncate pr-3">
                  {r.merchantKey} · {r.interval} · {r.count}×
                </span>
                <span className="tabular">{formatMoney(r.avgAmount)}</span>
              </li>
            ))}
            {rec.length === 0 ? <li className="text-sm text-muted">Need at least two similar expenses.</li> : null}
          </ul>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Every imported {periodNoun(period)}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-3 font-medium">Period</th>
                  <th className="py-2 pr-3 text-right font-medium">In</th>
                  <th className="py-2 pr-3 text-right font-medium">Out</th>
                  <th className="py-2 pr-3 text-right font-medium">Net</th>
                  <th className="py-2 text-right font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key} className="border-b border-border/70">
                    <td className="py-2 pr-3">{period === "week" ? weekLabel(m.key) : monthLabel(m.ym)}</td>
                    <td className="py-2 pr-3 text-right tabular">{formatMoney(m.income)}</td>
                    <td className="py-2 pr-3 text-right tabular">{formatMoney(m.expenses)}</td>
                    <td className={`py-2 pr-3 text-right tabular ${m.net < 0 ? "text-danger" : "text-good"}`}>
                      {formatMoney(m.net, { signed: true })}
                    </td>
                    <td className="py-2 text-right tabular">{m.uncategorized || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export function MobileOverview() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const profile = useBudgetStore((s) => s.profile);
  const ym = useBudgetStore((s) => s.activeMonth);
  const wk = useBudgetStore((s) => s.activeWeek);
  const loadSample = useBudgetStore((s) => s.loadSample);
  const period = profile.budgetPeriod;
  const key = period === "week" ? wk : ym;
  const prevKey = period === "week" ? shiftWeek(wk, -1) : shiftMonth(ym, -1);
  const cash = periodCash(transactions, period, key, categories);
  const shares = categoryShares(transactions, categories, period, key).slice(0, 5);
  const insights = habitInsights(transactions, categories, period, key, prevKey).slice(0, 3);
  const max = Math.max(...shares.map((s) => s.actual), 1);
  const recent = transactions.filter((t) => inPeriod(t, period, key)).slice(0, 5);

  if (!transactions.length) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold">Start with a file</h1>
        <p className="text-sm text-muted">This phone view stays an overview. Import on this device, then swipe periods.</p>
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
      <MonthSwitcher compact />
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          Net this {periodNoun(period)}
        </div>
        <div className={`font-display text-4xl font-semibold tabular ${cash.net < 0 ? "text-danger" : "text-good"}`}>
          {formatMoney(cash.net, { signed: true })}
        </div>
        <div className="mt-2 flex gap-4 text-sm text-muted">
          <span>In {formatMoney(cash.income)}</span>
          <span>Out {formatMoney(cash.expenses)}</span>
        </div>
      </div>
      {cash.uncategorized > 0 ? (
        <Link to="/activity" className="block rounded-md bg-chip px-3 py-3 text-sm">
          {cash.uncategorized} need a category
        </Link>
      ) : null}
      {insights.map((ins) => (
        <p key={ins.id} className="rounded-md border border-border bg-surface px-3 py-3 text-sm">
          <span className="font-medium">{ins.title}. </span>
          {ins.body}
        </p>
      ))}
      <div>
        <h2 className="font-display text-lg font-semibold">Largest expense buckets</h2>
        <ul className="mt-3 space-y-3">
          {shares.map((s) => (
            <li key={s.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{s.name}</span>
                <span className="tabular">{formatMoney(s.actual)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-chip">
                <div className="h-full bg-primary" style={{ width: `${(s.actual / max) * 100}%` }} />
              </div>
            </li>
          ))}
          {shares.length === 0 ? <li className="text-sm text-muted">Import a file to see spend.</li> : null}
        </ul>
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold">Latest</h2>
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
          {recent.map((t) => (
            <li key={t.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
              <span className={`truncate ${t.excluded ? "text-muted line-through" : ""}`}>{t.description}</span>
              <span className="tabular">{formatMoney(t.amount, { signed: true })}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
