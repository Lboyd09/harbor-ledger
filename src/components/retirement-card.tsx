import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { factNote, readNumber } from "@/lib/budget/calc-input";
import { formatMoney } from "@/lib/budget/money";
import { moneyPicture } from "@/lib/budget/picture";
import { figureLine, FIGURES } from "@/lib/budget/reference";
import { projectRetirement, retirementInputFrom, retirementMonteCarlo, retirementSensitivity } from "@/lib/budget/retirement";
import { useBudgetStore } from "@/store/budget-store";
import { useLivelyMotion } from "./use-lively-motion";
import { usePlannerFacts } from "./use-planner-facts";
import { ProgressRing } from "./visuals/progress-ring";
import { Input } from "./ui/field";

function money(value: string) {
  return formatMoney(Math.max(0, readNumber(value) ?? 0));
}

export function RetirementCard() {
  const facts = usePlannerFacts();
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const debts = useBudgetStore((s) => s.debts ?? []);
  const invested = moneyPicture({ accounts, balances, debts });
  const investedSplit = `Retirement ${formatMoney(invested.retirement)} + Brokerage ${formatMoney(invested.brokerage)}.`;
  const nerd = useBudgetStore((s) => s.profile.detail === "nerd");
  const lively = useLivelyMotion();
  const [touched, setTouched] = useState(false);
  const [age, setAge] = useState("");
  const [retire, setRetire] = useState("67");
  const [saved, setSaved] = useState("");
  const [monthly, setMonthly] = useState("");
  const [match, setMatch] = useState("0");
  const [low, setLow] = useState("4");
  const [mid, setMid] = useState("7");
  const [high, setHigh] = useState("10");
  const [inflation, setInflation] = useState("2");
  const [wanted, setWanted] = useState("");
  const [social, setSocial] = useState("");
  const [withdrawal, setWithdrawal] = useState("4");
  const [mean, setMean] = useState("7");
  const [spread, setSpread] = useState("12");
  const [numbers, setNumbers] = useState(false);

  useEffect(() => {
    if (touched) return;
    setAge(facts.age.value == null ? "" : String(facts.age.value));
    setRetire(String(facts.retireAge.value ?? 67));
    setSaved(facts.saved.value == null ? "" : String(Math.round(facts.saved.value)));
    setMonthly(facts.monthlySaving.value == null ? "" : String(Math.round(facts.monthlySaving.value)));
    setWanted(facts.incomeWantedYearly.value == null ? "" : String(Math.round(facts.incomeWantedYearly.value)));
    setInflation(String(Math.round((facts.inflation.value ?? 0.02) * 1000) / 10));
    setWithdrawal(String(Math.round((facts.withdrawal.value ?? 0.04) * 1000) / 10));
    setLow(String(Math.round(facts.returns.conservative * 1000) / 10));
    setMid(String(Math.round(facts.returns.expected * 1000) / 10));
    setHigh(String(Math.round(facts.returns.optimistic * 1000) / 10));
    setMean(String(Math.round(facts.returns.expected * 1000) / 10));
  }, [facts, touched]);

  function edit<T>(set: (value: T) => void, value: T) {
    setTouched(true);
    set(value);
  }

  // A blank box is "not entered", never 0. Without an age there is no estimate at all.
  const read = useMemo(
    () =>
      retirementInputFrom({
        age,
        retireAge: retire,
        saved,
        monthlySaving: monthly,
        employerMatchPercent: match,
        low,
        mid,
        high,
        inflation,
        incomeWantedYearly: wanted,
        socialSecurityMonthly: social,
        withdrawal,
      }),
    [age, retire, saved, monthly, match, low, mid, high, inflation, wanted, social, withdrawal],
  );
  const input = read.ok ? read.input : null;
  const result = input ? projectRetirement(input) : null;
  const expected = result ? result.paths[1] : null;
  const chart =
    result && expected
      ? expected.points.map((point) => ({
          age: point.age,
          Low: result.paths[0].points.find((row) => row.age === point.age)?.real ?? null,
          Likely: point.real,
          High: result.paths[2].points.find((row) => row.age === point.age)?.real ?? null,
        }))
      : [];
  const sense = nerd && input ? retirementSensitivity(input) : [];
  const meanN = readNumber(mean);
  const spreadN = readNumber(spread);
  const monte = useMemo(() => {
    if (!nerd || !input || meanN == null || spreadN == null) return null;
    return retirementMonteCarlo(input, { mean: meanN / 100, spread: spreadN / 100, seed: 20261004, runs: 1000 });
  }, [nerd, input, meanN, spreadN]);
  const wantedKnown = Boolean(input && input.incomeWantedYearly > 0);

  const assumptions = ["inflation", "withdrawal", "market-conservative", "market-expected", "market-optimistic", "ss-full"].map((id) => {
    const figure = FIGURES.find((row) => row.id === id);
    return figure ? figureLine(figure) : id;
  });

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Will I be able to retire?</h2>
      {result ? (
        <>
          <p className="text-sm">{result.sentence}</p>
          {wantedKnown ? (
            <ProgressRing
              pct={Math.max(0, Math.min(100, result.coveredPercent))}
              tone={result.coveredPercent >= 100 ? "good" : "primary"}
              label={`${result.coveredPercent} percent of the income you want`}
            />
          ) : null}
          <div className="chart-rise h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
                <Tooltip formatter={(value) => formatMoney(Number(Array.isArray(value) ? value[0] : value))} />
                <ReferenceLine x={result.retireAge} stroke="var(--color-warn)" label={{ value: "Retire", fontSize: 11, fill: "var(--color-muted)" }} />
                <Line type="monotone" dataKey="Low" stroke="var(--color-muted)" dot={false} isAnimationActive={lively} />
                <Line type="monotone" dataKey="Likely" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={lively} />
                <Line type="monotone" dataKey="High" stroke="var(--color-good)" dot={false} isAnimationActive={lively} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {wantedKnown ? (
            <p className="text-sm">
              {result.gapYearly <= 0
                ? "The likely path covers what you want."
                : `The gap is ${formatMoney(result.gapYearly)} a year.`}
              {result.extraPerMonth != null && result.extraPerMonth > 0 ? ` Save ${formatMoney(result.extraPerMonth)} more each month` : ""}
              {result.extraYears != null && result.extraYears > 0 ? `${result.extraPerMonth ? ", or" : ""} work about ${result.extraYears.toFixed(1)} more years` : ""}
              {result.gapYearly > 0 ? "." : ""}
            </p>
          ) : (
            <p className="text-sm text-muted">Enter the yearly income you want to see how much of it this covers.</p>
          )}
        </>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm" role="status">
          {read.ok ? null : read.message}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Age
          <Input className="mt-1" inputMode="numeric" aria-label="Age" value={age} onChange={(e) => edit(setAge, e.target.value)} />
          <span className="mt-1 block">{factNote(facts.age)}</span>
        </label>
        <label className="text-xs text-muted">
          Retire at
          <Input className="mt-1" inputMode="numeric" aria-label="Retire at" value={retire} onChange={(e) => edit(setRetire, e.target.value)} />
          <span className="mt-1 block">{factNote(facts.retireAge)}</span>
        </label>
        <label className="text-xs text-muted">
          Invested so far (retirement + brokerage)
          <Input className="mt-1" inputMode="decimal" aria-label="Invested so far" value={saved} onChange={(e) => edit(setSaved, e.target.value)} />
          <span className="mt-1 block">{factNote(facts.saved)} {investedSplit}</span>
        </label>
        <label className="text-xs text-muted">
          Saving each month
          <Input className="mt-1" inputMode="decimal" aria-label="Saving each month" value={monthly} onChange={(e) => edit(setMonthly, e.target.value)} />
          <span className="mt-1 block">{factNote(facts.monthlySaving)}</span>
        </label>
        <label className="text-xs text-muted">
          Employer match, percent of what you save
          <Input className="mt-1" inputMode="decimal" aria-label="Employer match percent" value={match} onChange={(e) => edit(setMatch, e.target.value)} />
          <span className="mt-1 block">50 means the employer adds half of your monthly saving, not half of your pay.</span>
        </label>
        <label className="text-xs text-muted">
          Income wanted each year, today's dollars
          <Input className="mt-1" inputMode="decimal" aria-label="Income wanted" value={wanted} onChange={(e) => edit(setWanted, e.target.value)} />
          <span className="mt-1 block">{factNote(facts.incomeWantedYearly)}</span>
        </label>
        <label className="text-xs text-muted">
          Social Security each month
          <Input className="mt-1" inputMode="decimal" aria-label="Social Security monthly" value={social} onChange={(e) => edit(setSocial, e.target.value)} placeholder="Blank counts as zero" />
          <span className="mt-1 block">Blank counts as zero.</span>
        </label>
        <label className="text-xs text-muted">
          Expected return %
          <Input className="mt-1" inputMode="decimal" aria-label="Expected return" value={mid} onChange={(e) => edit(setMid, e.target.value)} />
          <span className="mt-1 block">{factNote(facts.returns)}</span>
        </label>
        <label className="text-xs text-muted">
          Low return %
          <Input className="mt-1" inputMode="decimal" aria-label="Low return" value={low} onChange={(e) => edit(setLow, e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          High return %
          <Input className="mt-1" inputMode="decimal" aria-label="High return" value={high} onChange={(e) => edit(setHigh, e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Inflation %
          <Input className="mt-1" inputMode="decimal" aria-label="Inflation" value={inflation} onChange={(e) => edit(setInflation, e.target.value)} />
          <span className="mt-1 block">{factNote(facts.inflation)}</span>
        </label>
        <label className="text-xs text-muted">
          Withdrawal %
          <Input className="mt-1" inputMode="decimal" aria-label="Withdrawal rate" value={withdrawal} onChange={(e) => edit(setWithdrawal, e.target.value)} />
          <span className="mt-1 block">{factNote(facts.withdrawal)}</span>
        </label>
      </div>
      <p className="text-xs text-muted">Full Social Security age of 67 is for a birth year of 1960 or later. An earlier birth year has a lower full age. {money(saved)} saved is what the chart starts from.</p>
      {expected ? (
        <button type="button" className="min-h-11 text-sm font-medium text-primary" onClick={() => setNumbers((open) => !open)}>
          {numbers ? "Hide the numbers" : "Show as numbers"}
        </button>
      ) : null}
      {numbers && expected ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {["Age", "Put in", "Growth", "Balance", "Today's dollars"].map((col) => (
                  <th key={col} className="px-2 py-1 font-medium">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expected.points.map((point) => (
                <tr key={point.age} className="border-t border-border">
                  <td className="px-2 py-1">{point.age}</td>
                  <td className="px-2 py-1 tabular">{formatMoney(point.contributed)}</td>
                  <td className="px-2 py-1 tabular">{formatMoney(point.growth)}</td>
                  <td className="px-2 py-1 tabular">{formatMoney(point.balance)}</td>
                  <td className="px-2 py-1 tabular">{formatMoney(point.real)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <ul className="space-y-1 text-xs text-muted">
        {assumptions.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {nerd ? (
        <div className="space-y-3">
          {sense.length ? (
            <>
              <h3 className="text-sm font-medium">If a number moves</h3>
              <ul className="space-y-1 text-xs text-muted">
                {sense.map((row) => (
                  <li key={row.label}>
                    {row.label}: {formatMoney(row.real)}, {row.coveredPercent} percent covered
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h3 className="text-sm font-medium">A thousand tries</h3>
          <p className="text-xs text-muted">
            Each year draws a return around {mean || 0}% with a spread of {spread || 0} points. Same seed, same result. After the retire age, spending rises with inflation. This is not a promise.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Average return %
              <Input className="mt-1" inputMode="decimal" aria-label="Monte Carlo average return" value={mean} onChange={(e) => edit(setMean, e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              Spread, points
              <Input className="mt-1" inputMode="decimal" aria-label="Monte Carlo spread" value={spread} onChange={(e) => edit(setSpread, e.target.value)} />
            </label>
          </div>
          {monte ? (
            <>
              <p className="text-sm">About {Math.round(monte.chanceLasts * 100)} percent of the tries still have money at 95.</p>
              <div className="chart-rise h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monte.points}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="age" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
                    <Tooltip formatter={(value) => formatMoney(Number(Array.isArray(value) ? value[0] : value))} />
                    <Line type="monotone" dataKey="p10" name="Low 10%" stroke="var(--color-muted)" dot={false} isAnimationActive={lively} />
                    <Line type="monotone" dataKey="p50" name="Middle" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={lively} />
                    <Line type="monotone" dataKey="p90" name="High 10%" stroke="var(--color-good)" dot={false} isAnimationActive={lively} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-muted">Estimates only, not financial advice.</p>
    </section>
  );
}
