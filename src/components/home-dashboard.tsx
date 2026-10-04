import { Link } from "@tanstack/react-router";
import { CreditCard, Landmark, LineChart, PiggyBank, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { accountAcceptsFile, accountKindLabel } from "@/lib/budget/accounts";
import { fileInsights } from "@/lib/budget/analytics";
import { bucketBalance, safeToSpend } from "@/lib/budget/buckets";
import { accountRows, monthGlance, needsALook, spanOverview, spendingSlices, staleLabel } from "@/lib/budget/dashboard";
import { downloadText } from "@/lib/budget/download";
import { formatMoney } from "@/lib/budget/money";
import { monthShort } from "@/lib/budget/parse-date";
import { monthCash } from "@/lib/budget/totals";
import { buildYearWorkbook, yearSheetCsv } from "@/lib/budget/year";
import type { AccountKind } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { CategorizeCoach } from "./categorize-coach";
import { EmptyArt } from "./visuals/empty-art";
import { queueFundWizard } from "./fund-wizard";
import { HomeSwitch } from "./home-switch";
import { ReadoutCard } from "./readout-card";
import { CountUp } from "./visuals/count-up";
import { Delta } from "./visuals/delta";
import { Donut } from "./visuals/donut";
import { MiniBars } from "./visuals/mini-bars";
import { ProgressRing } from "./visuals/progress-ring";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/field";
import { YearSwitcher } from "./year-switcher";

const ICONS: Record<AccountKind, typeof Landmark> = {
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  investment: LineChart,
  retirement: Landmark,
  other: Wallet,
};

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function prettyDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function HomeDashboard() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const ym = useBudgetStore((s) => s.activeMonth);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const buckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const profile = useBudgetStore((s) => s.profile);
  const addBalance = useBudgetStore((s) => s.addBalance);
  const [coach, setCoach] = useState(false);
  const [why, setWhy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [balanceId, setBalanceId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso);
  const year = ym.slice(0, 4);
  const through = Number(ym.slice(5, 7)) || 1;
  const style = profile.budgetStyle === "buckets" ? "buckets" : "monthly";

  const now = useMemo(() => spanOverview(transactions, categories, year, through), [transactions, categories, year, through]);
  const prior = useMemo(() => spanOverview(transactions, categories, String(Number(year) - 1), through), [transactions, categories, year, through]);
  const bars = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const key = `${year}-${String(index + 1).padStart(2, "0")}`;
        const cash = monthCash(transactions, key, categories);
        return { label: monthShort(key), a: cash.income, b: cash.expenses };
      }),
    [transactions, categories, year],
  );
  const slices = useMemo(() => spendingSlices(transactions, categories, year), [transactions, categories, year]);
  const accountsView = useMemo(() => accountRows(accounts, balances, todayIso()), [accounts, balances]);
  const safe = safeToSpend({ ym, transactions, categories, budgets: monthBudgets, buckets, moves });
  const glance = monthGlance({
    style,
    ym,
    transactions,
    categories,
    budgets: monthBudgets,
    carryStartMonth: profile.carryStartMonth,
    safeToSpend: safe.amount,
  });
  const look = needsALook({ transactions, categories, profile, ym, budgets: monthBudgets });
  const insights = useMemo(() => fileInsights(transactions, categories), [transactions, categories]);
  const priorHas = prior.moneyIn !== 0 || prior.moneyOut !== 0;
  const ratePct = Math.round(now.savingsRate * 100);

  if (!transactions.length) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <HomeSwitch />
        <EmptyArt kind="home" />
        <h1 className="font-display text-3xl font-semibold">Nothing here yet</h1>
        <p className="text-sm text-muted">Add a bank file. Harbor reads a typical month, what repeats, and where the money went.</p>
        <Link to="/import">
          <Button>Add your first bank file</Button>
        </Link>
      </div>
    );
  }

  function downloadYear() {
    const book = buildYearWorkbook(transactions, categories, year);
    downloadText(`harbor-${year}-sheet.csv`, yearSheetCsv(book), "text/csv;charset=utf-8");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <HomeSwitch />
        <YearSwitcher />
      </div>

      <ReadoutCard transactions={transactions} categories={categories} />

      {insights && insights.items.length ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">What the charges already say</h2>
          <ul className="mt-3 space-y-2">
            {insights.items.slice(0, 5).map((item) => (
              <li key={item.id} className="text-sm">
                <span className="font-medium">{item.title}.</span> <span className="text-muted">{item.detail}</span>
              </li>
            ))}
          </ul>
          {insights.waiting.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">Still waiting on more history ({insights.waiting.length})</summary>
              <ul className="mt-2 space-y-1">
                {insights.waiting.map((item) => (
                  <li key={item.id} className="text-sm text-muted">
                    {item.title}. {item.detail}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="rise panel rounded-lg border border-border bg-surface p-4">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">So far in {year}</h1>
        <p className="mt-1 text-sm text-muted">January through {monthName(through)}. The year page has the full spreadsheet.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <NumberBlock label="Money in" value={now.moneyIn} delta={priorHas ? now.moneyIn - prior.moneyIn : null} goodWhen="up" />
          <NumberBlock label="Money out" value={now.moneyOut} delta={priorHas ? now.moneyOut - prior.moneyOut : null} goodWhen="down" />
          <NumberBlock label="Left" value={now.left} delta={priorHas ? now.left - prior.left : null} goodWhen="up" signed />
        </div>
        {priorHas ? <p className="mt-2 text-xs text-muted">The change is the same months in {Number(year) - 1}.</p> : null}
        <div className="mt-4">
          <ProgressRing
            pct={Math.max(0, Math.min(100, ratePct))}
            tone={ratePct < 0 ? "danger" : "good"}
            label={now.moneyIn > 0 ? `Savings rate ${ratePct}%` : "No income yet, so no savings rate"}
          />
        </div>
      </section>

      <section className="rise panel rounded-lg border border-border bg-surface p-4" style={{ animationDelay: "40ms" }}>
        <h2 className="font-display text-xl font-semibold">Money in and money out</h2>
        <p className="mt-1 text-sm text-muted">Each month of {year}. A quiet month is a short pair of bars.</p>
        <div className="mt-3">
          <MiniBars months={bars} aLabel="Money in" bLabel="Money out" />
        </div>
      </section>

      <section className="rise panel rounded-lg border border-border bg-surface p-4" style={{ animationDelay: "80ms" }}>
        <h2 className="font-display text-xl font-semibold">Your accounts</h2>
        {accountsView.rows.length === 0 ? (
          <div className="mt-3">
            <p className="text-sm">No accounts yet. Add one, then its balance can show here.</p>
            <Link to="/settings" className="mt-3 inline-flex">
              <Button>Add an account</Button>
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {accountsView.rows.map((row) => {
              const Icon = ICONS[row.kind];
              const account = accounts.find((item) => item.id === row.id);
              const showOwed = row.owed;
              return (
                <li key={row.id} className="rounded-md border border-border px-3 py-3">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">
                          {row.name} <span className="text-sm font-normal text-muted">· {accountKindLabel(row.kind)}</span>
                        </p>
                        <p className={`tabular ${showOwed && row.amount < 0 ? "text-danger" : ""}`}>
                          {showOwed ? `Owe ${formatMoney(Math.abs(row.amount))}` : formatMoney(row.amount)}
                        </p>
                      </div>
                      <p className="text-sm text-muted">
                        {row.asOf ? `As of ${prettyDate(row.asOf)}` : "No balance yet"}
                        {row.source ? ` · ${row.source}` : ""}
                      </p>
                      {row.stale && row.ageDays != null ? <p className="text-sm text-warn">{staleLabel(row.ageDays)}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {account && accountAcceptsFile(account.kind) ? (
                          <Link to="/import" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
                            Add a file
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          className="min-h-11 text-sm font-medium text-primary"
                          onClick={() => {
                            setBalanceId(balanceId === row.id ? null : row.id);
                            setAmount("");
                            setDate(todayIso());
                          }}
                        >
                          Update balance
                        </button>
                      </div>
                      {balanceId === row.id ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <Field label={row.owed ? "What you owe" : "Balance"}>
                            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                          </Field>
                          <Field label="Date">
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                          </Field>
                          <Button
                            className="sm:col-span-2 sm:w-fit"
                            onClick={() => {
                              const next = Number(amount);
                              if (!Number.isFinite(next) || amount.trim() === "") return;
                              addBalance(row.id, next, date);
                              setBalanceId(null);
                              setAmount("");
                            }}
                          >
                            Save balance
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {accountsView.rows.length ? (
          <>
            <p className="mt-3 font-medium">Net {formatMoney(accountsView.net, { signed: true })}</p>
            <p className="text-xs text-muted">Every account is in this total. A card you owe lowers it.</p>
            <Link to="/settings" className="mt-3 flex min-h-11 items-center rounded-md border border-dashed border-line px-3 text-sm">
              Add an account
            </Link>
          </>
        ) : null}
      </section>

      <section className="rise panel rounded-lg border border-border bg-surface p-4" style={{ animationDelay: "120ms" }}>
        <h2 className="font-display text-xl font-semibold">Where it went</h2>
        <p className="mt-1 text-sm text-muted">Spending in {year}, by category. Tap a slice to see the amount.</p>
        <div className="mt-3">
          <Donut
            parts={slices.map((slice) => ({ id: slice.id, label: slice.label, value: slice.value }))}
            centerLabel={year}
            onPick={(part) => setPicked(`${part.label}: ${formatMoney(part.value)}`)}
          />
        </div>
        {picked ? <p className="mt-2 text-sm">{picked}</p> : null}
      </section>

      <section className="rise panel rounded-lg border border-border bg-surface p-4" style={{ animationDelay: "160ms" }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">This month at a glance</h2>
          <button type="button" className="min-h-11 min-w-11 rounded-full border border-border text-sm" aria-label="What does safe to spend mean?" onClick={() => setWhy((v) => !v)}>
            ?
          </button>
        </div>
        <p className="mt-2 font-display text-3xl tabular">Safe to spend: {formatMoney(glance.safeToSpend, { signed: true })}</p>
        <p className="mt-1 text-sm">{glance.sentence}</p>
        {why ? (
          <p className="mt-2 text-sm text-muted">Income so far, minus this month’s amounts, minus what goes into funds, minus spending that is not already counted.</p>
        ) : null}
        <Link to="/month" className="mt-3 inline-flex">
          <Button>Open this month</Button>
        </Link>
      </section>

      {coach ? (
        <CategorizeCoach onClose={() => setCoach(false)} />
      ) : look.uncategorized > 0 || look.incomeLine ? (
        <section className="rounded-lg border border-primary/40 bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Needs a look</h2>
          {look.uncategorized > 0 ? (
            <p className="mt-1 text-sm">{look.uncategorized} charge{look.uncategorized === 1 ? "" : "s"} in {year} have no category.</p>
          ) : null}
          {look.incomeLine ? <p className="mt-1 text-sm">{look.incomeLine}</p> : null}
          {look.uncategorized > 0 ? (
            <Button className="mt-3" onClick={() => setCoach(true)}>
              Put them in categories
            </Button>
          ) : null}
        </section>
      ) : null}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Funds</h2>
          <Link to="/funds" className="text-sm font-medium text-primary">
            See all
          </Link>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {buckets.map((fund) => (
            <Link key={fund.id} to="/funds" className="min-w-36 rounded-lg border border-border bg-surface p-3">
              <div className="text-sm text-muted">{fund.name}</div>
              <div className="font-display text-xl tabular">{formatMoney(bucketBalance(fund, ym, transactions, categories, moves))}</div>
            </Link>
          ))}
          <Link to="/funds" className="flex min-w-36 items-center rounded-lg border border-dashed border-line p-3 text-sm" onClick={() => queueFundWizard()}>
            Add a fund
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="font-medium">Look back</div>
        <p className="text-sm text-muted">The calendar year, one month at a time. Charts and a spreadsheet are there too.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/year" className="text-sm font-medium text-primary">
            Open the year
          </Link>
          <button type="button" className="text-sm font-medium text-primary" onClick={downloadYear}>
            Download the year spreadsheet
          </button>
        </div>
      </section>
    </div>
  );
}

function NumberBlock({
  label,
  value,
  delta,
  goodWhen,
  signed = false,
}: {
  label: string;
  value: number;
  delta: number | null;
  goodWhen: "up" | "down";
  signed?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-2xl">
        <CountUp value={value} format={(n) => formatMoney(n, { signed })} />
      </div>
      {delta != null ? <Delta amount={delta} goodWhen={goodWhen} format={(n) => formatMoney(n)} /> : null}
    </div>
  );
}

function monthName(month: number) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1] ?? "";
}
