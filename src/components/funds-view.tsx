import { useEffect, useState } from "react";
import { bucketBalance, categorySpend, DEFAULT_FUND_VIEW, fundWindow, fullLineOf, fundingForMonth, goalPace, monthName, monthsInclusive } from "@/lib/budget/buckets";
import { readNumber } from "@/lib/budget/calc-input";
import { monthLedger } from "@/lib/budget/ledger-month";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney } from "@/lib/budget/money";
import { investingReadiness, scheduleGap } from "@/lib/budget/phase4";
import { planTotal } from "@/lib/budget/plans";
import { moneyPicture } from "@/lib/budget/picture";
import { plannerFacts } from "@/lib/budget/planner";
import { monthKeyFromDate, monthLabel, monthShort, shiftMonth } from "@/lib/budget/parse-date";
import { piecesOf } from "@/lib/budget/splits";
import type { MoneyBucket, Transaction } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { FundWizard } from "./fund-wizard";
import { FUND_LINK_KEY } from "./fund-wizard-queue";
import { openCategoryPanel } from "./category-panel-open";
import { FillJar } from "./money-visual";
import { AccountBoard } from "./account-board";
import { SectionTabs } from "./page-menu";
import { GrowProvider } from "./grow/session";
import { WorthPage } from "./grow/worth";
import { useLivelyMotion } from "./use-lively-motion";
import { EmptyArt } from "./visuals/empty-art";
import { MiniBars } from "./visuals/mini-bars";
import { ProgressRing } from "./visuals/progress-ring";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";

