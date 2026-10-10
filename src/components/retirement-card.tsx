import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Footnote } from "@/components/footnote";
import { InfoTip } from "@/components/info-tip";
import { factNote, readNumber } from "@/lib/budget/calc-input";
import { axisMoney, formatCompact, formatMoney } from "@/lib/budget/money";
import { coverageLabel, extraMonthlyForNextTenth, futuresHeadline, monteCarloInTodaysDollars, retirementChartCap } from "@/lib/budget/retirement";
import { moneyPicture } from "@/lib/budget/picture";
import { assumptionLines } from "@/lib/budget/reference";
import { projectRetirement, retirementInputFrom, retirementMonteCarlo, retirementSensitivity, type SensitivityRow } from "@/lib/budget/retirement";
import { tipsFor } from "@/lib/budget/tips";
import { useBudgetStore } from "@/store/budget-store";
import { Citations } from "./grow/frame";
import { useGrow } from "./grow/grow-context";
import { useLivelyMotion } from "./use-lively-motion";
import { usePlannerFacts } from "./use-planner-facts";
import { ProgressRing } from "./visuals/progress-ring";
import { Input } from "./ui/field";

const AXIS = { fontSize: 11, fill: "var(--color-muted)" };
const ASSUMPTIONS = ["withdrawal", "inflation", "market-conservative", "market-expected", "market-optimistic", "ss-full"];

function coverLabel(percent: number) {
  return percent > 150 ? "More than enough" : `${percent}%`;
}

function senseLabel(label: string) {
  return label
    .replace("Return 2 points lower", "Return −2 pts")
    .replace("Return 2 points higher", "Return +2 pts")
    .replace("Saving $100 less", "Save −$100")
    .replace("Saving $100 more", "Save +$100")
    .replace("Retire 3 years sooner", "Retire −3 yrs")
    .replace("Retire 3 years later", "Retire +3 yrs");
}

function senseLine(row: SensitivityRow) {
  const covered = row.coveredPercent > 150 ? "More than enough" : `${row.coveredPercent}%`;
  return `${senseLabel(row.label)}: ${formatCompact(row.real)} (${covered})`;
}

function noteOf(fact: { note: string; source: string }, extra?: string) {
  const text = [factNote(fact), extra].filter((part) => part && part.trim()).join(" ");
  return text.trim() || undefined;
}

function Labeled({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="text-xs text-muted">
      <span className="flex items-center">
        {label}
        {note ? <InfoTip label={label} text={note} /> : null}
      </span>
      {children}
    </div>
  );
}

