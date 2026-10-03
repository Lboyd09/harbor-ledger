import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bucketBalance } from "@/lib/budget/buckets";
import { MARKET_RATES, SAVINGS_RATES, inflated, loanCompare, monthlyForGoal, monthlyPath, monthsToTarget, payoffPlan, projectBoth, projectLump, rothVsTraditional, yearsToDouble, yearsToFi } from "@/lib/budget/grow-math";
import { monthReview } from "@/lib/budget/insights";
import { DEFAULT_IRA, iraLimit, rothRoom } from "@/lib/budget/ira";
import { formatMoney } from "@/lib/budget/money";
import { plannedTotals } from "@/lib/budget/totals";
import { buildYearWorkbook } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { useLivelyMotion } from "./use-lively-motion";
import { SummaryCard } from "./summary-card";
import { FillJar } from "./money-visual";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

const DISCLAIMER = "Estimates only, not financial advice.";

function BandLine({ label, band }: { label: string; band: { conservative: number; expected: number; optimistic: number } }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 font-display text-2xl tabular">{formatMoney(band.expected)}</div>
      <p className="mt-1 text-xs text-muted">
        Conservative {formatMoney(band.conservative)} · Optimistic {formatMoney(band.optimistic)}
      </p>
    </div>
  );
}

export function GrowView() {
  const profile = useBudgetStore((s) => s.profile);
  const buckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const categories = useBudgetStore((s) => s.categories);
  const transactions = useBudgetStore((s) => s.transactions);
  const ym = useBudgetStore((s) => s.activeMonth);
  const debts = useBudgetStore((s) => s.debts) ?? [];
  const netWorth = useBudgetStore((s) => s.netWorth) ?? [];
  const ira = useBudgetStore((s) => s.ira) ?? DEFAULT_IRA;
  const patchIra = useBudgetStore((s) => s.patchIra);
  const addDebt = useBudgetStore((s) => s.addDebt);
  const removeDebt = useBudgetStore((s) => s.removeDebt);
  const addNetWorth = useBudgetStore((s) => s.addNetWorth);
  const removeNetWorth = useBudgetStore((s) => s.removeNetWorth);
  const nerd = profile.detail === "nerd";
  const lively = useLivelyMotion();
  const year = ym.slice(0, 4);
  const book = useMemo(() => buildYearWorkbook(transactions, categories, year), [transactions, categories, year]);
  const review = monthReview({ ym, transactions, categories, buckets, moves });
  const surplus = buckets.reduce((best, b) => {
    const balance = bucketBalance(b, ym, transactions, categories, moves);
    return balance > best.balance ? { name: b.name, balance } : best;
  }, { name: "Leftover", balance: Math.max(0, book.net) });

  const [calc, setCalc] = useState<"work" | "monthly" | "roth" | "debt" | "worth" | "emergency" | "free" | "goal" | "both" | "loan" | "inflation" | "double" | "reach">("emergency");
  const [principal, setPrincipal] = useState(String(Math.max(0, Math.round(surplus.balance))));
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get("lump"));
    if (Number.isFinite(n) && n > 0) {
      setPrincipal(String(Math.round(n)));
      setCalc("work");
    }
  }, []);
  const [years, setYears] = useState("10");
  const [monthly, setMonthly] = useState("200");
  const [rate, setRate] = useState("7");
  const [taxNow, setTaxNow] = useState("22");
  const [taxLater, setTaxLater] = useState("12");
  const [annual, setAnnual] = useState(String(ira?.under50 ?? 7500));
  const [today, setToday] = useState(false);
  const [inflation, setInflation] = useState("2.5");
  const [age50, setAge50] = useState(false);
  const [joint, setJoint] = useState(false);
  const [magi, setMagi] = useState(String(Math.round((profile.monthlyIncome || 0) * 12)));
  const [showAdv, setShowAdv] = useState(false);

  const inflationRate = Math.max(0, (Number(inflation) || 0) / 100);
  const yearCount = Math.max(0, Number(years) || 0);
  const principalN = Math.max(0, Number(principal) || 0);
  const taxNowN = (Number(taxNow) || 0) / 100;
  const taxLaterN = (Number(taxLater) || 0) / 100;
  const market = (Number(rate) || 0) / 100;

  const savings = projectLump({ principal: principalN, years: yearCount, rates: SAVINGS_RATES, inflation: inflationRate, today, gainTax: taxNowN, endTax: 0 });
  const taxable = projectLump({ principal: principalN, years: yearCount, rates: MARKET_RATES, inflation: inflationRate, today, gainTax: taxNowN, endTax: 0 });
  const roth = projectLump({ principal: principalN * (1 - taxNowN), years: yearCount, rates: MARKET_RATES, inflation: inflationRate, today, gainTax: 0, endTax: 0 });
  const traditional = projectLump({ principal: principalN, years: yearCount, rates: MARKET_RATES, inflation: inflationRate, today, gainTax: 0, endTax: taxLaterN });
  const path = monthlyPath({ monthly: Math.max(0, Number(monthly) || 0), years: yearCount, rate: market, inflation: inflationRate, today });
  const compare = rothVsTraditional({
    annual: Math.max(0, Number(annual) || 0),
    years: yearCount,
    rate: market,
    taxNow: taxNowN,
    taxLater: taxLaterN,
    inflation: inflationRate,
    today,
  });
  const limit = iraLimit(ira, age50);
  const room = rothRoom(ira, Math.max(0, Number(magi) || 0), joint);
  const annualN = Math.max(0, Number(annual) || 0);
  const overLimit = annualN > limit;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Grow</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Pick one question. The numbers start from this ledger. Add a debt or a net-worth snapshot yourself — Harbor never logs into a bank. {DISCLAIMER}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard
          label="Savings rate"
          value={book.income > 0 ? `${Math.round(book.savingsRate * 100)}%` : "—"}
          sentence={
            book.income > 0
              ? `${formatMoney(book.net)} left of ${formatMoney(book.income)} income in ${year}. A common guide is to keep about 20% of income.`
              : "Import a year of income before this means anything."
          }
        />
        <SummaryCard label="This month" value={review.over.length ? `${review.over.length} over` : "On plan"} sentence={review.action}>
          <ul className="space-y-1 text-sm">
            {review.rolled.length ? (
              review.rolled.map((row) => (
                <li key={row.name}>
                  {row.name} kept {formatMoney(row.delta)} from earlier months.
                </li>
              ))
            ) : (
              <li>Nothing extra was saved past last month.</li>
            )}
            {review.over.length ? <li>Over plan: {review.over.join(", ")}.</li> : <li>No category ran past its plan.</li>}
          </ul>
        </SummaryCard>
      </div>

      <div className="space-y-4">
        {(
          [
            ["Everyday", [
              ["emergency", "Emergency fund", "Months of spending, from this year."],
              ["goal", "Save for a goal", "What to set aside each month."],
              ["free", "When work is optional", "The 4% rule and your savings rate."],
            ]],
            ["Debts", [
              ["debt", "Pay off a debt", "Add the balance, the rate, and the minimum."],
              ["loan", "A loan or mortgage", "The payment, and what extra saves."],
            ]],
            ["Investing", [
              ["work", "Invest a lump sum", "One amount, left alone."],
              ["monthly", "Save every month", "What you add, with no starting pile."],
              ["both", "Lump sum and monthly", "A pile plus what you add."],
              ["reach", "How long to reach a number", "A pile, a monthly add, and a target."],
              ["double", "How long to double", "At this rate, when the money doubles."],
              ["inflation", "What money buys later", "The same dollars after inflation."],
              ["roth", "Roth or traditional", "After tax, now versus retirement."],
            ]],
            ["What you own", [
              ["worth", "Net worth", "Type what you own minus what you owe."],
            ]],
          ] as const
        ).map(([group, items]) => (
          <section key={group}>
            <h2 className="text-sm font-medium text-muted">{group}</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {items.map(([id, label, hint]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCalc(id)}
                  className={cn("min-h-16 rounded-lg border px-3 py-2 text-left", calc === id ? "border-primary bg-chip" : "border-border bg-surface")}
                >
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted">{hint}</div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={today} onChange={(e) => setToday(e.target.checked)} />
        Today's dollars
      </label>

      {calc === "emergency" ? <EmergencyFund book={book} /> : null}
      {calc === "goal" ? <GoalTool /> : null}
      {calc === "debt" ? <DebtTool debts={debts} addDebt={addDebt} removeDebt={removeDebt} /> : null}
      {calc === "loan" ? <LoanTool /> : null}
      {calc === "worth" ? (
        <WorthTool netWorth={netWorth} addNetWorth={addNetWorth} removeNetWorth={removeNetWorth} lively={lively} />
      ) : null}
      {calc === "free" ? (
        <SummaryCard
          label="Work optional in"
          value={yearsToFi(Math.max(0, book.savingsRate)) == null ? "—" : `${yearsToFi(Math.max(0, book.savingsRate))} years`}
          sentence={
            book.activeMonths
              ? `The 4% rule wants about ${formatMoney((book.expenses / book.activeMonths) * 12 / 0.04)}, 25 times a year of spending. This uses your ${Math.round(book.savingsRate * 100)}% savings rate and a 5% return after inflation.`
              : "Import spending for a few months before this is useful."
          }
        />
      ) : null}

      {calc === "work" ? (
        <section className="space-y-3">
          <p className="text-sm text-muted">
            Prefilled from {surplus.name}. Edit it. Each option is a range, not one number.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Amount
              <Input className="mt-1" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              Years
              <Input className="mt-1" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-3">
            <BandLine label="Savings account" band={savings} />
            <BandLine label="Taxable investing" band={taxable} />
            <BandLine label="Roth IRA" band={roth} />
            <BandLine label="Traditional IRA" band={traditional} />
          </div>
          <p className="text-xs text-muted">{DISCLAIMER}</p>
        </section>
      ) : null}

      {calc === "monthly" ? (
        <section className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-muted">
              Each month
              <Input className="mt-1" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              Years
              <Input className="mt-1" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              Rate %
              <Input className="mt-1" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </label>
          </div>
          <SummaryCard
            label="Ending balance"
            value={formatMoney(path.at(-1)?.balance ?? 0)}
            sentence={`${formatMoney(path.at(-1)?.contributed ?? 0)} is money you put in. The rest is growth.`}
          >
            <div className="chart-rise h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={path}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
                  <Tooltip formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))} />
                  <Line type="monotone" dataKey="contributed" stroke="var(--color-muted)" dot={false} isAnimationActive={lively} name="Contributed" />
                  <Line type="monotone" dataKey="balance" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={lively} name="Balance" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SummaryCard>
          <p className="text-xs text-muted">{DISCLAIMER}</p>
        </section>
      ) : null}

      {calc === "both" ? <BothTool principal={principal} setPrincipal={setPrincipal} years={years} setYears={setYears} monthly={monthly} setMonthly={setMonthly} rate={rate} setRate={setRate} today={today} inflationRate={inflationRate} lively={lively} /> : null}

      {calc === "inflation" ? <InflationTool /> : null}
      {calc === "double" ? <DoubleTool /> : null}
      {calc === "reach" ? <ReachTool principal={principal} setPrincipal={setPrincipal} /> : null}

      {calc === "roth" ? (
        <section className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Pre-tax amount each year
              <Input className="mt-1" inputMode="decimal" value={annual} onChange={(e) => setAnnual(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              Years
              <Input className="mt-1" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
            </label>
          </div>
          {overLimit ? (
            <p className="rounded-md border border-warn/40 bg-chip px-3 py-2 text-sm">
              That is over the {ira.year} limit of {formatMoney(limit)} in your IRA settings. Check the current IRS figures.
            </p>
          ) : null}
          {room === "partial" ? (
            <p className="text-sm text-muted">Income is inside the Roth phase-out. The IRS would allow only part of this.</p>
          ) : null}
          {room === "none" ? (
            <p className="text-sm text-muted">Income is past the Roth phase-out in your settings. A direct Roth may not be allowed.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard label="Roth, after tax" value={formatMoney(compare.roth)} sentence="You invest the after-tax slice. Growth is not taxed again in this estimate." />
            <SummaryCard label="Traditional, after tax" value={formatMoney(compare.traditional)} sentence="You invest the full pre-tax amount, then tax it at the retirement rate." />
          </div>
          <p className="text-xs text-muted">{DISCLAIMER}</p>
        </section>
      ) : null}

      <button type="button" className="min-h-9 text-sm font-medium text-primary" onClick={() => setShowAdv((v) => !v)}>
        {showAdv ? "Hide details" : "Show details"}
      </button>
      {showAdv ? (
        <div className="detail-in grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Inflation %
            <Input className="mt-1" inputMode="decimal" value={inflation} onChange={(e) => setInflation(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            Expected market rate %
            <Input className="mt-1" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            Tax rate now %
            <Input className="mt-1" inputMode="decimal" value={taxNow} onChange={(e) => setTaxNow(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            Tax rate in retirement %
            <Input className="mt-1" inputMode="decimal" value={taxLater} onChange={(e) => setTaxLater(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            Household income for phase-out
            <Input className="mt-1" inputMode="decimal" value={magi} onChange={(e) => setMagi(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={age50} onChange={(e) => setAge50(e.target.checked)} />
            Age 50 or older
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={joint} onChange={(e) => setJoint(e.target.checked)} />
            Married filing jointly
          </label>
          <div className="sm:col-span-2 space-y-2">
            <p className="text-sm font-medium">IRA figures for {ira.year}</p>
            <p className="text-xs text-muted">{ira.note}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <IraField label="Under 50" value={ira.under50} onChange={(n) => patchIra({ under50: n })} />
              <IraField label="Catch-up" value={ira.catchUp} onChange={(n) => patchIra({ catchUp: n })} />
              <IraField label="Roth single start" value={ira.rothSingleStart} onChange={(n) => patchIra({ rothSingleStart: n })} />
              <IraField label="Roth single end" value={ira.rothSingleEnd} onChange={(n) => patchIra({ rothSingleEnd: n })} />
              <IraField label="Roth joint start" value={ira.rothJointStart} onChange={(n) => patchIra({ rothJointStart: n })} />
              <IraField label="Roth joint end" value={ira.rothJointEnd} onChange={(n) => patchIra({ rothJointEnd: n })} />
            </div>
          </div>
        </div>
      ) : null}

      {calc === "free" && nerd ? (
        <NerdGrow
          bookRate={book.savingsRate}
          annualSpend={book.activeMonths ? (book.expenses / book.activeMonths) * 12 : 0}
          debts={debts}
          netWorth={netWorth}
          categories={categories}
          addDebt={addDebt}
          removeDebt={removeDebt}
          addNetWorth={addNetWorth}
          removeNetWorth={removeNetWorth}
          lively={lively}
          sandboxOnly
        />
      ) : null}
    </div>
  );
}

function IraField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="text-xs text-muted">
      {label}
      <Input className="mt-1" inputMode="decimal" value={String(value)} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
  );
}

function NerdGrow({
  bookRate,
  annualSpend,
  debts,
  netWorth,
  categories,
  addDebt,
  removeDebt,
  addNetWorth,
  removeNetWorth,
  lively,
  sandboxOnly,
}: {
  bookRate: number;
  annualSpend: number;
  debts: { id: string; name: string; balance: number; apr: number; minimum: number }[];
  netWorth: { id: string; date: string; amount: number; note: string }[];
  categories: { id: string; name: string; kind: string; plannedMonthly: number }[];
  addDebt: (d: { name: string; balance: number; apr: number; minimum: number }) => void;
  removeDebt: (id: string) => void;
  addNetWorth: (p: { date: string; amount: number; note: string }) => void;
  removeNetWorth: (id: string) => void;
  lively: boolean;
  sandboxOnly?: boolean;
}) {
  const fi = yearsToFi(Math.max(0, bookRate));
  const target = annualSpend > 0 ? annualSpend / 0.04 : 0;
  const snow = payoffPlan(debts, 50, "snowball");
  const ava = payoffPlan(debts, 50, "avalanche");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minimum, setMinimum] = useState("");
  const [date, setDate] = useState("");
  const [worth, setWorth] = useState("");
  const [note, setNote] = useState("");
  const [sandbox, setSandbox] = useState(() => categories.filter((c) => c.kind === "expense").map((c) => ({ ...c })));
  const plan = plannedTotals(
    sandbox.map((c) => ({ ...c, kind: "expense" as const, slug: c.id, parentId: null })),
    "month",
  );
  const income = categories.filter((c) => c.kind === "income").reduce((s, c) => s + c.plannedMonthly, 0);
  if (sandboxOnly) {
    return (
      <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <h3 className="font-display text-lg font-semibold">Try a different plan</h3>
        <p className="text-sm text-muted">
          This is a copy. Income plan {formatMoney(income)}. Leftover would be {formatMoney(income - plan.expenses, { signed: true })}. It does not change the real plan.
        </p>
        <ul className="space-y-2">
          {sandbox.map((c) => (
            <li key={c.id} className="grid grid-cols-2 items-center gap-2">
              <span className="text-sm">{c.name}</span>
              <Input
                inputMode="decimal"
                aria-label={`Sandbox plan for ${c.name}`}
                value={String(c.plannedMonthly)}
                onChange={(e) =>
                  setSandbox((rows) => rows.map((row) => (row.id === c.id ? { ...row, plannedMonthly: Number(e.target.value) || 0 } : row)))
                }
              />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold">Nerd tools</h2>
      <p className="text-sm text-muted">These stay off in Simple. None of them rewrite the plan except the debt and net-worth lists, which you edit on purpose.</p>
      <SummaryCard
        label="Financial independence"
        value={fi == null ? "—" : `${fi} years`}
        sentence={
          target > 0
            ? `The 4% rule wants about ${formatMoney(target)}, which is 25 times a year of spending. This uses your ${Math.round(bookRate * 100)}% savings rate.`
            : "Need a year of spending before this is useful."
        }
      />
      <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <h3 className="font-display text-lg font-semibold">Debt payoff</h3>
        <p className="text-sm text-muted">
          Extra $50 a month. Snowball {snow.unfinished ? "does not finish in 50 years" : `clears in ${snow.months} months, ${formatMoney(snow.interest)} interest`}. Avalanche{" "}
          {ava.unfinished ? "does not finish in 50 years" : `clears in ${ava.months} months, ${formatMoney(ava.interest)} interest`}.
        </p>
        <ul className="space-y-1 text-sm">
          {debts.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <span>
                {d.name} · {formatMoney(d.balance)} · {d.apr}%
              </span>
              <button type="button" className="text-xs text-muted" onClick={() => removeDebt(d.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input aria-label="Debt name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input aria-label="Balance" inputMode="decimal" placeholder="Balance" value={balance} onChange={(e) => setBalance(e.target.value)} />
          <Input aria-label="APR" inputMode="decimal" placeholder="APR" value={apr} onChange={(e) => setApr(e.target.value)} />
          <Input aria-label="Minimum" inputMode="decimal" placeholder="Minimum" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!name.trim() || !(Number(balance) > 0)) return;
            addDebt({ name, balance: Number(balance), apr: Number(apr) || 0, minimum: Number(minimum) || 0 });
            setName("");
            setBalance("");
          }}
        >
          Add a debt
        </Button>
      </section>
      <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <h3 className="font-display text-lg font-semibold">Net worth</h3>
        <p className="text-sm text-muted">Manual points only. Harbor does not connect to a bank.</p>
        <div className="chart-rise h-40 w-full">
          {netWorth.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={netWorth.map((p) => ({ name: p.date.slice(0, 7), Amount: p.amount }))}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
                <Tooltip formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))} />
                <Line type="monotone" dataKey="Amount" stroke="var(--color-primary)" dot={false} isAnimationActive={lively} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted">Add a date and an amount.</p>
          )}
        </div>
        <ul className="text-sm">
          {netWorth.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span>
                {p.date} · {formatMoney(p.amount)} {p.note}
              </span>
              <button type="button" className="text-xs text-muted" onClick={() => removeNetWorth(p.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input aria-label="Net worth date" placeholder="2026-10-01" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input aria-label="Net worth amount" inputMode="decimal" placeholder="Amount" value={worth} onChange={(e) => setWorth(e.target.value)} />
          <Input aria-label="Net worth note" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
            addNetWorth({ date, amount: Number(worth) || 0, note });
            setDate("");
            setWorth("");
            setNote("");
          }}
        >
          Add a point
        </Button>
      </section>
      <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <h3 className="font-display text-lg font-semibold">Scenario sandbox</h3>
        <p className="text-sm text-muted">
          A copy of the expense plan. Income plan {formatMoney(income)}. This leftover is {formatMoney(income - plan.expenses, { signed: true })}. Nothing here is saved.
        </p>
        <ul className="space-y-2">
          {sandbox.map((c) => (
            <li key={c.id} className="grid grid-cols-2 items-center gap-2">
              <span className="text-sm">{c.name}</span>
              <Input
                inputMode="decimal"
                aria-label={`Sandbox plan for ${c.name}`}
                value={String(c.plannedMonthly)}
                onChange={(e) =>
                  setSandbox((rows) => rows.map((row) => (row.id === c.id ? { ...row, plannedMonthly: Number(e.target.value) || 0 } : row)))
                }
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EmergencyFund({ book }: { book: { expenses: number; activeMonths: number } }) {
  const monthly = book.activeMonths > 0 ? book.expenses / book.activeMonths : 0;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">How big should the cushion be?</h2>
      <p className="text-sm text-muted">
        {monthly > 0
          ? `Months with spending averaged ${formatMoney(monthly)}. Three months covers a surprise. Six months covers a longer gap.`
          : "Import a few months of spending. This uses that average. It is not a bank balance."}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {[1, 3, 6].map((m) => (
          <div key={m} className="text-center">
            <div className="flex justify-center">
              <FillJar pct={(m / 6) * 100} />
            </div>
            <div className="mt-2 text-sm">{m} month{m === 1 ? "" : "s"}</div>
            <div className="font-display text-lg tabular">{formatMoney(monthly * m)}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">{DISCLAIMER} Set this aside as a bucket on Plan.</p>
    </section>
  );
}

function DebtTool({
  debts,
  addDebt,
  removeDebt,
}: {
  debts: { id: string; name: string; balance: number; apr: number; minimum: number }[];
  addDebt: (d: { name: string; balance: number; apr: number; minimum: number }) => void;
  removeDebt: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minimum, setMinimum] = useState("");
  const [extra, setExtra] = useState("50");
  const extraN = Math.max(0, Number(extra) || 0);
  const snow = payoffPlan(debts, extraN, "snowball");
  const ava = payoffPlan(debts, extraN, "avalanche");
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Pay off a debt</h2>
      <p className="text-sm text-muted">
        Type each card or loan. Harbor compares two orders: smallest balance first (snowball) and highest interest first (avalanche). Extra money is on top of the minimums.
      </p>
      {debts.length ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-sm font-medium">Smallest balance first</div>
              <div className="mt-1 font-display text-2xl">{snow.unfinished ? "50+ years" : `${snow.months} months`}</div>
              <p className="text-xs text-muted">{formatMoney(snow.interest)} interest</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-chip">
                <div className="h-full bg-primary" style={{ width: snow.unfinished ? "8%" : "100%" }} />
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-sm font-medium">Highest interest first</div>
              <div className="mt-1 font-display text-2xl">{ava.unfinished ? "50+ years" : `${ava.months} months`}</div>
              <p className="text-xs text-muted">{formatMoney(ava.interest)} interest</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-chip">
                <div className="h-full bg-primary" style={{ width: ava.unfinished ? "8%" : "100%" }} />
              </div>
            </div>
          </div>
          <label className="block text-xs text-muted">
            Extra payment each month
            <Input className="mt-1 max-w-xs" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </label>
          <ul className="space-y-1 text-sm">
            {debts.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span>
                  {d.name} · {formatMoney(d.balance)} · {d.apr}% · min {formatMoney(d.minimum)}
                </span>
                <button type="button" className="text-xs text-muted" onClick={() => removeDebt(d.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-md bg-chip px-3 py-2 text-sm">No debts yet. Add one below. A name, what you owe, the interest rate, and the minimum payment are enough.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <Input aria-label="Debt name" placeholder="Card or loan" value={name} onChange={(e) => setName(e.target.value)} />
        <Input aria-label="Balance" inputMode="decimal" placeholder="Balance" value={balance} onChange={(e) => setBalance(e.target.value)} />
        <Input aria-label="APR" inputMode="decimal" placeholder="Interest %" value={apr} onChange={(e) => setApr(e.target.value)} />
        <Input aria-label="Minimum" inputMode="decimal" placeholder="Minimum" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={!name.trim() || !(Number(balance) > 0)}
        onClick={() => {
          addDebt({ name, balance: Number(balance), apr: Number(apr) || 0, minimum: Number(minimum) || 0 });
          setName("");
          setBalance("");
          setApr("");
          setMinimum("");
        }}
      >
        Add this debt
      </Button>
      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </section>
  );
}

function WorthTool({
  netWorth,
  addNetWorth,
  removeNetWorth,
  lively,
}: {
  netWorth: { id: string; date: string; amount: number; note: string }[];
  addNetWorth: (p: { date: string; amount: number; note: string }) => void;
  removeNetWorth: (id: string) => void;
  lively: boolean;
}) {
  const [date, setDate] = useState("");
  const [worth, setWorth] = useState("");
  const [note, setNote] = useState("");
  const latest = netWorth.at(-1);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Net worth</h2>
      <p className="text-sm text-muted">
        Add what you own minus what you owe, as one number, whenever you feel like it. Cash, savings, and investments, minus debts. Harbor cannot see your bank.
      </p>
      <div className="font-display text-3xl tabular">{latest ? formatMoney(latest.amount) : "—"}</div>
      <p className="text-xs text-muted">{latest ? `Last entered ${latest.date}.` : "Nothing entered yet."}</p>
      {netWorth.length > 1 ? (
        <div className="chart-rise h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={netWorth.map((p) => ({ name: p.date.slice(0, 7), Amount: p.amount }))}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
              <Tooltip formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))} />
              <Line type="monotone" dataKey="Amount" stroke="var(--color-primary)" dot={false} isAnimationActive={lively} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      <ul className="text-sm">
        {netWorth.map((p) => (
          <li key={p.id} className="flex justify-between gap-2 py-1">
            <span>
              {p.date} · {formatMoney(p.amount)} {p.note}
            </span>
            <button type="button" className="text-xs text-muted" onClick={() => removeNetWorth(p.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input aria-label="Amount" inputMode="decimal" placeholder="Total" value={worth} onChange={(e) => setWorth(e.target.value)} />
        <Input aria-label="Note" placeholder="Note, optional" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)}
        onClick={() => {
          addNetWorth({ date, amount: Number(worth) || 0, note });
          setDate("");
          setWorth("");
          setNote("");
        }}
      >
        Save this snapshot
      </Button>
    </section>
  );
}

function GoalTool() {
  const [target, setTarget] = useState("6000");
  const [have, setHave] = useState("0");
  const [months, setMonths] = useState("12");
  const need = monthlyForGoal(Number(target) || 0, Number(have) || 0, Math.max(0, Number(months) || 0));
  const pct = Number(target) > 0 ? ((Number(have) || 0) / Number(target)) * 100 : 0;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Save for a goal</h2>
      <p className="text-sm text-muted">Type the price, what you already have, and how many months you want to take. This does not change your plan.</p>
      <div className="flex items-center gap-3">
        <FillJar pct={pct} />
        <div>
          <div className="text-xs text-muted">Set aside each month</div>
          <div className="font-display text-3xl tabular">{formatMoney(need)}</div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Goal
          <Input className="mt-1" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Already saved
          <Input className="mt-1" inputMode="decimal" value={have} onChange={(e) => setHave(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Months
          <Input className="mt-1" inputMode="decimal" value={months} onChange={(e) => setMonths(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted">{DISCLAIMER} Put this amount on a bucket if you want Harbor to keep it.</p>
    </section>
  );
}

function BothTool({
  principal,
  setPrincipal,
  years,
  setYears,
  monthly,
  setMonthly,
  rate,
  setRate,
  today,
  inflationRate,
  lively,
}: {
  principal: string;
  setPrincipal: (v: string) => void;
  years: string;
  setYears: (v: string) => void;
  monthly: string;
  setMonthly: (v: string) => void;
  rate: string;
  setRate: (v: string) => void;
  today: boolean;
  inflationRate: number;
  lively: boolean;
}) {
  const path = projectBoth({
    principal: Math.max(0, Number(principal) || 0),
    monthly: Math.max(0, Number(monthly) || 0),
    years: Math.max(0, Number(years) || 0),
    rate: (Number(rate) || 0) / 100,
    inflation: inflationRate,
    today,
  });
  const end = path.at(-1);
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted">A starting amount and a monthly add, together. The chart splits what you put in from the ending balance.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Starting amount
          <Input className="mt-1" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Each month
          <Input className="mt-1" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Years
          <Input className="mt-1" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Rate %
          <Input className="mt-1" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
      </div>
      <SummaryCard
        label="Ending balance"
        value={formatMoney(end?.balance ?? 0)}
        sentence={`${formatMoney(end?.contributed ?? 0)} is money you put in. The rest is growth.`}
      >
        <div className="chart-rise h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={path}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
              <Tooltip formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))} />
              <Line type="monotone" dataKey="contributed" stroke="var(--color-muted)" dot={false} isAnimationActive={lively} name="Contributed" />
              <Line type="monotone" dataKey="balance" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={lively} name="Balance" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SummaryCard>
      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </section>
  );
}

function LoanTool() {
  const [balance, setBalance] = useState("20000");
  const [apr, setApr] = useState("6.5");
  const [years, setYears] = useState("5");
  const [extra, setExtra] = useState("50");
  const result = loanCompare({
    balance: Number(balance) || 0,
    apr: Number(apr) || 0,
    years: Number(years) || 1,
    extra: Number(extra) || 0,
  });
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">A loan or mortgage</h2>
      <p className="text-sm text-muted">Type what you owe, the interest rate, and how many years the loan is. Extra is on top of the regular payment.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <div className="text-sm font-medium">Regular payment</div>
          <div className="mt-1 font-display text-2xl tabular">{formatMoney(result.payment)}</div>
          <p className="text-xs text-muted">
            {result.unfinished ? "Does not finish in 50 years." : `${result.months} months, ${formatMoney(result.interest)} interest.`}
          </p>
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="text-sm font-medium">With extra</div>
          <div className="mt-1 font-display text-2xl tabular">{result.extraMonths} months</div>
          <p className="text-xs text-muted">
            {formatMoney(result.extraInterest)} interest. You save {formatMoney(Math.max(0, result.interest - result.extraInterest))} and {Math.max(0, result.months - result.extraMonths)} months.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Balance
          <Input className="mt-1" aria-label="Loan balance" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Interest %
          <Input className="mt-1" aria-label="Loan interest" inputMode="decimal" value={apr} onChange={(e) => setApr(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Years
          <Input className="mt-1" aria-label="Loan years" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Extra each month
          <Input className="mt-1" aria-label="Extra payment" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted">Balance, interest %, years, extra each month. {DISCLAIMER}</p>
    </section>
  );
}

function InflationTool() {
  const [amount, setAmount] = useState("10000");
  const [years, setYears] = useState("10");
  const [rate, setRate] = useState("2.5");
  const result = inflated(Number(amount) || 0, Number(years) || 0, Number(rate) || 0);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">What money buys later</h2>
      <p className="text-sm text-muted">Prices rise. The same pile of cash buys less. This is not a guess about the stock market.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard label="Prices if they rise" value={formatMoney(result.later)} sentence={`What ${formatMoney(Number(amount) || 0)} of today’s goods might cost in ${years || 0} years.`} />
        <SummaryCard label="Buying power" value={formatMoney(result.buyingPower)} sentence="What today’s pile would be worth in today’s prices, if it just sat there." />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Amount today
          <Input className="mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Years
          <Input className="mt-1" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Inflation %
          <Input className="mt-1" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </section>
  );
}

function spanLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} month${rest === 1 ? "" : "s"}`;
  if (rest === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} and ${rest} month${rest === 1 ? "" : "s"}`;
}

function DoubleTool() {
  const [rate, setRate] = useState("7");
  const [amount, setAmount] = useState("10000");
  const years = yearsToDouble(Number(rate) || 0);
  const doubled = years == null ? 0 : (Number(amount) || 0) * 2;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">How long to double</h2>
      <p className="text-sm text-muted">Type a yearly rate. This is compound growth, not a promise. A savings account and the stock market are not the same rate.</p>
      <div className="font-display text-3xl tabular">{years == null ? "—" : `About ${years} years`}</div>
      <p className="text-sm text-muted">{years == null ? "The rate has to be above zero." : `${formatMoney(Number(amount) || 0)} becomes about ${formatMoney(doubled)}.`}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Amount
          <Input className="mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Yearly rate %
          <Input className="mt-1" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </section>
  );
}

function ReachTool({ principal, setPrincipal }: { principal: string; setPrincipal: (v: string) => void }) {
  const [monthly, setMonthly] = useState("200");
  const [rate, setRate] = useState("7");
  const [target, setTarget] = useState("100000");
  const months = monthsToTarget({
    principal: Number(principal) || 0,
    monthly: Number(monthly) || 0,
    apr: Number(rate) || 0,
    target: Number(target) || 0,
  });
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">How long to reach a number</h2>
      <p className="text-sm text-muted">Start with what you have, add something each month, and type the number you want. This does not change your plan.</p>
      <div className="font-display text-3xl tabular">{months == null ? "Not within 50 years" : months === 0 ? "You are already there" : spanLabel(months)}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Already saved
          <Input className="mt-1" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Add each month
          <Input className="mt-1" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Yearly rate %
          <Input className="mt-1" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Target
          <Input className="mt-1" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </section>
  );
}


