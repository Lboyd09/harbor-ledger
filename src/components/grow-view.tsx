import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bucketBalance } from "@/lib/budget/buckets";
import { MARKET_RATES, SAVINGS_RATES, monthlyPath, payoffPlan, projectLump, rothVsTraditional, yearsToFi } from "@/lib/budget/grow-math";
import { monthReview } from "@/lib/budget/insights";
import { DEFAULT_IRA, iraLimit, rothRoom } from "@/lib/budget/ira";
import { formatMoney } from "@/lib/budget/money";
import { plannedTotals } from "@/lib/budget/totals";
import { buildYearWorkbook } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { useLivelyMotion } from "./use-lively-motion";
import { SummaryCard } from "./summary-card";
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

  const [calc, setCalc] = useState<"work" | "monthly" | "roth">("work");
  const [principal, setPrincipal] = useState(String(Math.max(0, Math.round(surplus.balance))));
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
          One projection at a time, starting from money already in this ledger. {DISCLAIMER}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard
          label="Savings rate"
          value={book.income > 0 ? `${Math.round(book.savingsRate * 100)}%` : "—"}
          sentence={
            book.income > 0
              ? `${formatMoney(book.net)} left of ${formatMoney(book.income)} income in ${year}.`
              : "Import a year of income before this means anything."
          }
        />
        <SummaryCard label="This month" value={review.over.length ? `${review.over.length} over` : "On plan"} sentence={review.action}>
          <ul className="space-y-1 text-sm">
            {review.rolled.length ? (
              review.rolled.map((row) => (
                <li key={row.name}>
                  {row.name} rolled {formatMoney(row.delta)} forward.
                </li>
              ))
            ) : (
              <li>No bucket grew past last month.</li>
            )}
            {review.over.length ? <li>Over plan: {review.over.join(", ")}.</li> : <li>No category ran past its plan.</li>}
          </ul>
        </SummaryCard>
      </div>

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["work", "Put it to work"],
            ["monthly", "Monthly contribution"],
            ["roth", "Roth vs traditional"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCalc(id)}
            className={cn("min-h-11 rounded-md px-3 text-sm", calc === id ? "bg-primary text-primary-fg" : "border border-border bg-surface")}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={today} onChange={(e) => setToday(e.target.checked)} />
        Today's dollars
      </label>

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

      {nerd ? <NerdGrow bookRate={book.savingsRate} annualSpend={book.activeMonths ? (book.expenses / book.activeMonths) * 12 : 0} debts={debts} netWorth={netWorth} categories={categories} addDebt={addDebt} removeDebt={removeDebt} addNetWorth={addNetWorth} removeNetWorth={removeNetWorth} lively={lively} /> : null}
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