export function RetirementCard() {
  const { tipFacts } = useGrow();
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
  const patchProfile = useBudgetStore((s) => s.patchProfile);
  const savedMatch = useBudgetStore((s) => s.profile.employerMatchPercent);
  const savedGoal = useBudgetStore((s) => s.profile.retirementSavingGoal);
  const [match, setMatch] = useState(savedMatch == null ? "" : String(savedMatch));
  const [goal, setGoal] = useState(savedGoal == null ? "" : String(savedGoal));
  const [low, setLow] = useState("4");
  const [mid, setMid] = useState("7");
  const [high, setHigh] = useState("10");
  const [inflation, setInflation] = useState("2");
  const [wanted, setWanted] = useState("");
  const [social, setSocial] = useState("");
  const [withdrawal, setWithdrawal] = useState("4");
  const [mean, setMean] = useState("7");
  const [spread, setSpread] = useState("12");

  useEffect(() => {
    if (touched) return;
    setAge(facts.age.value == null ? "" : String(facts.age.value));
    setRetire(String(facts.retireAge.value ?? 67));
    setSaved(facts.saved.value == null ? "" : String(Math.round(facts.saved.value)));
    setMonthly(facts.monthlySaving.value == null ? "" : String(Math.round(facts.monthlySaving.value)));
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
    if (!input || meanN == null || spreadN == null) return null;
    const raw = retirementMonteCarlo(input, { mean: meanN / 100, spread: spreadN / 100, seed: 20261004, runs: 200 });
    return { ...raw, points: monteCarloInTodaysDollars(raw.points, input.inflation, input.age) };
  }, [input, meanN, spreadN]);
  const extraTenth = useMemo(() => {
    if (!input || meanN == null || spreadN == null) return null;
    return extraMonthlyForNextTenth(input, { mean: meanN / 100, spread: spreadN / 100, seed: 20261004, runs: 30 });
  }, [input, meanN, spreadN]);
  const wantedKnown = Boolean(input && input.incomeWantedYearly > 0);
  const tips = tipsFor("retirement", {
    ...tipFacts,
    employerMatch: readNumber(match),
    monthlySaving: readNumber(monthly),
    retirementGoal: readNumber(goal),
  });
  const firstTip = tips[0];
  const moreTips = tips.slice(1);
  const lines = assumptionLines(ASSUMPTIONS);

  let gapLine = "";
  if (result && wantedKnown) {
    if (result.gapYearly <= 0) gapLine = "On track";
    else {
      const save = result.extraPerMonth != null && result.extraPerMonth > 0 ? ` · save +${formatMoney(result.extraPerMonth)}/mo` : "";
      const years = result.extraYears != null && result.extraYears > 0 ? ` or work ${result.extraYears.toFixed(1)} yrs more` : "";
      gapLine = `Gap ${formatMoney(result.gapYearly)}/yr${save}${years}`;
    }
  } else if (result) {
    gapLine = "Add the yearly income you want.";
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold">Can I retire?</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Labeled label="Age" note={noteOf(facts.age)}>
          <Input className="mt-1" inputMode="numeric" aria-label="Age" value={age} onChange={(e) => edit(setAge, e.target.value)} />
        </Labeled>
        <Labeled label="Retire at" note={noteOf(facts.retireAge)}>
          <Input className="mt-1" inputMode="numeric" aria-label="Retire at" value={retire} onChange={(e) => edit(setRetire, e.target.value)} />
        </Labeled>
        <Labeled label="Invested so far" note={noteOf(facts.saved, investedSplit)}>
          <Input className="mt-1" inputMode="decimal" aria-label="Invested so far" value={saved} onChange={(e) => edit(setSaved, e.target.value)} />
        </Labeled>
        <Labeled label="Saving each month" note={noteOf(facts.monthlySaving)}>
          <Input className="mt-1" inputMode="decimal" aria-label="Saving each month" value={monthly} onChange={(e) => edit(setMonthly, e.target.value)} />
        </Labeled>
        <Labeled label="Employer match %">
          <Input className="mt-1" inputMode="decimal" aria-label="Employer match percent" placeholder="50 = half of what you save" value={match} onChange={(e) => edit(setMatch, e.target.value)} onBlur={() => patchProfile({ employerMatchPercent: readNumber(match) })} />
        </Labeled>
        <Labeled label="Saving goal each month">
          <Input className="mt-1" inputMode="decimal" aria-label="Retirement saving goal" value={goal} onChange={(e) => edit(setGoal, e.target.value)} onBlur={() => patchProfile({ retirementSavingGoal: readNumber(goal) })} />
        </Labeled>
        <Labeled label="Income wanted each year" note={noteOf(facts.incomeWantedYearly)}>
          <Input className="mt-1" inputMode="decimal" aria-label="Income wanted" value={wanted} onChange={(e) => edit(setWanted, e.target.value)} />
          {wanted.trim() === "" && facts.incomeWantedYearly.value != null ? (
            <button type="button" className="mt-1 text-left text-sm text-primary" onClick={() => edit(setWanted, String(Math.round(facts.incomeWantedYearly.value ?? 0)))}>
              Use 80% of your plan: {formatMoney(facts.incomeWantedYearly.value)}/yr
            </button>
          ) : null}
        </Labeled>
        <Labeled label="Social Security each month">
          <Input className="mt-1" inputMode="decimal" aria-label="Social Security monthly" placeholder="0 if none" value={social} onChange={(e) => edit(setSocial, e.target.value)} />
        </Labeled>
        <Labeled label="Expected return %" note={noteOf(facts.returns)}>
          <Input className="mt-1" inputMode="decimal" aria-label="Expected return" value={mid} onChange={(e) => edit(setMid, e.target.value)} />
        </Labeled>
        {nerd ? (
          <>
            <Labeled label="Low return %">
              <Input className="mt-1" inputMode="decimal" aria-label="Low return" value={low} onChange={(e) => edit(setLow, e.target.value)} />
            </Labeled>
            <Labeled label="High return %">
              <Input className="mt-1" inputMode="decimal" aria-label="High return" value={high} onChange={(e) => edit(setHigh, e.target.value)} />
            </Labeled>
          </>
        ) : null}
        <Labeled label="Inflation %" note={noteOf(facts.inflation)}>
          <Input className="mt-1" inputMode="decimal" aria-label="Inflation" value={inflation} onChange={(e) => edit(setInflation, e.target.value)} />
        </Labeled>
        <Labeled label="Withdrawal %" note={noteOf(facts.withdrawal)}>
          <Input className="mt-1" inputMode="decimal" aria-label="Withdrawal rate" value={withdrawal} onChange={(e) => edit(setWithdrawal, e.target.value)} />
        </Labeled>
      </div>
      {result && expected ? (
        <>
          <div>
            <p className="font-display text-3xl font-semibold tabular">
              {formatMoney(expected.real)} at {result.retireAge}
            </p>
            {monte ? <p className="text-sm">{futuresHeadline(monte.chanceLasts)} · in today's dollars</p> : <p className="text-sm">in today's dollars</p>}
            {extraTenth != null ? <p className="text-sm">Saving {formatMoney(extraTenth)} more a month makes it {Math.min(10, Math.round((monte?.chanceLasts ?? 0) * 10) + 1)} of 10</p> : null}
            {wantedKnown ? (
              <p className="text-sm text-muted">
                {result.coveredPercent > 150 ? "More than enough" : `Covers ${result.coveredPercent}% of your goal`}
              </p>
            ) : null}
          </div>
          {gapLine ? <p className="text-sm">{gapLine}</p> : null}
          {wantedKnown ? (
            <ProgressRing
              pct={Math.max(0, Math.min(100, result.coveredPercent))}
              tone={result.coveredPercent >= 100 ? "good" : "primary"}
              label={result.coveredPercent > 150 ? "More than enough" : `${coverageLabel(result.coveredPercent)} of goal`}
            />
          ) : null}
          <div className="chart-rise h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
                <YAxis tick={AXIS} width={56} domain={monte && result ? [0, retirementChartCap(monte.points.find((point) => point.age === result.retireAge)?.p90 ?? 0) || "auto"] : undefined} tickFormatter={(value) => axisMoney(Number(value))} />
                <Tooltip formatter={(value) => formatMoney(Number(Array.isArray(value) ? value[0] : value))} />
                <ReferenceLine x={result.retireAge} stroke="var(--color-warn)" label={{ value: "Retire", fontSize: 11, fill: "var(--color-muted)" }} />
                <Line type="monotone" dataKey="Low" stroke="var(--color-muted)" dot={false} isAnimationActive={lively} />
                <Line type="monotone" dataKey="Likely" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={lively} />
                <Line type="monotone" dataKey="High" stroke="var(--color-good)" dot={false} isAnimationActive={lively} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <section>
            <h3 className="text-sm font-medium">Key numbers</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "Likely", value: formatMoney(expected.real) },
                { label: "Low", value: formatMoney(result.paths[0].real) },
                { label: "High", value: formatMoney(result.paths[2].real) },
                { label: "Of goal", value: wantedKnown ? coverLabel(result.coveredPercent) : "—" },
                { label: "Gap / yr", value: wantedKnown ? formatMoney(result.gapYearly) : "—" },
                { label: "Invested", value: formatMoney(Math.max(0, readNumber(saved) ?? 0)) },
              ].map((row) => (
                <div key={row.label} className="rounded-md border border-border p-2">
                  <dt className="text-xs text-muted">{row.label}</dt>
                  <dd className="text-sm font-medium tabular">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <details className="rounded-lg border border-border bg-surface p-3">
            <summary className="min-h-11 cursor-pointer text-sm font-medium">Show the years</summary>
            <div className="mt-2 max-h-64 overflow-auto">
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
          </details>
        </>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm" role="status">
          {read.ok ? null : read.message}
        </p>
      )}
      {firstTip ? <p className="text-sm">{firstTip.text}</p> : null}
      {moreTips.length ? (
        <details className="rounded-lg border border-border bg-surface p-3">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">Tips ({tips.length})</summary>
          <ul className="mt-2 space-y-2 text-sm">
            {moreTips.map((tip) => (
              <li key={tip.id}>{tip.text}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <details className="rounded-lg border border-border bg-surface p-3">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">Assumptions</summary>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      <Citations ids={ASSUMPTIONS} />
      {nerd && result ? (
        <div className="space-y-3">
          {sense.length ? (
            <details className="rounded-lg border border-border bg-surface p-3">
              <summary className="min-h-11 cursor-pointer text-sm font-medium">If a number moves</summary>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {sense
                  .filter((row) => formatMoney(row.real) !== formatMoney(expected?.real ?? 0))
                  .filter((row, index, list) => list.findIndex((prior) => formatMoney(prior.real) === formatMoney(row.real)) === index)
                  .map((row) => (
                  <li key={row.label}>{senseLine(row)}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="flex items-center">
            <h3 className="text-sm font-medium">Good years and bad years</h3>
            <InfoTip label="About these tries" text="Random market years. Not a promise." />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Labeled label="Average return %">
              <Input className="mt-1" inputMode="decimal" aria-label="Monte Carlo average return" value={mean} onChange={(e) => edit(setMean, e.target.value)} />
            </Labeled>
            <Labeled label={`Market swings: ±${spread || 0}%`}>
              <Input className="mt-1" inputMode="decimal" aria-label="Monte Carlo spread" value={spread} onChange={(e) => edit(setSpread, e.target.value)} />
            </Labeled>
          </div>
          {monte ? (
            <>
              <p className="text-sm">In {Math.round(monte.chanceLasts * 100)} out of 100 possible futures, your money lasts to 95</p>
              <div className="chart-rise h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monte.points}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="age" tick={AXIS} />
                    <YAxis tick={AXIS} width={56} domain={monte && result ? [0, retirementChartCap(monte.points.find((point) => point.age === result.retireAge)?.p90 ?? 0) || "auto"] : undefined} tickFormatter={(value) => axisMoney(Number(value))} />
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
      <Footnote />
    </section>
  );
}
