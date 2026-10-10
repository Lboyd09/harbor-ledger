import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { recurringBills, savingsRateSeries } from "@/lib/budget/analytics-depth";
import { safeToSpend } from "@/lib/budget/buckets";
import { daysLeftInMonth, weeklySafe } from "@/lib/budget/dashboard";
import { monthLedger, safeBreakdown } from "@/lib/budget/ledger-month";
import { formatDay } from "@/lib/budget/parse-date";
import { formatMoney } from "@/lib/budget/money";
import { moneyPicture } from "@/lib/budget/picture";
import { investingReadiness } from "@/lib/budget/phase4";
import { planTotal } from "@/lib/budget/plans";
import { plannerFacts } from "@/lib/budget/planner";
import { isDemoLedger } from "@/lib/budget/onboarding-plan";
import { coverSentence, queueStats, reviewQueue } from "@/lib/budget/review-queue";
import { comingUp } from "@/lib/budget/screen-plan";
import { checklistOpen, startedChecklist } from "@/lib/budget/checklist";
import { shouldRemindBackup } from "@/lib/budget/backup-reminder";
import { importIsStale, importStreak, monthRecap } from "@/lib/budget/recap";
import { useBudgetStore } from "@/store/budget-store";
import { CategorizeCoach } from "./categorize-coach";
import { Button } from "./ui/button";
import { InfoTip } from "./info-tip";
import { EmptyArt } from "./visuals/empty-art";

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function Spark({ points }: { points: number[] }) {
  const recent = points.slice(-6);
  if (recent.length < 2) return null;
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const width = 72;
  const height = 22;
  const d = recent
    .map((point, index) => {
      const x = (index / (recent.length - 1)) * width;
      const y = max === min ? height / 2 : height - ((point - min) / (max - min)) * (height - 2) - 1;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="text-primary">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function shortDate(iso: string) {
  return formatDay(iso);
}

export function HomeDashboard() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets);
  const buckets = useBudgetStore((s) => s.moneyBuckets);
  const moves = useBudgetStore((s) => s.bucketMoves);
  const profile = useBudgetStore((s) => s.profile);
  const setAsides = useBudgetStore((s) => s.setAsides);
  const debts = useBudgetStore((s) => s.debts);
  const netWorth = useBudgetStore((s) => s.netWorth);
  const imports = useBudgetStore((s) => s.imports);
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const reopenSetup = useBudgetStore((s) => s.reopenSetup);
  const [coach, setCoach] = useState(false);
  const [why, setWhy] = useState(false);
  const style = profile.budgetStyle === "buckets" ? "buckets" : "monthly";
  const today = todayIso();

  const facts = useMemo(
    () => plannerFacts({ profile, accounts, balances, transactions, categories, year: Number(ym.slice(0, 4)) }),
    [profile, accounts, balances, transactions, categories, ym],
  );
  const planned = planTotal(categories, ym, monthBudgets ?? []);
  const series = savingsRateSeries(transactions, categories);
  const picture = moneyPicture({
    accounts,
    balances,
    debts: debts ?? [],
    funds: buckets ?? [],
    transactions,
    categories,
    moves: moves ?? [],
    ym,
    bills: planned > 0 ? planned : (facts.typicalFixed.value ?? facts.typicalSpendMonthly.value),
  });
  const highDebt = (debts ?? []).filter((debt) => debt.balance > 0 && debt.apr > 8).sort((a, b) => b.apr - a.apr)[0];
  const ready = investingReadiness({
    monthsSaved: picture.cushionMonths ?? 0,
    highAprDebt: highDebt ? { name: highDebt.name, apr: highDebt.apr } : null,
  });
  const safe = safeToSpend({
    ym,
    transactions,
    categories,
    budgets: monthBudgets ?? [],
    buckets: buckets ?? [],
    moves: moves ?? [],
    setAsides: setAsides ?? [],
    style,
    carryStartMonth: profile.carryStartMonth,
    profile,
  });
  const ledger = useMemo(
    () =>
      monthLedger(
        {
          transactions,
          categories,
          budgets: monthBudgets ?? [],
          buckets: buckets ?? [],
          moves: moves ?? [],
          setAsides: setAsides ?? [],
          style,
          carryStartMonth: profile.carryStartMonth,
          profile,
        },
        ym,
      ),
    [transactions, categories, monthBudgets, buckets, moves, setAsides, style, profile, ym],
  );
  const queue = useMemo(() => {
    return reviewQueue(transactions, categories).filter((group) =>
      group.ids.some((id) => transactions.some((row) => row.id === id && !row.categoryId)),
    );
  }, [transactions, categories]);
  const stats = queueStats(queue);
  const soon = (comingUp(recurringBills(transactions, categories, today), today, 30) ?? []).filter(
    (item) => item.status === "active" && item.nextDate >= today,
  );
  const over = ledger.spending.filter((line) => line.left < -0.5).slice(0, 3);
  const weekly = weeklySafe(safe.amount, daysLeftInMonth(today));
  const breakdown = safeBreakdown(
    {
      transactions,
      categories,
      budgets: monthBudgets ?? [],
      buckets: buckets ?? [],
      moves: moves ?? [],
      setAsides: setAsides ?? [],
      style,
      carryStartMonth: profile.carryStartMonth,
      profile,
    },
    ym,
  );
  const sample = isDemoLedger({ profile, debts, netWorth, imports, moneyBuckets: buckets ?? [] });

  if (!transactions.length && (profile.monthlyIncome ?? 0) <= 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Today</h1>
        <EmptyArt kind="home" />
        <h2 className="font-display text-3xl font-semibold">Nothing here yet</h2>
        <p className="text-sm text-muted">Add a bank file to see your money.</p>
        <Link to="/import">
          <Button>Add a bank file</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-display text-2xl font-semibold md:text-3xl">Today</h1>
      <section className="grid grid-cols-2 gap-2 text-sm min-[420px]:grid-cols-3" aria-label="Your numbers">
        <a href="/grow?q=cushion" data-tile className="min-w-0 rounded-lg border border-border bg-surface p-3">
          <p className="flex items-center text-sm text-muted">Cushion <InfoTip label="What is cushion?" text="Months of spending in cash." href="/help#cushion" /></p>
          <p className="money font-display tabular" data-money>{picture.cushionMonths == null ? "—" : `${picture.cushionMonths} mo`}</p>
          <p className="text-xs text-muted">goal 3–6 mo</p>
        </a>
        <Link to="/grow" data-tile className="min-w-0 rounded-lg border border-border bg-surface p-3">
          <p className="text-sm text-muted">Saving</p>
          <p className="money font-display tabular" data-money>{facts.savingsRate == null ? "—" : `${Math.round(facts.savingsRate * 100)}% of income`}</p>
          <p className="text-xs text-muted">goal 15–20%</p>
          {series ? <Spark points={series.map((point) => point.rate)} /> : null}
        </Link>
        <Link to="/funds" data-tile className="min-w-0 rounded-lg border border-border bg-surface p-3 max-[419px]:col-span-2">
          <p className="text-sm text-muted">Net worth</p>
          <p className="money break-words font-display tabular" data-money>{formatMoney(picture.net, { signed: true })}</p>
        </Link>
      </section>
      {ready.step === "ready" ? null : <p className="text-sm">{ready.sentence}</p>}
      {(() => {
        const items = startedChecklist({
          hasImport: (imports ?? []).length > 0,
          unsorted: stats.charges,
          hasPlan: categories.some((category) => category.kind === "expense" && category.plannedMonthly > 0),
          hasBalance: (balances ?? []).length > 0,
          hasGoal: (buckets ?? []).some((fund) => Boolean(fund.target)),
        });
        if (!checklistOpen(items, false)) return null;
        return (
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="font-display text-lg font-semibold">Get started</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {items.map((item) => (
                <li key={item.id}>{item.done ? "✓" : "○"} {item.label}</li>
              ))}
            </ul>
          </section>
        );
      })()}
      {shouldRemindBackup({
        signedIn: false,
        hasImport: (imports ?? []).length > 0,
        lastDismiss: typeof localStorage === "undefined" ? null : localStorage.getItem("harbor-backup-remind"),
        today,
      }) ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm">Your budget lives only in this browser.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to="/settings"><Button size="sm">Download backup</Button></Link>
            <Link to="/login"><Button size="sm" variant="outline">Create free account</Button></Link>
            <Button size="sm" variant="ghost" onClick={() => localStorage.setItem("harbor-backup-remind", today)}>
              Not now
            </Button>
          </div>
        </section>
      ) : null}
      {importIsStale(imports?.[0]?.importedAt ?? null, today) ? (
        <p className="text-sm">Time to add this month's bank file.</p>
      ) : null}
      {importStreak((imports ?? []).map((row) => row.importedAt), ym) > 1 ? (
        <p className="text-sm">{importStreak((imports ?? []).map((row) => row.importedAt), ym)} months in a row</p>
      ) : null}
      <p className="sr-only">{monthRecap({ onPlan: ledger.spending.filter((line) => line.left >= -0.5).length, categories: ledger.spending.length, savingsRate: facts.savingsRate, biggest: null })}</p>
      {sample ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm">Sample budget. Start yours anytime.</p>
          <Button className="mt-3" onClick={() => reopenSetup()}>
            Start my budget
          </Button>
        </section>
      ) : null}

      <section className={`rounded-lg border p-4 ${safe.amount < 0 ? "border-danger/40 bg-danger/10" : "border-border bg-surface"}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center text-sm text-muted">Safe to spend <InfoTip label="What is safe to spend?" text="Income so far − planned bills − overspending." href="/help#safe-to-spend" /></p>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-sm"
            aria-label="What does safe to spend mean?"
            onClick={() => setWhy((open) => !open)}
          >
            ?
          </button>
        </div>
        <p className={`money-hero font-display font-semibold tabular ${safe.amount < 0 ? "text-danger" : ""}`} data-money>{formatMoney(safe.amount)}</p>
        {weekly != null && safe.amount > 0 ? <p className="mt-1 text-sm">≈ {formatMoney(weekly)} a week</p> : null}
        {why ? (
          <p className="mt-2 text-sm text-muted">
            Left now {formatMoney(breakdown.left, { signed: true })} · Still planned {formatMoney(-breakdown.stillPlanned, { signed: true })} · Safe to spend {formatMoney(breakdown.safe, { signed: true })}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Needs you</h2>
        {queue.length || over.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {queue.length ? <li>{coverSentence(stats)}</li> : null}
            {over.map((line) => (
              <li key={line.id}>{line.name}: {formatMoney(Math.abs(line.left))} over</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nothing needs you right now.</p>
        )}
        {queue.length ? (
          <Button className="mt-3" onClick={() => setCoach(true)}>
            Sort them
          </Button>
        ) : (
          <Link to="/budget" className="mt-3 inline-flex">
            <Button variant="outline">Open the budget</Button>
          </Link>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Bills coming up</h2>
        {soon.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {soon.slice(0, 5).map((item) => (
              <li key={item.merchantKey} className="flex items-baseline justify-between gap-3">
                <span>{item.description}</span>
                <span className="shrink-0 tabular text-muted">
                  {formatMoney(item.usual)} · {shortDate(item.nextDate)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No bills due soon.</p>
        )}
      </section>

      {coach ? <CategorizeCoach onClose={() => setCoach(false)} /> : null}
    </div>
  );
}
