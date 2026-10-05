import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { fileInsights, monthEndForecast } from "@/lib/budget/analytics";
import {
  categoryTrends,
  dataDepth,
  incomeStability,
  payCycle,
  recurringBills,
  runway,
  savingsRateSeries,
  typicalMonth,
  unusualCharges,
} from "@/lib/budget/analytics-depth";
import { fileReadout } from "@/lib/budget/readout";
import { coverSentence, queueStats, reviewQueue } from "@/lib/budget/review-queue";
import { comingUp } from "@/lib/budget/screen-plan";
import { bucketBalance, safeToSpend } from "@/lib/budget/buckets";
import { monthGlance, needsALook, spendingSlices, yearOverview } from "@/lib/budget/dashboard";
import { yearLedger } from "@/lib/budget/ledger-month";
import { downloadText } from "@/lib/budget/download";
import { formatMoney } from "@/lib/budget/money";
import { monthShort } from "@/lib/budget/parse-date";
import { buildYearWorkbook, yearSheetCsv } from "@/lib/budget/year";
import type { Account, BalancePoint, Category, Transaction } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { AccountBoard, openQuickAdd } from "./account-board";
import { openCategoryPanel } from "./category-panel";
import { CategorizeCoach } from "./categorize-coach";
import { EmptyArt } from "./visuals/empty-art";
import { queueFundWizard } from "./fund-wizard";
import { HomeMenu } from "./page-menu";
import { CountUp } from "./visuals/count-up";
import { Delta } from "./visuals/delta";
import { Donut } from "./visuals/donut";
import { MiniBars } from "./visuals/mini-bars";
import { ProgressRing } from "./visuals/progress-ring";
import { Button } from "./ui/button";
import { YearSwitcher } from "./year-switcher";

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function SavedByFund({ funds }: { funds: { id: string; name: string; funding: number; setAsides: number }[] }) {
  const rows = funds.filter((fund) => fund.funding > 0.004 || fund.setAsides > 0.004);
  if (!rows.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {rows.map((fund) => (
        <li key={fund.id}>
          {fund.name}: {formatMoney(fund.funding)} put in, {formatMoney(fund.setAsides)} set aside
        </li>
      ))}
    </ul>
  );
}

