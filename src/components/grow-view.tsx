import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { latestBalance } from "@/lib/budget/accounts";
import { bucketBalance } from "@/lib/budget/buckets";
import { MARKET_RATES, SAVINGS_RATES, inflated, loanCompare, monthlyForGoal, monthlyPath, monthsToTarget, payoffPlan, projectBoth, projectLump, rothVsTraditional, yearsToDouble, yearsToFi } from "@/lib/budget/grow-math";
import { amortizationSchedule, debtTimeline, fiNumbers, netWorthSeries, sensitivityOf, yearRows } from "@/lib/budget/grow-tables";
import { monthReview } from "@/lib/budget/insights";
import { DEFAULT_IRA, iraLimit, rothRoom } from "@/lib/budget/ira";
import { formatMoney } from "@/lib/budget/money";
import { assumptionLines } from "@/lib/budget/reference";
import { plannedTotals } from "@/lib/budget/totals";
import { buildYearWorkbook } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { useLivelyMotion } from "./use-lively-motion";
import { SummaryCard } from "./summary-card";
import { FillJar } from "./money-visual";
import { GrowthArea, PayoffRace, PlaceMap, RothBars, YourMoney } from "./grow-pictures";
import { EmptyArt } from "./visuals/empty-art";
import { ProgressRing } from "./visuals/progress-ring";
import { RetirementCard } from "./retirement-card";
import { AdvancedDepth } from "./calc-depth";
import { usePlannerFacts } from "./use-planner-facts";
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
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const ira = useBudgetStore((s) => s.ira) ?? DEFAULT_IRA;
  const patchIra = useBudgetStore((s) => s.patchIra);
  const addDebt = useBudgetStore((s) => s.addDebt);
  const removeDebt = useBudgetStore((s) => s.removeDebt);
  const addNetWorth = useBudgetStore((s) => s.addNetWorth);
  const removeNetWorth = useBudgetStore((s) => s.removeNetWorth);
  const saved = accounts
    .filter((account) => account.kind === "savings")
    .reduce((sum, account) => sum + Math.max(0, latestBalance(account.id, balances)?.amount ?? 0), 0);
  const nerd = profile.detail === "nerd";
  const facts = usePlannerFacts();
  const lively = useLivelyMotion();
  const year = ym.slice(0, 4);
  const book = useMemo(() => buildYearWorkbook(transactions, categories, year), [transactions, categories, year]);
  const review = monthReview({ ym, transactions, categories, buckets, moves });
  const surplus = buckets.reduce((best, b) => {
    const balance = bucketBalance(b, ym, transactions, categories, moves);
    return balance > best.balance ? { name: b.name, balance } : best;
  }, { name: "Leftover", balance: Math.max(0, book.net) });

  const [calc, setCalc] = useState<"work" | "monthly" | "roth" | "debt" | "worth" | "emergency" | "free" | "goal" | "both" | "loan" | "inflation" | "double" | "reach" | "retire">("retire");
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
  const [inflation, setInflation] = useState("2");
  const [age50, setAge50] = useState(false);
  const [joint, setJoint] = useState(false);
  const [magi, setMagi] = useState(String(Math.round((profile.monthlyIncome || 0) * 12)));
  const [showAdv, setShowAdv] = useState(false);
  const filled = useRef(false);
  useEffect(() => {
    if (filled.current) return;
    if (facts.monthlySaving.value == null && facts.age.value == null && facts.inflation.value == null) return;
    filled.current = true;
    if (facts.monthlySaving.value != null) setMonthly(String(Math.round(facts.monthlySaving.value)));
    setRate(String(Math.round((facts.returns.expected || 0.07) * 1000) / 10));
    if (facts.age.value != null) setAge50(facts.age.value >= 50);
    if (facts.inflation.value != null) setInflation(String(Math.round(facts.inflation.value * 1000) / 10));
    if (facts.saved.value != null) {
      setPrincipal((current) => (Number(current) > 0 ? current : String(Math.round(facts.saved.value ?? 0))));
    }
  }, [facts]);

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
          The pictures start from your file and your spending categories. A fund is extra savings, not the budget. Add a debt or a net-worth snapshot yourself — Harbor never logs into a bank. {DISCLAIMER}
        </p>
      </div>

      {!transactions.length && accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
          <EmptyArt kind="grow" />
          <p className="text-sm">Nothing of your own is here yet. Add a bank file, or type a number in the pictures below.</p>
          <Link to="/import" className="mt-3 inline-flex">
            <Button>Add your first bank file</Button>
          </Link>
        </div>
      ) : (
        <YourMoney accounts={accounts} balances={balances} netWorth={netWorth} />
      )}

      <PlaceMap />

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
            ["Plan ahead", [
              ["retire", "Retirement", "Where you stand, the gap, and what closes it."],
              ["free", "When work is optional", "Your spending, your savings rate, and the 4% rule."],
              ["goal", "Save for a goal", "What to set aside each month."],
            ]],
            ["See it grow", [
              ["work", "Put it to work", "One amount, left alone."],
              ["monthly", "Add a bit every month", "What you add, with no starting pile."],
              ["both", "A pile and a monthly add", "Both at once."],
              ["roth", "Roth or traditional", "Two bars, after tax."],
              ["reach", "How long to reach a number", "A pile, a monthly add, and a target."],
              ["double", "How long to double", "At this rate, when the money doubles."],
              ["inflation", "What money buys later", "The same dollars after inflation."],
            ]],
            ["Protect yourself", [
              ["emergency", "Emergency fund", "Months of spending, from this year."],
              ["worth", "Net worth", "Type what you own minus what you owe."],
            ]],
            ["Pay it down", [
              ["debt", "Pay off a debt", "Smallest balance or highest interest."],
              ["loan", "A loan or mortgage", "The payment, and what extra saves."],
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

      {calc === "retire" ? <RetirementCard /> : null}
      {calc === "emergency" ? <EmergencyFund book={book} saved={facts.cashSavings.value ?? saved} /> : null}
      {calc === "goal" ? <GoalTool /> : null}
      {calc === "debt" ? <DebtTool debts={debts} addDebt={addDebt} removeDebt={removeDebt} /> : null}
      {calc === "loan" ? <LoanTool /> : null}
      {calc === "worth" ? (
        <WorthTool netWorth={netWorth} addNetWorth={addNetWorth} removeNetWorth={removeNetWorth} lively={lively} />
      ) : null}
      {calc === "free" ? <WorkOptional book={book} /> : null}

      {calc === "work" ? (
        <section className="space-y-3">
          <GrowthArea principal={principalN} years={yearCount} inflation={inflationRate} today={today} gainTax={taxNowN} lively={lively} />
          <details>
            <summary className="min-h-11 cursor-pointer text-sm font-medium">Change the numbers</summary>
            <p className="mt-2 text-sm text-muted">Prefilled from {surplus.name}. Edit it. Each option is a range, not one number. From your accounts when a fund has a balance, otherwise from this year's leftover.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-muted">
                Amount
                <Input className="mt-1" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
              </label>
              <label className="text-xs text-muted">
                Years
                <Input className="mt-1" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
              </label>
            </div>
          </details>
          <div className="grid gap-3">
            <BandLine label="Savings account" band={savings} />
            <BandLine label="Taxable investing" band={taxable} />
            <BandLine label="Roth IRA" band={roth} />
            <BandLine label="Traditional IRA" band={traditional} />
          </div>
          <p className="text-xs text-muted">{DISCLAIMER} {facts.returns.note}</p>
          <AdvancedDepth
            show={nerd}
            metrics={[
              { label: "Savings, likely", value: formatMoney(savings.expected) },
              { label: "Taxable, likely", value: formatMoney(taxable.expected) },
              { label: "Roth, likely", value: formatMoney(roth.expected) },
              { label: "Traditional, likely", value: formatMoney(traditional.expected) },
              { label: "Starting amount", value: formatMoney(principalN) },
              { label: "Years", value: String(yearCount) },
            ]}
            columns={["Year", "Put in", "Balance"]}
            rows={yearRows({ principal: principalN, monthly: 0, years: yearCount, rate: market, inflation: inflationRate, today }).map((row) => [String(row.year), formatMoney(row.contributed), formatMoney(row.balance)])}
            assumptions={assumptionLines(["savings-expected", "market-expected", "inflation"])}
            sensitivity={sensitivityOf((next) => yearRows({ principal: principalN, monthly: 0, years: yearCount, rate: next, inflation: inflationRate, today }).at(-1)?.balance ?? 0, market, 0).map((row) => ({ label: row.label, value: formatMoney(row.value) }))}
          />
        </section>
      ) : null}

      {calc === "monthly" ? (
        <section className="space-y-3">
          <p className="text-sm">
            {formatMoney(path.at(-1)?.contributed ?? 0)} is money you put in. The rest of {formatMoney(path.at(-1)?.balance ?? 0)} is growth. An estimate, not financial advice.
          </p>
          <details>
            <summary className="min-h-11 cursor-pointer text-sm font-medium">Change the numbers</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-xs text-muted">
                Each month
                <Input className="mt-1" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
                <span className="mt-1 block">{facts.monthlySaving.source}. {facts.monthlySaving.note}</span>
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
          </details>
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
          <p className="text-xs text-muted">{DISCLAIMER} {facts.returns.note}</p>
          <AdvancedDepth
            show={nerd}
            metrics={[
              { label: "Ending balance", value: formatMoney(path.at(-1)?.balance ?? 0) },
              { label: "Put in", value: formatMoney(path.at(-1)?.contributed ?? 0) },
              { label: "Growth", value: formatMoney((path.at(-1)?.balance ?? 0) - (path.at(-1)?.contributed ?? 0)) },
              { label: "Each month", value: formatMoney(Number(monthly) || 0) },
              { label: "Years", value: String(yearCount) },
              { label: "Rate", value: `${rate}%` },
            ]}
            columns={["Year", "Put in", "Balance"]}
            rows={path.map((row) => [String(row.year), formatMoney(row.contributed), formatMoney(row.balance)])}
            assumptions={[facts.monthlySaving.note, ...assumptionLines(["market-expected", "inflation"])]}
            sensitivity={sensitivityOf((next, add) => monthlyPath({ monthly: add, years: yearCount, rate: next, inflation: inflationRate, today }).at(-1)?.balance ?? 0, market, Number(monthly) || 0).map((row) => ({ label: row.label, value: formatMoney(row.value) }))}
          />
        </section>
      ) : null}

      {calc === "both" ? (
        <>
          <BothTool principal={principal} setPrincipal={setPrincipal} years={years} setYears={setYears} monthly={monthly} setMonthly={setMonthly} rate={rate} setRate={setRate} today={today} inflationRate={inflationRate} lively={lively} />
          <AdvancedDepth
            show={nerd}
            metrics={[
              { label: "Ending balance", value: formatMoney(projectBoth({ principal: principalN, monthly: Number(monthly) || 0, years: yearCount, rate: market, inflation: inflationRate, today }).at(-1)?.balance ?? 0) },
              { label: "Starting amount", value: formatMoney(principalN) },
              { label: "Each month", value: formatMoney(Number(monthly) || 0) },
              { label: "Years", value: String(yearCount) },
              { label: "Rate", value: `${rate}%` },
              { label: "Inflation", value: `${inflation}%` },
            ]}
            columns={["Year", "Put in", "Growth", "Balance"]}
            rows={yearRows({ principal: principalN, monthly: Number(monthly) || 0, years: yearCount, rate: market, inflation: inflationRate, today }).map((row) => [String(row.year), formatMoney(row.contributed), formatMoney(row.growth), formatMoney(row.balance)])}
            assumptions={[facts.saved.note, facts.monthlySaving.note, ...assumptionLines(["market-expected", "inflation"])]}
            sensitivity={sensitivityOf((next, add) => yearRows({ principal: principalN, monthly: add, years: yearCount, rate: next, inflation: inflationRate, today }).at(-1)?.balance ?? 0, market, Number(monthly) || 0).map((row) => ({ label: row.label, value: formatMoney(row.value) }))}
          />
        </>
      ) : null}

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
              That is over the {ira.year} limit of {formatMoney(limit)} in your IRA settings. Check current rules.
            </p>
          ) : null}
          {room === "partial" ? (
            <p className="text-sm text-muted">Income is inside the Roth phase-out. The IRS would allow only part of this.</p>
          ) : null}
          {room === "none" ? (
            <p className="text-sm text-muted">Income is past the Roth phase-out in your settings. A direct Roth may not be allowed.</p>
          ) : null}
          <RothBars roth={compare.roth} traditional={compare.traditional} taxNow={taxNow} taxLater={taxLater} />
          <ProgressRing
            pct={limit > 0 ? Math.min(100, (annualN / limit) * 100) : 0}
            tone={overLimit ? "danger" : "primary"}
            label={overLimit ? `Over the ${ira.year} limit of ${formatMoney(limit)}. Check current rules.` : `${formatMoney(annualN)} of the ${formatMoney(limit)} limit. Check current rules.`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard label="Roth, after tax" value={formatMoney(compare.roth)} sentence="You invest the after-tax slice. Growth is not taxed again in this estimate." />
            <SummaryCard label="Traditional, after tax" value={formatMoney(compare.traditional)} sentence="You invest the full pre-tax amount, then tax it at the retirement rate." />
          </div>
          <p className="text-xs text-muted">
            {facts.age.value == null ? "Age is not entered, so the catch-up limit stays off until you check it." : `Age ${facts.age.value} is typed. ${facts.age.value >= 50 ? "The catch-up limit is included." : "Under 50, so no catch-up."}`} {assumptionLines(["ira-under-50", "ira-catch-up", "roth-single-start"])[0]}
          </p>
          <p className="text-xs text-muted">{DISCLAIMER}</p>
          <AdvancedDepth
            show={nerd}
            metrics={[
              { label: "Roth after tax", value: formatMoney(compare.roth) },
              { label: "Traditional after tax", value: formatMoney(compare.traditional) },
              { label: "Roth put in", value: formatMoney(compare.rothContributed) },
              { label: "Traditional put in", value: formatMoney(compare.traditionalContributed) },
              { label: "Limit", value: formatMoney(limit) },
              { label: "Room", value: room },
            ]}
            columns={["Year", "Roth contributed", "Traditional contributed"]}
            rows={Array.from({ length: Math.min(Math.max(1, Math.round(yearCount)), 30) }, (_, index) => {
              const year = index + 1;
              return [String(year), formatMoney(compare.rothContributed / Math.max(1, yearCount) * year), formatMoney(compare.traditionalContributed / Math.max(1, yearCount) * year)];
            })}
            assumptions={assumptionLines(["ira-under-50", "ira-catch-up", "roth-single-start", "roth-single-end", "roth-joint-start", "roth-joint-end", "market-expected", "inflation"])}
            sensitivity={sensitivityOf((next) => rothVsTraditional({ annual: annualN, years: yearCount, rate: next, taxNow: taxNowN, taxLater: taxLaterN, inflation: inflationRate, today }).roth, market, 0).map((row) => ({ label: row.label, value: formatMoney(row.value) }))}
          />
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
      <h2 className="font-display text-xl font-semibold">Advanced tools</h2>
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

function WorkOptional({ book }: { book: { expenses: number; activeMonths: number; savingsRate: number } }) {
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  const facts = usePlannerFacts();
  const yearly = facts.typicalSpendMonthly.value != null ? facts.typicalSpendMonthly.value * 12 : book.activeMonths > 0 ? (book.expenses / book.activeMonths) * 12 : 0;
  const rate = facts.savingsRate != null ? Math.max(0, facts.savingsRate) : Math.max(0, book.savingsRate);
  const withdrawal = facts.withdrawal.value ?? 0.04;
  const real = Math.max(0, (facts.returns.expected || 0.05) - (facts.inflation.value ?? 0.02));
  const yearsLeft = facts.age.value != null && facts.retireAge.value != null ? Math.max(0, facts.retireAge.value - facts.age.value) : null;
  const fi = fiNumbers({ yearlySpend: yearly, withdrawal, savingsRate: rate, realReturn: real || 0.05, yearsLeft });
  const source = facts.typicalSpendMonthly.value != null ? "From your spending." : "From this year's charges.";
  return (
    <section className="space-y-3">
      <SummaryCard
        label="Work optional in"
        value={fi.years == null ? "—" : `${fi.years} years`}
        sentence={
          yearly > 0
            ? `Work is optional around ${formatMoney(fi.fi ?? 0)}. That is a year of spending divided by the withdrawal rate. Savings rate ${Math.round(rate * 100)}%. ${source}`
            : "Import spending for a few months before this is useful."
        }
      >
        <ProgressRing
          pct={fi.fi ? Math.min(100, ((facts.saved.value ?? 0) / fi.fi) * 100) : 0}
          tone="primary"
          label={fi.fi ? `${Math.round(Math.min(100, ((facts.saved.value ?? 0) / fi.fi) * 100))} percent of the number` : "Need spending first"}
        />
      </SummaryCard>
      <AdvancedDepth
        show={nerd}
        metrics={[
          { label: "FI number", value: fi.fi == null ? "—" : formatMoney(fi.fi) },
          { label: "Years", value: fi.years == null ? "—" : String(fi.years) },
          { label: "Coast number", value: fi.coast == null ? "—" : formatMoney(fi.coast) },
          { label: "Yearly spending", value: formatMoney(yearly) },
          { label: "Savings rate", value: `${Math.round(rate * 100)}%` },
          { label: "Withdrawal", value: `${Math.round(withdrawal * 1000) / 10}%` },
        ]}
        columns={["Piece", "Amount"]}
        rows={[
          ["Yearly spending", formatMoney(yearly)],
          ["FI number", fi.fi == null ? "—" : formatMoney(fi.fi)],
          ["Coast", fi.coast == null ? "—" : formatMoney(fi.coast)],
          ["Years to the retire age", yearsLeft == null ? "Age not entered" : String(yearsLeft)],
        ]}
        assumptions={[facts.typicalSpendMonthly.note, facts.withdrawal.note, facts.returns.note, ...assumptionLines(["withdrawal", "market-expected", "inflation"])]}
        sensitivity={sensitivityOf((next) => fiNumbers({ yearlySpend: yearly, withdrawal, savingsRate: rate, realReturn: Math.max(0, next), yearsLeft }).years ?? 0, real || 0.05, 0).map((row) => ({
          label: row.label,
          value: row.label.startsWith("Monthly") ? "Uses your savings rate, not a deposit" : `${row.value} years`,
        }))}
      />
    </section>
  );
}

function EmergencyFund({ book, saved }: { book: { expenses: number; activeMonths: number }; saved: number }) {
  const facts = usePlannerFacts();
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  const [months, setMonths] = useState(3);
  const monthly = facts.typicalSpendMonthly.value ?? (book.activeMonths > 0 ? book.expenses / book.activeMonths : 0);
  const target = monthly * months;
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const covered = monthly > 0 ? saved / monthly : 0;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">How big should the cushion be?</h2>
      <p className="text-sm">
        {monthly > 0
          ? `${formatMoney(saved)} is in savings. ${months} months of spending is ${formatMoney(target)}, about ${covered.toFixed(1)} months covered. ${facts.typicalSpendMonthly.value != null ? "From your spending." : "From this year's charges."}`
          : "Import a few months of spending. This uses that average. It is not a bank balance."}
      </p>
      <ProgressRing pct={pct} tone={pct >= 100 ? "good" : "primary"} label={target > 0 ? `${Math.round(pct)}% of ${months} months` : "No spending average yet"} />
      <div className="flex gap-2">
        {[1, 3, 6].map((m) => (
          <button key={m} type="button" className={`min-h-11 rounded-md px-3 text-sm ${months === m ? "bg-primary text-primary-fg" : "border border-border"}`} aria-pressed={months === m} onClick={() => setMonths(m)}>
            {m} month{m === 1 ? "" : "s"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 3, 6].map((m) => (
          <div key={m} className="text-center">
            <div className="flex justify-center">
              <FillJar pct={(m / 6) * 100} celebrate={m === months && pct >= 100} />
            </div>
            <div className="mt-2 text-sm">{m} month{m === 1 ? "" : "s"}</div>
            <div className="font-display text-lg tabular">{formatMoney(monthly * m)}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">{DISCLAIMER} Set this aside as a fund. {facts.typicalFixed.value ? `Steady bills are about ${formatMoney(facts.typicalFixed.value)} a month.` : facts.typicalFixed.note}</p>
      <AdvancedDepth
        show={nerd}
        metrics={[
          { label: "Saved", value: formatMoney(saved) },
          { label: "Typical month", value: formatMoney(monthly) },
          { label: "Months covered", value: monthly > 0 ? covered.toFixed(1) : "—" },
          { label: "Target", value: formatMoney(target) },
          { label: "Still to save", value: formatMoney(Math.max(0, target - saved)) },
          { label: "Steady bills", value: formatMoney(facts.typicalFixed.value ?? 0) },
        ]}
        columns={["Months", "Target", "Gap"]}
        rows={[1, 3, 6].map((count) => [String(count), formatMoney(monthly * count), formatMoney(Math.max(0, monthly * count - saved))])}
        assumptions={[facts.cashSavings.note, facts.typicalSpendMonthly.note, facts.typicalFixed.note]}
        sensitivity={[
          { label: "Spending $100 less", value: monthly > 100 ? `${(saved / (monthly - 100)).toFixed(1)} months` : "—" },
          { label: "Spending as entered", value: monthly > 0 ? `${covered.toFixed(1)} months` : "—" },
          { label: "Spending $100 more", value: monthly > 0 ? `${(saved / (monthly + 100)).toFixed(1)} months` : "—" },
        ]}
      />
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
  const facts = usePlannerFacts();
  const started = useRef(false);
  useEffect(() => {
    if (started.current || debts.length) return;
    if (facts.creditOwed.value == null) return;
    started.current = true;
    setBalance(String(Math.round(facts.creditOwed.value)));
  }, [debts.length, facts]);
  const extraN = Math.max(0, Number(extra) || 0);
  const snow = payoffPlan(debts, extraN, "snowball");
  const ava = payoffPlan(debts, extraN, "avalanche");
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Pay off a debt</h2>
      <p className="text-sm">
        {debts.length
          ? `Highest interest first finishes in ${ava.unfinished ? "more than 50 years" : `${ava.months} months`} and costs ${formatMoney(ava.interest)} in interest.`
          : facts.creditOwed.value != null
            ? `Cards total ${formatMoney(facts.creditOwed.value)}. From your accounts. Type the rate and the minimum, then add the debt.`
            : "Type each card or loan. The payoff date and interest show once a debt is added."}
      </p>
      {debts.length ? (
        <>
          <PayoffRace snowMonths={snow.months} avaMonths={ava.months} snowInterest={snow.interest} avaInterest={ava.interest} />
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
      <DebtWorkings debts={debts} extra={extraN} />
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
        Add what you own minus what you owe. When accounts have balances, those are the starting point. A single date is one snapshot, not a trend. Harbor cannot see your bank.
      </p>
      <div className="font-display text-3xl tabular">{latest ? formatMoney(latest.amount) : "—"}</div>
      <p className="text-xs text-muted">{latest ? `Last entered ${latest.date}.` : "Nothing entered yet."}</p>
      <WorthFromAccounts />
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
  const facts = usePlannerFacts();
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  const started = useRef(false);
  const [target, setTarget] = useState("");
  const [have, setHave] = useState("");
  const [months, setMonths] = useState("12");
  useEffect(() => {
    if (started.current) return;
    if (facts.cashSavings.value == null && facts.typicalSpendMonthly.value == null) return;
    started.current = true;
    if (facts.cashSavings.value != null) setHave(String(Math.round(facts.cashSavings.value)));
    if (facts.typicalSpendMonthly.value != null) setTarget(String(Math.round(facts.typicalSpendMonthly.value * 3)));
  }, [facts]);
  const goal = Number(target) || 0;
  const saved = Number(have) || 0;
  const monthCount = Math.max(0, Number(months) || 0);
  const need = monthlyForGoal(goal, saved, monthCount);
  const pct = goal > 0 ? Math.min(100, (saved / goal) * 100) : 0;
  const steps = Math.min(Math.max(0, Math.round(monthCount)), 36);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Save for a goal</h2>
      <p className="text-sm">
        {goal > 0
          ? `Set aside ${formatMoney(need)} each month for ${monthCount || 0} months. Already saved starts from a savings account when one exists.`
          : "Type the price. Already saved starts from a savings account when one exists."}
      </p>
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
          <Input className="mt-1" inputMode="decimal" aria-label="Goal" value={target} onChange={(e) => setTarget(e.target.value)} />
          <span className="mt-1 block">{facts.typicalSpendMonthly.value != null ? "From your spending, about three typical months. Edit it." : "Typed."}</span>
        </label>
        <label className="text-xs text-muted">
          Already saved
          <Input className="mt-1" inputMode="decimal" aria-label="Already saved" value={have} onChange={(e) => setHave(e.target.value)} />
          <span className="mt-1 block">{facts.cashSavings.source}. {facts.cashSavings.note}</span>
        </label>
        <label className="text-xs text-muted">
          Months
          <Input className="mt-1" inputMode="decimal" aria-label="Goal months" value={months} onChange={(e) => setMonths(e.target.value)} />
          <span className="mt-1 block">Typed. This does not change the budget.</span>
        </label>
      </div>
      <AdvancedDepth
        show={nerd}
        metrics={[
          { label: "Each month", value: formatMoney(need) },
          { label: "Goal", value: formatMoney(goal) },
          { label: "Already saved", value: formatMoney(saved) },
          { label: "Still to save", value: formatMoney(Math.max(0, goal - saved)) },
          { label: "Months", value: String(monthCount) },
          { label: "Percent saved", value: `${Math.round(pct)}%` },
        ]}
        columns={["Month", "Saved"]}
        rows={Array.from({ length: steps }, (_, index) => [String(index + 1), formatMoney(Math.min(goal, saved + need * (index + 1)))])}
        assumptions={[facts.cashSavings.note, facts.typicalSpendMonthly.note, "A goal is extra savings. It is not a budget category."]}
        sensitivity={[
          { label: "Already saved $100 less", value: formatMoney(monthlyForGoal(goal, Math.max(0, saved - 100), monthCount)) },
          { label: "Already saved as entered", value: formatMoney(need) },
          { label: "Already saved $100 more", value: formatMoney(monthlyForGoal(goal, saved + 100, monthCount)) },
        ]}
      />
      <p className="text-xs text-muted">{DISCLAIMER} Put this amount in a fund if you want Harbor to keep it.</p>
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
          <span className="mt-1 block">From a fund balance when one is left over, otherwise retirement and investment accounts.</span>
        </label>
        <label className="text-xs text-muted">
          Each month
          <Input className="mt-1" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          <span className="mt-1 block">From your income when a savings rate exists. Otherwise typed.</span>
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
  const facts = usePlannerFacts();
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  const started = useRef(false);
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [years, setYears] = useState("5");
  const [extra, setExtra] = useState("0");
  useEffect(() => {
    if (started.current) return;
    if (facts.creditOwed.value == null) return;
    started.current = true;
    setBalance(String(Math.round(facts.creditOwed.value)));
  }, [facts]);
  const result = loanCompare({
    balance: Number(balance) || 0,
    apr: Number(apr) || 0,
    years: Number(years) || 1,
    extra: Number(extra) || 0,
  });
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">A loan or mortgage</h2>
      <p className="text-sm">
        {result.unfinished
          ? "This payment does not finish the loan in 50 years."
          : `The regular payment is ${formatMoney(result.payment)}. Extra saves ${formatMoney(Math.max(0, result.interest - result.extraInterest))} and ${Math.max(0, result.months - result.extraMonths)} months.`}
      </p>
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
          <span className="mt-1 block">{facts.creditOwed.source}. {facts.creditOwed.note}</span>
        </label>
        <label className="text-xs text-muted">
          Interest %
          <Input className="mt-1" aria-label="Loan interest" inputMode="decimal" value={apr} onChange={(e) => setApr(e.target.value)} />
          <span className="mt-1 block">Typed. Not taken from a published rate.</span>
        </label>
        <label className="text-xs text-muted">
          Years
          <Input className="mt-1" aria-label="Loan years" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
          <span className="mt-1 block">Typed.</span>
        </label>
        <label className="text-xs text-muted">
          Extra each month
          <Input className="mt-1" aria-label="Extra payment" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />
          <span className="mt-1 block">Typed. On top of the regular payment.</span>
        </label>
      </div>
      <p className="text-xs text-muted">{DISCLAIMER}</p>
      <LoanTable balance={Number(balance) || 0} apr={Number(apr) || 0} years={Number(years) || 1} extra={Number(extra) || 0} nerd={nerd} />
    </section>
  );
}

function InflationTool() {
  const facts = usePlannerFacts();
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  const started = useRef(false);
  const [amount, setAmount] = useState("");
  const [years, setYears] = useState("10");
  const [rate, setRate] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (facts.typicalSpendMonthly.value != null) setAmount(String(Math.round(facts.typicalSpendMonthly.value * 12)));
    else if (facts.cashSavings.value != null) setAmount(String(Math.round(facts.cashSavings.value)));
    setRate(String(Math.round((facts.inflation.value ?? 0.02) * 1000) / 10));
  }, [facts]);
  const result = inflated(Number(amount) || 0, Number(years) || 0, Number(rate) || 0);
  const yearCount = Math.max(0, Math.round(Number(years) || 0));
  const pile = Number(amount) || 0;
  const inflation = Number(rate) || 0;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">What money buys later</h2>
      <p className="text-sm">
        {formatMoney(pile)} of today’s spending buys about {formatMoney(result.buyingPower)} in {yearCount} years if prices rise {inflation} percent. {assumptionLines(["inflation"])[0]}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard label="Prices if they rise" value={formatMoney(result.later)} sentence={`What ${formatMoney(pile)} of today’s goods might cost in ${yearCount} years.`} />
        <SummaryCard label="Buying power" value={formatMoney(result.buyingPower)} sentence="What today’s pile would be worth in today’s prices, if it just sat there." />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Amount today
          <Input className="mt-1" aria-label="Amount today" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="mt-1 block">{facts.typicalSpendMonthly.value != null ? "From your spending, a typical year." : facts.cashSavings.source}</span>
        </label>
        <label className="text-xs text-muted">
          Years
          <Input className="mt-1" aria-label="Inflation years" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
          <span className="mt-1 block">Typed.</span>
        </label>
        <label className="text-xs text-muted">
          Inflation %
          <Input className="mt-1" aria-label="Inflation percent" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          <span className="mt-1 block">{facts.inflation.note}</span>
        </label>
      </div>
      <AdvancedDepth
        show={nerd}
        metrics={[
          { label: "Amount today", value: formatMoney(pile) },
          { label: "Years", value: String(yearCount) },
          { label: "Inflation", value: `${inflation}%` },
          { label: "Later price", value: formatMoney(result.later) },
          { label: "Buying power", value: formatMoney(result.buyingPower) },
          { label: "Lost to prices", value: formatMoney(Math.max(0, pile - result.buyingPower)) },
        ]}
        columns={["Year", "Buying power"]}
        rows={Array.from({ length: Math.min(yearCount, 30) }, (_, index) => [String(index + 1), formatMoney(inflated(pile, index + 1, inflation).buyingPower)])}
        assumptions={assumptionLines(["inflation"])}
        sensitivity={[
          { label: "Inflation 2 points lower", value: formatMoney(inflated(pile, yearCount, Math.max(0, inflation - 2)).buyingPower) },
          { label: "Inflation as entered", value: formatMoney(result.buyingPower) },
          { label: "Inflation 2 points higher", value: formatMoney(inflated(pile, yearCount, inflation + 2).buyingPower) },
        ]}
      />
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
  const facts = usePlannerFacts();
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  const started = useRef(false);
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pile = facts.saved.value ?? facts.cashSavings.value;
    if (pile != null) setAmount(String(Math.round(pile)));
    setRate(String(Math.round(facts.returns.expected * 1000) / 10));
  }, [facts]);
  const years = yearsToDouble(Number(rate) || 0);
  const pile = Number(amount) || 0;
  const doubled = years == null ? 0 : pile * 2;
  const lower = yearsToDouble((Number(rate) || 0) - 2);
  const higher = yearsToDouble((Number(rate) || 0) + 2);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">How long to double</h2>
      <p className="text-sm">
        {years == null ? "The rate has to be above zero." : `${formatMoney(pile)} becomes about ${formatMoney(doubled)} in about ${years} years. An estimate, not a promise.`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard label="Now" value={formatMoney(pile)} sentence={facts.saved.value != null ? "From your accounts." : facts.cashSavings.source} />
        <SummaryCard label="Doubled" value={formatMoney(doubled)} sentence={years == null ? "Need a rate above zero." : `About ${years} years.`} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Amount
          <Input className="mt-1" aria-label="Amount to double" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="mt-1 block">{facts.saved.value != null ? `${facts.saved.source}. ${facts.saved.note}` : `${facts.cashSavings.source}. ${facts.cashSavings.note}`}</span>
        </label>
        <label className="text-xs text-muted">
          Yearly rate %
          <Input className="mt-1" aria-label="Double rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          <span className="mt-1 block">{facts.returns.note}</span>
        </label>
      </div>
      <AdvancedDepth
        show={nerd}
        metrics={[
          { label: "Years", value: years == null ? "—" : String(years) },
          { label: "Amount", value: formatMoney(pile) },
          { label: "Doubled", value: formatMoney(doubled) },
          { label: "Rate", value: `${rate || 0}%` },
          { label: "Rule of 72", value: Number(rate) > 0 ? `${Math.round(72 / Number(rate))} years` : "—" },
          { label: "Source", value: facts.saved.value != null ? "Accounts" : "Typed or savings" },
        ]}
        columns={["Rate", "Years"]}
        rows={[
          ["2 points lower", lower == null ? "—" : String(lower)],
          ["As entered", years == null ? "—" : String(years)],
          ["2 points higher", higher == null ? "—" : String(higher)],
        ]}
        assumptions={[facts.returns.note, ...assumptionLines(["market-expected"])]}
        sensitivity={[
          { label: "Return 2 points lower", value: lower == null ? "—" : `${lower} years` },
          { label: "Return as entered", value: years == null ? "—" : `${years} years` },
          { label: "Return 2 points higher", value: higher == null ? "—" : `${higher} years` },
        ]}
      />
      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </section>
  );
}

function ReachTool({ principal, setPrincipal }: { principal: string; setPrincipal: (v: string) => void }) {
  const facts = usePlannerFacts();
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  const started = useRef(false);
  const [monthly, setMonthly] = useState("");
  const [rate, setRate] = useState("");
  const [target, setTarget] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (facts.monthlySaving.value != null) setMonthly(String(Math.round(facts.monthlySaving.value)));
    setRate(String(Math.round(facts.returns.expected * 1000) / 10));
    if (facts.incomeWantedYearly.value != null) setTarget(String(Math.round(facts.incomeWantedYearly.value)));
    else if (facts.typicalSpendMonthly.value != null) setTarget(String(Math.round(facts.typicalSpendMonthly.value * 12)));
  }, [facts]);
  const months = monthsToTarget({
    principal: Number(principal) || 0,
    monthly: Number(monthly) || 0,
    apr: Number(rate) || 0,
    target: Number(target) || 0,
  });
  const rateN = (Number(rate) || 0) / 100;
  const add = Number(monthly) || 0;
  const goal = Number(target) || 0;
  const start = Number(principal) || 0;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">How long to reach a number</h2>
      <p className="text-sm">
        {months == null ? "Not within 50 years at these numbers." : months === 0 ? "You are already there." : `${spanLabel(months)} to reach ${formatMoney(goal)}.`}
      </p>
      <div className="font-display text-3xl tabular">{months == null ? "Not within 50 years" : months === 0 ? "You are already there" : spanLabel(months)}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Already saved
          <Input className="mt-1" aria-label="Already saved for the target" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          <span className="mt-1 block">From a fund left over, or retirement and investment accounts.</span>
        </label>
        <label className="text-xs text-muted">
          Add each month
          <Input className="mt-1" aria-label="Monthly add toward the target" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          <span className="mt-1 block">{facts.monthlySaving.source}. {facts.monthlySaving.note}</span>
        </label>
        <label className="text-xs text-muted">
          Yearly rate %
          <Input className="mt-1" aria-label="Reach rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          <span className="mt-1 block">{facts.returns.note}</span>
        </label>
        <label className="text-xs text-muted">
          Target
          <Input className="mt-1" aria-label="Target amount" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          <span className="mt-1 block">{facts.incomeWantedYearly.value != null ? `${facts.incomeWantedYearly.source}. A year of the income you want.` : "Typed."}</span>
        </label>
      </div>
      <AdvancedDepth
        show={nerd}
        metrics={[
          { label: "Months", value: months == null ? "—" : String(months) },
          { label: "Already saved", value: formatMoney(start) },
          { label: "Each month", value: formatMoney(add) },
          { label: "Rate", value: `${rate || 0}%` },
          { label: "Target", value: formatMoney(goal) },
          { label: "Still to go", value: formatMoney(Math.max(0, goal - start)) },
        ]}
        columns={["Change", "Months"]}
        rows={sensitivityOf(
          (next, monthlyAdd) => monthsToTarget({ principal: start, monthly: monthlyAdd, apr: next * 100, target: goal }) ?? 0,
          rateN,
          add,
        ).map((row) => [row.label, String(row.value)])}
        assumptions={[facts.monthlySaving.note, facts.returns.note, ...assumptionLines(["market-expected"])]}
        sensitivity={sensitivityOf(
          (next, monthlyAdd) => monthsToTarget({ principal: start, monthly: monthlyAdd, apr: next * 100, target: goal }) ?? 0,
          rateN,
          add,
        ).map((row) => ({ label: row.label, value: `${row.value} months` }))}
      />
      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </section>
  );
}