export function FundsView() {
  const funds = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const ym = useBudgetStore((s) => s.activeMonth);
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const budgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const setAsides = useBudgetStore((s) => s.setAsides) ?? [];
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const carryStartMonth = useBudgetStore((s) => s.profile.carryStartMonth);
  const profile = useBudgetStore((s) => s.profile);
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const debts = useBudgetStore((s) => s.debts ?? []);
  const [wizard, setWizard] = useState(false);
  const [linked, setLinked] = useState<string | null>(null);
  const [section, setSection] = useState<"goals" | "accounts" | "worth">("goals");

  useEffect(() => {
    const queued = sessionStorage.getItem(FUND_LINK_KEY);
    if (queued === null) return;
    sessionStorage.removeItem(FUND_LINK_KEY);
    setLinked(queued || null);
    setWizard(true);
  }, []);

  if (wizard) {
    return (
      <FundWizard
        linkedCategoryId={linked}
        onDone={() => setWizard(false)}
        onSkip={() => setWizard(false)}
      />
    );
  }

  const total = funds.reduce((sum, fund) => sum + bucketBalance(fund, ym, transactions, categories, moves), 0);
  const ledger = monthLedger(
    { transactions, categories, budgets, buckets: funds, moves, setAsides, style, carryStartMonth, profile },
    ym,
  );
  const used = ledger.funds.reduce((sum, fund) => sum + fund.spent, 0);
  const facts = plannerFacts({ profile, accounts, balances, transactions, categories, year: Number(ym.slice(0, 4)) });
  const picture = moneyPicture({
    accounts,
    balances,
    debts,
    funds,
    transactions,
    categories,
    moves,
    ym,
    bills: facts.typicalFixed.value ?? facts.typicalSpendMonthly.value,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Money</h1>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Money totals">
          {(
            [
              ["Cash", picture.cash],
              ["Brokerage", picture.brokerage],
              ["Retirement", picture.retirement],
              ["Debts", -picture.debts],
              ["Net worth", picture.net],
            ] as const
          ).map(([label, amount]) => (
            <button
              key={label}
              type="button"
              className="rounded-lg border border-border bg-surface p-3 text-left"
              onClick={() => setSection("accounts")}
            >
              <span className="block text-xs text-muted">{label}</span>
              <span className="font-display text-lg tabular">{formatMoney(amount, { signed: true })}</span>
            </button>
          ))}
        </div>
        <SectionTabs
          label="Money"
          items={[
            { label: "Goals", current: section === "goals", onSelect: () => setSection("goals") },
            { label: "Accounts", current: section === "accounts", onSelect: () => setSection("accounts") },
            { label: "Net worth", current: section === "worth", onSelect: () => setSection("worth") },
          ]}
        />
      </div>
      {section === "accounts" ? <AccountBoard /> : null}
      {section === "worth" ? (
        <GrowProvider>
          <WorthPage />
        </GrowProvider>
      ) : null}
      {section === "goals" ? (
      <>
      {funds.length ? (
        <div>
          <p className="font-display text-xl">Across all savings goals: {formatMoney(total)}</p>
          <p className="mt-1 text-sm text-muted">
            +{formatMoney(ledger.totals.savedToFunds)} in · {formatMoney(used)} used
          </p>
        </div>
      ) : (
        <section className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
          <EmptyArt kind="funds" />
          <p className="text-sm" title="A fund is money you set aside. What you do not spend stays in it.">No funds yet.</p>
          <Button className="mt-3" onClick={() => { setLinked(null); setWizard(true); }}>
            Add a fund
          </Button>
        </section>
      )}
      <ul className="space-y-4">
        {funds.map((fund) => (
          <FundCard key={fund.id} fund={fund} />
        ))}
      </ul>
      {funds.length ? (
        <Button variant="outline" onClick={() => { setLinked(null); setWizard(true); }}>
          Add a fund
        </Button>
      ) : null}
      </>
      ) : null}
    </div>
  );
}

function chargesIn(fund: MoneyBucket, ym: string, transactions: Transaction[]) {
  return transactions.filter((t) => {
    if (t.excluded || monthKeyFromDate(t.date) !== ym) return false;
    if (fund.categoryIds.includes(t.categoryId ?? "")) return true;
    const parts = piecesOf(t);
    return Boolean(parts?.some((part) => fund.categoryIds.includes(part.categoryId)));
  });
}

function FundCard({ fund }: { fund: MoneyBucket }) {
  const ym = useBudgetStore((s) => s.activeMonth);
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const budgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const setAsides = useBudgetStore((s) => s.setAsides) ?? [];
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const carryStart = useBudgetStore((s) => s.profile.carryStartMonth);
  const funds = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const updateBucket = useBudgetStore((s) => s.updateBucket);
  const removeBucket = useBudgetStore((s) => s.removeBucket);
  const linkBucketCategory = useBudgetStore((s) => s.linkBucketCategory);
  const unlinkBucketCategory = useBudgetStore((s) => s.unlinkBucketCategory);
  const [view, setView] = useState<"year" | "month">(DEFAULT_FUND_VIEW);
  const [month, setMonth] = useState(ym);
  const [details, setDetails] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const lively = useLivelyMotion();
  const balance = bucketBalance(fund, ym, transactions, categories, moves);
  const range = fundWindow(fund, ym, transactions, categories);
  const line = fullLineOf(fund);
  const pct = line > 0 ? (balance / line) * 100 : 0;
  const negative = balance < -0.004;
  const overflow = balance > line + 0.004;
  const pace = goalPace(fund, balance, ym);
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const debts = useBudgetStore((s) => s.debts ?? []);
  const elapsed = monthsInclusive(fund.startMonth, ym);
  const gap = fund.monthly > 0 ? scheduleGap({ monthly: fund.monthly, monthsElapsed: elapsed, balance: Math.max(0, balance - Math.max(0, fund.opening ?? 0)) }) : null;
  const bills = planTotal(categories);
  const cushion = moneyPicture({ accounts, balances, debts, funds: [fund], transactions, categories, ym, bills: bills > 0 ? bills : null }).cushionMonths;
  const highDebt = debts.filter((debt) => debt.balance > 0 && debt.apr > 8).sort((a, b) => b.apr - a.apr)[0];
  const ready = investingReadiness({
    monthsSaved: cushion ?? 0,
    highAprDebt: highDebt ? { name: highDebt.name, apr: highDebt.apr } : null,
  });
  const putIn = fundingForMonth(fund, month);
  const monthBook = monthLedger(
    { transactions, categories, budgets, buckets: funds, moves, setAsides, style, carryStartMonth: carryStart },
    month,
  );
  const fromBudget = monthBook.funds.find((row) => row.id === fund.id);
  const used = fund.categoryIds.reduce((sum, id) => sum + categorySpend(transactions, categories, id, month, month), 0);
  const endBalance = bucketBalance(fund, month, transactions, categories, moves);
  const rows = chargesIn(fund, month, transactions);
  const linked = categories.filter((c) => fund.categoryIds.includes(c.id));
  const available = categories.filter((c) => c.kind === "expense" && !c.parentId && !funds.some((b) => b.categoryIds.includes(c.id)));
  const goalHit = Boolean(fund.target && fund.target > 0 && balance + 0.004 >= fund.target);
  const extra = Math.max(0, balance - line);
  const showNudge = (overflow || goalHit) && fund.nudgeDismissedYm !== ym;
  const status =
    range.status === "on" ? "Right on budget" : range.status === "ahead" ? `Ahead by ${formatMoney(range.delta)}` : `Over by ${formatMoney(Math.abs(range.delta))}`;

  return (
    <li id={`fund-${fund.id}`} className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <FillJar pct={pct} negative={negative} overflow={overflow} celebrate={lively && goalHit} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">{fund.name}</div>
          <div className={`font-display text-3xl tabular ${negative ? "text-danger" : ""}`}>Fund balance {formatMoney(balance)}</div>
          {negative ? <p className="mt-1 text-sm text-muted">Spent more than saved in this fund.</p> : null}
          <p className="mt-1 text-sm text-muted">
            {range.label}: +{formatMoney(range.funded)} / −{formatMoney(range.used)}
          </p>
          <p className={`mt-1 text-sm ${range.status === "over" ? "text-warn" : "text-muted"}`}>{status}</p>
        </div>
      </div>
      {pace && fund.target ? (
        <div className="mt-3">
          <ProgressRing
            pct={Math.max(0, Math.min(100, (balance / fund.target) * 100))}
            tone={pace.left <= 0 ? "good" : "primary"}
            label={
              pace.left <= 0
                ? "Goal reached"
                : pace.required != null && fund.by
                  ? `${formatMoney(pace.required)}/mo to hit it by ${monthName(fund.by)} ${fund.by.slice(0, 4)}`
                  : pace.projected
                    ? `On pace for ${monthName(pace.projected)} ${pace.projected.slice(0, 4)}`
                    : `${formatMoney(pace.left)} to go`
            }
          />
          {gap ? <p className="mt-2 text-sm">{gap.sentence}</p> : null}
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            <a className="font-medium text-primary" href={`/grow/goal?target=${fund.target ?? ""}&have=${Math.round(balance)}&by=${fund.by ?? ""}`}>
              Plan it
            </a>
            {fund.isCushion ? (
              <a className="font-medium text-primary" href="/grow/cushion">
                Check cushion
              </a>
            ) : null}
          </p>
        </div>
      ) : null}
      {showNudge ? (
        <p className="mt-3 text-sm">
          Goal reached · {formatMoney(extra)} extra ·{" "}
          {ready.step === "ready" ? null : <span>{ready.sentence} </span>}
          <a className="font-medium text-primary" href={`/grow?lump=${Math.round(extra > 0 ? extra : balance)}`}>
            Grow it
          </a>{" "}
          <button type="button" className="text-muted underline-offset-2 hover:underline" onClick={() => updateBucket(fund.id, { nudgeDismissedYm: ym })}>
            Not now
          </button>

        </p>
      ) : null}
      <div className="mt-3 flex gap-1" role="tablist" aria-label={`${fund.name} view`}>
        {(
          [
            ["year", "Year"],
            ["month", "Month"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`min-h-11 rounded-md px-3 text-sm ${view === id ? "bg-primary text-primary-fg" : "border border-border bg-surface"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "year" ? (
        <div className="mt-3">
          {range.months.length ? (
            <MiniBars
              months={range.months.map((row) => ({ label: monthShort(row.ym), a: row.funded, b: row.spent }))}
              aLabel="Put in"
              bLabel="Used"
              onSelect={(index) => {
                const row = range.months[index];
                if (!row) return;
                setMonth(row.ym);
                setView("month");
              }}
            />
          ) : (
            <p className="text-sm text-muted">This fund has not started yet.</p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
              Back
            </Button>
            <div className="text-sm font-medium">{monthLabel(month)}</div>
            <Button size="sm" variant="outline" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
              Next
            </Button>
          </div>
          <p className="text-sm">In {formatMoney(putIn)} · Used {formatMoney(used)} · Fund balance {formatMoney(endBalance)}</p>
          {fromBudget ? (
            <details className="text-sm text-muted">
              <summary>From this month</summary>
              <p>{formatMoney(fromBudget.funding)} funding · {formatMoney(fromBudget.setAsides)} set aside · {formatMoney(fromBudget.spent)} spent</p>
            </details>
          ) : null}
          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {monthShort(t.date.slice(0, 7))} {Number(t.date.slice(8, 10))} · {displayMerchant(t.description)}
                </span>
                <span className="tabular">{formatMoney(t.amount, { signed: true })}</span>
              </li>
            ))}
            {rows.length === 0 ? <li className="px-3 py-3 text-sm text-muted">No charges came out of this fund this month.</li> : null}
          </ul>
        </div>
      )}
      <button type="button" className="mt-3 min-h-11 text-sm font-medium text-primary" onClick={() => setDetails((v) => !v)}>
        {details ? "Hide details" : "Show details"}
      </button>
      {details ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <label className="block text-xs text-muted">
            Name
            <Input className="mt-1" value={fund.name} onChange={(e) => updateBucket(fund.id, { name: e.target.value })} />
          </label>
          <label className="block text-xs text-muted">
            Each month
            <Input
              className="mt-1"
              inputMode="decimal"
              placeholder="0"
              value={String(fund.monthly || "")}
              onChange={(e) => {
                const next = readNumber(e.target.value);
                if (next == null) return;
                updateBucket(fund.id, { monthly: Math.max(0, next), yearly: null });
              }}
            />
          </label>
          <p className="text-xs text-muted">Starts next month.</p>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(fund.paused)} onChange={(e) => updateBucket(fund.id, { paused: e.target.checked })} />
            {fund.paused ? "Paused" : "Pause"}
          </label>
          <div>
            <div className="text-sm font-medium">Spending that comes out of this fund</div>
            <ul className="mt-1 space-y-1 text-sm">
              {linked.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <button type="button" className="font-medium text-primary" onClick={() => openCategoryPanel(c.id, month)}>
                    {c.name}
                  </button>
                  <button type="button" className="text-xs text-muted" onClick={() => unlinkBucketCategory(fund.id, c.id)}>
                    Start over every month instead
                  </button>
                </li>
              ))}
              {linked.length === 0 ? <li className="text-muted">No linked spending.</li> : null}
            </ul>
            {available.length ? (
              <Select className="mt-2" aria-label={`Attach a category to ${fund.name}`} value="" onChange={(e) => { if (e.target.value) linkBucketCategory(fund.id, e.target.value); }}>
                <option value="">Add a category…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            ) : null}
          </div>
          <MoveMoney fund={fund} ym={ym} />
          {confirmRemove ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="danger" onClick={() => removeBucket(fund.id)}>
                Yes, remove it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                Keep it
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
              Remove this fund
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}

function MoveMoney({ fund, ym }: { fund: MoneyBucket; ym: string }) {
  const funds = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const moveBucketMoney = useBudgetStore((s) => s.moveBucketMoney);
  const others = funds.filter((b) => b.id !== fund.id);
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState(others[0]?.id ?? "");
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div>
        <div className="text-sm font-medium">Move money in</div>
        <p className="mt-1 text-xs text-muted" title="This is not income and not spending. It only moves money you already have.">Moves money you already have.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Select aria-label="Move from" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">Not given a job yet</option>
            {others.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <Input aria-label="Amount to move in" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button
            size="sm"
            variant="outline"
            disabled={!(Number(amount) > 0)}
            onClick={() => {
              moveBucketMoney({ ym, amount: Number(amount), fromId: fromId || null, toId: fund.id });
              setAmount("");
            }}
          >
            Move in
          </Button>
        </div>
      </div>
      {others.length ? (
        <div>
          <div className="text-sm font-medium">Move money out</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Select aria-label="Move to" value={toId} onChange={(e) => setToId(e.target.value)}>
              {others.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
            <Input aria-label="Amount to move out" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button
              size="sm"
              variant="outline"
              disabled={!(Number(amount) > 0) || !toId}
              onClick={() => {
                moveBucketMoney({ ym, amount: Number(amount), fromId: fund.id, toId });
                setAmount("");
              }}
            >
              Move out
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">Needs a second fund.</p>
      )}
    </div>
  );
}
