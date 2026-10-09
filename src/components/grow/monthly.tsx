import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { needsPrompt } from "@/lib/budget/calc-input";
import { sensitivityOf, yearRows } from "@/lib/budget/grow-tables";
import { formatMoney } from "@/lib/budget/money";
import { Input } from "../ui/field";
import { SharedRates } from "./editors";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { tagOf } from "./source-tag";
import { useGrow } from "./grow-context";

export function MonthlyPage() {
  const g = useGrow();
  const end = g.both.at(-1);
  const missing = needsPrompt(
    [
      { label: "how much you add each month (0 is fine)", value: g.monthlyIn, min: 0 },
      { label: "how many years", value: g.yearsIn, min: 0 },
      { label: "the yearly rate", value: g.rateIn },
      ...(g.today ? [{ label: "inflation", value: g.inflationIn }] : []),
    ],
    "the ending balance",
  );
  const rows = yearRows({ principal: g.principalN, monthly: g.monthlyN, years: g.yearCount, rate: g.market, inflation: g.inflationRate, today: g.today });
  return (
    <CalcFrame
      question="What if you add money every month?"
      result={`${formatMoney(end?.contributed ?? 0)} is money you put in. The ending balance is ${formatMoney(end?.balance ?? 0)}.`}
      missing={missing}
      topic="monthly"
      facts={g.tipFacts}
      assumptionIds={["market-expected", "inflation"]}
      extraAssumptions={[g.facts.monthlySaving.note]}
      assumptionEditor={<SharedRates />}
      numbers={
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Starting amount" tag={g.principalN > 0 ? "from your accounts" : "typed"}>
            <Input className="mt-1" inputMode="decimal" aria-label="Starting amount" value={g.principal} onChange={(e) => g.setPrincipal(e.target.value)} />
          </Field>
          <Field label="Each month" tag={tagOf(g.facts.monthlySaving.source)}>
            <Input className="mt-1" inputMode="decimal" aria-label="Each month" value={g.monthly} onChange={(e) => g.setMonthly(e.target.value)} />
          </Field>
          <Field label="Years" tag="typed">
            <Input className="mt-1" inputMode="decimal" aria-label="Years" value={g.years} onChange={(e) => g.setYears(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        <div className="chart-rise h-52 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={g.both}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
              <Tooltip formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))} />
              <Line type="monotone" dataKey="contributed" stroke="var(--color-muted)" dot={false} isAnimationActive={g.lively} name="Put in" />
              <Line type="monotone" dataKey="balance" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={g.lively} name="Balance" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      keyNumbers={[
        { label: "Ending balance", value: formatMoney(end?.balance ?? 0) },
        { label: "Put in", value: formatMoney(end?.contributed ?? 0) },
        { label: "Growth", value: formatMoney((end?.balance ?? 0) - (end?.contributed ?? 0)) },
        { label: "Each month", value: formatMoney(g.monthlyN) },
        { label: "Starting amount", value: formatMoney(g.principalN) },
        { label: "Years", value: String(g.yearCount) },
      ]}
      years={<YearTable columns={["Year", "Put in", "Growth", "Balance"]} rows={rows.map((row) => [String(row.year), formatMoney(row.contributed), formatMoney(row.growth), formatMoney(row.balance)])} />}
      advanced={
        g.nerd ? (
          <Sensitivity
            rows={sensitivityOf(
              (next, add) => yearRows({ principal: g.principalN, monthly: add, years: g.yearCount, rate: next, inflation: g.inflationRate, today: g.today }).at(-1)?.balance ?? 0,
              g.market,
              g.monthlyN,
            ).map((row) => ({ label: row.label, value: formatMoney(row.value) }))}
          />
        ) : null
      }
    />
  );
}