function WorthFromAccounts() {
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  const series = netWorthSeries(accounts, balances);
  const latest = series.at(-1);
  if (!latest) return <p className="text-sm text-muted">No account balances yet. A typed snapshot is the only number until you add one.</p>;
  const kinds = Object.entries(latest.byKind);
  return (
    <div className="space-y-2">
      <p className="text-sm">Accounts total {formatMoney(latest.total)} as of {latest.date}. From your accounts. {series.length === 1 ? "One snapshot, so this is not a trend." : `${series.length} dates.`}</p>
      <ul className="text-sm">
        {kinds.map(([kind, amount]) => (
          <li key={kind}>{kind}: {formatMoney(amount ?? 0)}</li>
        ))}
      </ul>
      <AdvancedDepth
        show={nerd}
        metrics={[
          { label: "Total", value: formatMoney(latest.total) },
          { label: "Dates", value: String(series.length) },
          { label: "Accounts", value: String(accounts.length) },
          { label: "Checking", value: formatMoney(latest.byKind.checking ?? 0) },
          { label: "Savings", value: formatMoney(latest.byKind.savings ?? 0) },
          { label: "Retirement", value: formatMoney((latest.byKind.retirement ?? 0) + (latest.byKind.investment ?? 0)) },
        ]}
        columns={["Date", "Total"]}
        rows={series.map((point) => [point.date, formatMoney(point.total)])}
        assumptions={["Each account keeps its latest balance on or before that date. A card you owe lowers the total."]}
      />
    </div>
  );
}