export function HomeDashboard() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const ym = useBudgetStore((s) => s.activeMonth);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets);
  const buckets = useBudgetStore((s) => s.moneyBuckets);
  const moves = useBudgetStore((s) => s.bucketMoves);
  const profile = useBudgetStore((s) => s.profile);
  const setAsides = useBudgetStore((s) => s.setAsides);
  const [coach, setCoach] = useState(false);
  const [why, setWhy] = useState(false);
  const year = ym.slice(0, 4);
  const style = profile.budgetStyle === "buckets" ? "buckets" : "monthly";

  const yearBook = useMemo(
    () =>
      yearLedger(
        { transactions, categories, budgets: monthBudgets ?? [], buckets: buckets ?? [], moves: moves ?? [], setAsides: setAsides ?? [], style, carryStartMonth: profile.carryStartMonth },
        year,
      ),
    [transactions, categories, monthBudgets, buckets, moves, setAsides, style, profile.carryStartMonth, year],
  );
  const now = yearOverview(transactions, categories, year, { buckets: buckets ?? [], moves: moves ?? [], setAsides: setAsides ?? [], style, carryStartMonth: profile.carryStartMonth });
  const prior = yearOverview(transactions, categories, String(Number(year) - 1), { buckets: buckets ?? [], moves: moves ?? [], setAsides: setAsides ?? [], style, carryStartMonth: profile.carryStartMonth });
  const bars = useMemo(
    () => yearBook.months.map((month) => ({ label: monthShort(month.ym), a: month.totals.received, b: month.totals.spent })),
    [yearBook],
  );
  const slices = useMemo(() => spendingSlices(transactions, categories, year), [transactions, categories, year]);
  const safe = safeToSpend({ ym, transactions, categories, budgets: monthBudgets ?? [], buckets: buckets ?? [], moves: moves ?? [], setAsides: setAsides ?? [] });
  const glance = monthGlance({
    style,
    ym,
    transactions,
    categories,
    budgets: monthBudgets ?? [],
    carryStartMonth: profile.carryStartMonth,
    safeToSpend: safe.amount,
    setAsides: setAsides ?? [],
  });
  const look = needsALook({ transactions, categories, profile, ym, budgets: monthBudgets ?? [] });
  const insights = useMemo(() => fileInsights(transactions, categories, todayIso()), [transactions, categories]);
  const read = useMemo(() => fileReadout(transactions, categories), [transactions, categories]);
  const typical = useMemo(() => typicalMonth(transactions, categories), [transactions, categories]);
  const queue = useMemo(() => {
    return reviewQueue(transactions, categories).filter((group) =>
      group.ids.some((id) => transactions.some((row) => row.id === id && !row.categoryId)),
    );
  }, [transactions, categories]);
  const stats = queueStats(queue);
  const forecast = monthEndForecast({ transactions, categories, ym, today: todayIso(), budgets: monthBudgets ?? [] });
  const soon = comingUp(recurringBills(transactions, categories, todayIso()), todayIso(), 30);
  const cushion = runway(accounts, balances, transactions, categories);
  const nerd = profile.detail === "nerd";
  const priorHas = prior.moneyIn !== 0 || prior.moneyOut !== 0;
  const ratePct = Math.round(now.savingsRate * 100);

  if (!transactions.length) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <HomeMenu current="overview" onAccounts={() => openQuickAdd("choose")} />
        <AccountBoard />
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
        <HomeMenu current="overview" onAccounts={() => openQuickAdd("choose")} />
        <YearSwitcher />
      </div>

      {(dataDepth(transactions)?.months ?? 0) >= 3 && cushion ? (
        <p className="text-sm">{cushion.sentence} Based on checking and savings balances over a typical month of spending.</p>
      ) : null}
      <AccountBoard />

      <section className="rounded-lg border border-border bg-surface p-4">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">
          {forecast?.sentence ?? typical?.sentence ?? read.headline ?? "Not enough history yet."}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {forecast ? (typical?.sentence ?? "Based on this month so far.") : "Add another month before a month-end guess."}
        </p>
        {queue.length ? null : (
          <div className="mt-3">
            <Link to="/budget"><Button variant="outline">Open this month</Button></Link>
          </div>
        )}
      </section>

      {queue.length ? (
        <section className="rounded-lg border border-primary/40 bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Needs you</h2>
          <p className="mt-1 text-sm">{coverSentence(stats)}</p>
          <Button className="mt-3" onClick={() => setCoach(true)}>Sort them</Button>
        </section>
      ) : null}

      {coach ? <CategorizeCoach onClose={() => setCoach(false)} /> : null}

      {!nerd ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">{year} in, out, and saved</h2>
          <p className="mt-1 text-sm text-muted">
            Each month of {year}. {formatMoney(now.moneyIn)} in, {formatMoney(now.moneyOut)} out, {formatMoney(now.saved)} saved to funds.
          </p>
          <div className="mt-3">
            <MiniBars months={bars} aLabel="Money in" bLabel="Money out" />
          </div>
          <SavedByFund funds={yearBook.funds} />
        </section>
      ) : null}

      <Fold simple={!nerd}>
      <section className="rise panel rounded-lg border border-border bg-surface p-4">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">{year}</h1>
        <p className="mt-1 text-sm text-muted">The twelve months added together. Year review has the spreadsheet.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <NumberBlock label="In" value={now.moneyIn} delta={priorHas ? now.moneyIn - prior.moneyIn : null} goodWhen="up" />
          <NumberBlock label="Out" value={now.moneyOut} delta={priorHas ? now.moneyOut - prior.moneyOut : null} goodWhen="down" />
          <NumberBlock label="Saved" value={now.saved} delta={priorHas ? now.saved - prior.saved : null} goodWhen="up" />
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

      {nerd ? (
      <section className="rise panel rounded-lg border border-border bg-surface p-4" style={{ animationDelay: "40ms" }}>
        <h2 className="font-display text-xl font-semibold">Money in and money out</h2>
        <p className="mt-1 text-sm text-muted">
          The same twelve months. {formatMoney(yearBook.totals.savedToFunds)} saved to funds.
        </p>
        <div className="mt-3">
          <MiniBars months={bars} aLabel="Money in" bLabel="Money out" />
        </div>
        <SavedByFund funds={yearBook.funds} />
      </section>
      ) : null}

      {insights && insights.items.length ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">What the charges say</h2>
          <ul className="mt-3 space-y-3">
            {insights.items.slice(0, 3).map((item) => (
              <li key={item.id}>
                <p className="text-sm"><span className="font-medium">{item.title}.</span> {item.detail}</p>
                {item.basis ? <p className="text-xs text-muted">{item.basis}</p> : null}
                {item.chart?.length ? (
                  <div className="mt-2">
                    <MiniBars months={item.chart.map((point) => ({ label: point.label, a: point.value, b: 0 }))} aLabel={item.title} bLabel="Hidden" />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {insights.items.length > 3 ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">More</summary>
              <ul className="mt-2 space-y-2">
                {insights.items.slice(3).map((item) => (
                  <li key={item.id} className="text-sm"><span className="font-medium">{item.title}.</span> {item.detail}{item.basis ? ` ${item.basis}` : ""}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {insights.waiting.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">Still waiting on more history ({insights.waiting.length})</summary>
              <ul className="mt-2 space-y-1">
                {insights.waiting.map((item) => (
                  <li key={item.id} className="text-sm text-muted">{item.title}. {item.detail}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {soon ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl font-semibold">Coming up</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {soon.slice(0, 5).map((item) => (
              <li key={item.merchantKey}>{item.description} · {formatMoney(item.usual)} · {item.nextDate}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rise panel rounded-lg border border-border bg-surface p-4" style={{ animationDelay: "120ms" }}>
        <h2 className="font-display text-xl font-semibold">Where it went</h2>
        <p className="mt-1 text-sm text-muted">Spending in {year}, by category. Tap a slice to open it.</p>
        <div className="mt-3">
          <Donut
            parts={slices.map((slice) => ({ id: slice.id, label: slice.label, value: slice.value }))}
            centerLabel={year}
            onPick={(part) => {
              if (part.id) openCategoryPanel(part.id, `${year}-12`);
            }}
          />
        </div>
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
        <Link to="/budget" className="mt-3 inline-flex">
          <Button>Open this month</Button>
        </Link>
      </section>

      {nerd ? <AllNumbers transactions={transactions} categories={categories} accounts={accounts} balances={balances} today={todayIso()} ym={ym} /> : null}

      {look.incomeLine ? <p className="text-sm text-muted">{look.incomeLine}</p> : null}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Funds</h2>
          <Link to="/funds" className="text-sm font-medium text-primary">
            See all
          </Link>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {(buckets ?? []).map((fund) => (
            <Link key={fund.id} to="/funds" className="min-w-36 rounded-lg border border-border bg-surface p-3">
              <div className="text-sm text-muted">{fund.name}</div>
              <div className="font-display text-xl tabular">{formatMoney(bucketBalance(fund, ym, transactions, categories, moves ?? []))}</div>
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
      </Fold>
    </div>
  );
}

function Fold({ simple, children }: { simple: boolean; children: ReactNode }) {
  if (!simple) return <>{children}</>;
  return (
    <details className="rounded-lg border border-border bg-surface">
      <summary className="min-h-11 cursor-pointer px-4 py-3 font-medium">More</summary>
      <div className="space-y-6 px-4 pb-4">{children}</div>
    </details>
  );
}

function AllNumbers({
  transactions,
  categories,
  accounts,
  balances,
  today,
  ym,
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  balances: BalancePoint[];
  today: string;
  ym: string;
}) {
  const depth = dataDepth(transactions);
  const typical = typicalMonth(transactions, categories);
  const steady = incomeStability(transactions, categories);
  const bills = recurringBills(transactions, categories, today);
  const trends = categoryTrends(transactions, categories, ym);
  const cushion = runway(accounts, balances, transactions, categories);
  const rates = savingsRateSeries(transactions, categories);
  const cycle = payCycle(transactions);
  const odd = unusualCharges(transactions, ym);
  const groups: { title: string; rows: { name: string; value: string; meaning: string; how: string }[] }[] = [
    {
      title: "Income",
      rows: [
        typical
          ? { name: "Typical money in", value: formatMoney(typical.moneyIn), meaning: typical.sentence, how: `Median of ${typical.months} months.` }
          : null,
        steady
          ? { name: "How steady pay is", value: steady.label, meaning: steady.sentence, how: "Highest month minus lowest, over the middle month." }
          : null,
      ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
    },
    {
      title: "Spending",
      rows: [
        typical
          ? { name: "Typical money out", value: formatMoney(typical.moneyOut), meaning: `${formatMoney(typical.left)} left in a typical month.`, how: `Median of ${typical.months} months.` }
          : null,
        ...(trends ?? []).slice(0, 4).map((trend) => ({
          name: trend.name,
          value: `${trend.direction} ${Math.abs(trend.percent)}%`,
          meaning: `${formatMoney(trend.recent)} lately, against ${formatMoney(trend.prior)} earlier.`,
          how: "Last 3 months against the earlier average.",
        })),
      ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
    },
    {
      title: "Bills",
      rows: (bills ?? []).slice(0, 6).map((bill) => ({
        name: bill.description,
        value: formatMoney(bill.usual),
        meaning: `${bill.kind === "fixed" ? "Fixed" : "Variable"}${bill.nextDate ? `, next ${bill.nextDate}` : ""}. ${bill.status === "active" ? "On schedule." : bill.status === "late" ? "This looks late." : "This one stopped."}`,
        how: "Same name, similar amount, regular gap.",
      })),
    },
    {
      title: "Savings and cushion",
      rows: [
        cushion
          ? { name: "Cushion", value: `${cushion.months.toFixed(1)} months`, meaning: cushion.sentence, how: "Checking and savings over a typical month. Cards and retirement are left out." }
          : null,
        rates
          ? {
              name: "What was left last month",
              value: formatMoney(rates[rates.length - 1].saved),
              meaning: `${Math.round(rates[rates.length - 1].rate * 100)} percent of income in ${rates[rates.length - 1].ym}.`,
              how: "Income minus spending, each month.",
            }
          : null,
      ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
    },
    {
      title: "Patterns",
      rows: [
        cycle
          ? { name: "After payday", value: `${Math.round(cycle.firstWeekShare * 100)}% in the first week`, meaning: cycle.sentence, how: "Spending by day since the last paycheck." }
          : null,
        odd?.[0]
          ? { name: "Unusual charge", value: formatMoney(odd[0].amount), meaning: odd[0].sentence, how: "Above 3 times the usual amount, a first large charge, or a near duplicate." }
          : null,
      ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
    },
    {
      title: "Data quality",
      rows: [
        depth
          ? { name: "History", value: `${depth.months} months`, meaning: depth.sentence, how: "Count of charges and distinct months." }
          : null,
      ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
    },
  ];
  const visible = groups.filter((group) => group.rows.length);
  if (!visible.length) return null;
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">All the numbers</h2>
      <p className="mt-1 text-sm text-muted">Every reading the file can support. Simple mode leaves this section out.</p>
      <div className="mt-4 space-y-5">
        {visible.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-medium">{group.title}</h3>
            <ul className="mt-2 space-y-3">
              {group.rows.map((row) => (
                <li key={`${group.title}-${row.name}`}>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-sm tabular">{row.value}</p>
                  <p className="text-sm text-muted">{row.meaning}</p>
                  <p className="text-xs text-muted">How: {row.how}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
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
