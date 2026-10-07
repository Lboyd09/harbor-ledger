import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { recurringBills } from "@/lib/budget/analytics-depth";
import { safeToSpend } from "@/lib/budget/buckets";
import { monthLedger } from "@/lib/budget/ledger-month";
import { formatMoney } from "@/lib/budget/money";
import { isDemoLedger } from "@/lib/budget/onboarding-plan";
import { coverSentence, queueStats, reviewQueue } from "@/lib/budget/review-queue";
import { comingUp } from "@/lib/budget/screen-plan";
import { useBudgetStore } from "@/store/budget-store";
import { CategorizeCoach } from "./categorize-coach";
import { Button } from "./ui/button";
import { EmptyArt } from "./visuals/empty-art";

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function shortDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const reopenSetup = useBudgetStore((s) => s.reopenSetup);
  const [coach, setCoach] = useState(false);
  const [why, setWhy] = useState(false);
  const style = profile.budgetStyle === "buckets" ? "buckets" : "monthly";
  const today = todayIso();

  const safe = safeToSpend({
    ym,
    transactions,
    categories,
    budgets: monthBudgets ?? [],
    buckets: buckets ?? [],
    moves: moves ?? [],
    setAsides: setAsides ?? [],
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
  const weekly = safe.amount / 4;
  const sample = isDemoLedger({ profile, debts, netWorth, imports, moneyBuckets: buckets ?? [] });

  if (!transactions.length && (profile.monthlyIncome ?? 0) <= 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Today</h1>
        <EmptyArt kind="home" />
        <h2 className="font-display text-3xl font-semibold">Nothing here yet</h2>
        <p className="text-sm text-muted">Add a bank file, or open Budget to set amounts from setup.</p>
        <Link to="/import">
          <Button>Add a bank file</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-display text-2xl font-semibold md:text-3xl">Today</h1>
      {sample ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm">This is the sample budget. Starting your own replaces it.</p>
          <Button className="mt-3" onClick={() => reopenSetup()}>
            Start my budget
          </Button>
        </section>
      ) : null}

      <section className={`rounded-lg border p-4 ${safe.amount < 0 ? "border-danger/40 bg-danger/10" : "border-border bg-surface"}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted">Safe to spend</p>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-sm"
            aria-label="What does safe to spend mean?"
            onClick={() => setWhy((open) => !open)}
          >
            ?
          </button>
        </div>
        <p className={`font-display text-4xl font-semibold tabular ${safe.amount < 0 ? "text-danger" : ""}`}>{formatMoney(safe.amount)}</p>
        <p className="mt-1 text-sm">About {formatMoney(weekly)} this week, through Friday.</p>
        {why ? <p className="mt-2 text-sm text-muted">Income so far, minus this month’s plan, minus money already spent.</p> : null}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Needs you</h2>
        {queue.length || over.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {queue.length ? <li>{coverSentence(stats)}</li> : null}
            {over.map((line) => (
              <li key={line.id}>You're over on {line.name} by {formatMoney(Math.abs(line.left))}.</li>
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
          <p className="mt-2 text-sm text-muted">No bills due in the next few weeks.</p>
        )}
      </section>

      {coach ? <CategorizeCoach onClose={() => setCoach(false)} /> : null}
    </div>
  );
}