function DebtWorkings({ debts, extra }: { debts: { id: string; balance: number; apr: number; minimum: number; name: string }[]; extra: number }) {
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  if (!debts.length) return null;
  const line = debtTimeline(debts, extra);
  const plan = payoffPlan(debts, extra, "avalanche");
  const minimums = payoffPlan(debts, 0, "avalanche");
  return (
    <AdvancedDepth
      show={nerd}
      metrics={[
        { label: "Payoff", value: plan.unfinished ? "50+ years" : `${plan.months} months` },
        { label: "Interest", value: formatMoney(plan.interest) },
        { label: "Minimums only", value: minimums.unfinished ? "50+ years" : `${minimums.months} months` },
        { label: "Interest on minimums", value: formatMoney(minimums.interest) },
        { label: "Extra", value: formatMoney(extra) },
        { label: "Debts", value: String(debts.length) },
      ]}
      columns={["Month", "Minimums left", "With extra"]}
      rows={line.withExtra.filter((row, index) => index % 6 === 0 || index === line.withExtra.length - 1).map((row) => {
        const min = line.minimums.find((item) => item.month === row.month);
        return [String(row.month), formatMoney(min?.remaining ?? 0), formatMoney(row.remaining)];
      })}
      assumptions={["Highest interest is paid first. The month count is from now, not a date from the bank."]}
      sensitivity={[
        { label: "Extra $100 less", value: `${payoffPlan(debts, Math.max(0, extra - 100), "avalanche").months} months` },
        { label: "Extra as entered", value: `${plan.months} months` },
        { label: "Extra $100 more", value: `${payoffPlan(debts, extra + 100, "avalanche").months} months` },
      ]}
    />
  );
}

function LoanTable({ balance, apr, years, extra, nerd }: { balance: number; apr: number; years: number; extra: number; nerd: boolean }) {
  const rows = amortizationSchedule({ balance, aprPercent: apr, years, extra });
  const interest = rows.reduce((sum, row) => sum + row.interest, 0);
  const principalPaid = rows.reduce((sum, row) => sum + row.principal, 0);
  return (
    <AdvancedDepth
      show={nerd}
      metrics={[
        { label: "Months in the table", value: String(rows.length) },
        { label: "Interest", value: formatMoney(interest) },
        { label: "Principal", value: formatMoney(principalPaid) },
        { label: "Balance", value: formatMoney(balance) },
        { label: "Rate", value: `${apr}%` },
        { label: "Extra", value: formatMoney(extra) },
      ]}
      columns={["Month", "Interest", "Principal", "Left"]}
      rows={rows.filter((row) => row.month % 6 === 0 || row.month === rows.length).slice(0, 40).map((row) => [String(row.month), formatMoney(row.interest), formatMoney(row.principal), formatMoney(row.balance)])}
      assumptions={["The regular payment matches the loan calculator. Extra is added on top. Interest versus principal is the split of each payment."]}
      sensitivity={[
        { label: "Rate 2 points lower", value: formatMoney(loanCompare({ balance, apr: apr - 2, years, extra }).interest) },
        { label: "Rate as entered", value: formatMoney(loanCompare({ balance, apr, years, extra: 0 }).interest) },
        { label: "Rate 2 points higher", value: formatMoney(loanCompare({ balance, apr: apr + 2, years, extra }).interest) },
        { label: "Extra $100 less", value: `${loanCompare({ balance, apr, years, extra: Math.max(0, extra - 100) }).extraMonths} months` },
        { label: "Extra $100 more", value: `${loanCompare({ balance, apr, years, extra: extra + 100 }).extraMonths} months` },
      ]}
    />
  );
}



