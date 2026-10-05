import { useEffect, useRef, useState } from "react";
import { monthsToTarget, yearsToDouble } from "@/lib/budget/grow-math";
import { sensitivityOf } from "@/lib/budget/grow-tables";
import { formatMoney } from "@/lib/budget/money";
import { Input } from "../ui/field";
import { CalcFrame, Field, Sensitivity, YearTable, tagOf } from "./frame";
import { useGrow } from "./session";

function spanLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} month${rest === 1 ? "" : "s"}`;
  if (rest === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} and ${rest} month${rest === 1 ? "" : "s"}`;
}

export function DoublePage() {
  const g = useGrow();
  const started = useRef(false);
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [monthly, setMonthly] = useState("");
  const [target, setTarget] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pile = g.facts.saved.value ?? g.facts.cashSavings.value;
    if (pile != null) setAmount(String(Math.round(pile)));
    setRate(String(Math.round(g.facts.returns.expected * 1000) / 10));
    if (g.facts.monthlySaving.value != null) setMonthly(String(Math.round(g.facts.monthlySaving.value)));
    if (g.facts.incomeWantedYearly.value != null) setTarget(String(Math.round(g.facts.incomeWantedYearly.value)));
    else if (g.facts.typicalSpendMonthly.value != null) setTarget(String(Math.round(g.facts.typicalSpendMonthly.value * 12)));
  }, [g.facts]);
  const years = yearsToDouble(Number(rate) || 0);
  const pile = Number(amount) || 0;
  const doubled = years == null ? 0 : pile * 2;
  const months = monthsToTarget({ principal: g.principalN, monthly: Number(monthly) || 0, apr: Number(rate) || 0, target: Number(target) || 0 });
  const reach = months == null ? "Not within 50 years" : months === 0 ? "Already there" : spanLabel(months);
  const amountTag = g.facts.saved.value != null ? tagOf(g.facts.saved.source) : tagOf(g.facts.cashSavings.source);
  return (
    <CalcFrame
      question="How long to double, or to reach a number?"
      result={years == null ? "The rate has to be above zero." : `${formatMoney(pile)} doubles in about ${years} years. Reaching the target takes ${reach}.`}
      topic="double"
      facts={g.tipFacts}
      assumptionIds={["market-expected"]}
      extraAssumptions={[g.facts.returns.note]}
      numbers={
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Amount" tag={amountTag}>
            <Input className="mt-1" aria-label="Amount to double" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Yearly rate %" tag="typed">
            <Input className="mt-1" aria-label="Double rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Field label="Already saved" tag={g.principalN > 0 ? "from your accounts" : "typed"}>
            <Input className="mt-1" aria-label="Already saved for the target" inputMode="decimal" value={g.principal} onChange={(e) => g.setPrincipal(e.target.value)} />
          </Field>
          <Field label="Add each month" tag={tagOf(g.facts.monthlySaving.source)}>
            <Input className="mt-1" aria-label="Monthly add toward the target" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </Field>
          <Field label="Target" tag={g.facts.incomeWantedYearly.value != null ? "from your spending" : "typed"}>
            <Input className="mt-1" aria-label="Target amount" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <div className="text-sm">Doubled</div>
            <div className="font-display text-2xl tabular">{formatMoney(doubled)}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-sm">Reach the target</div>
            <div className="font-display text-2xl tabular">{reach}</div>
          </div>
        </div>
      }
      keyNumbers={[
        { label: "Years to double", value: years == null ? "—" : String(years) },
        { label: "Amount", value: formatMoney(pile) },
        { label: "Doubled", value: formatMoney(doubled) },
        { label: "Rate", value: `${rate || 0}%` },
        { label: "Months to target", value: months == null ? "—" : String(months) },
        { label: "Still to go", value: formatMoney(Math.max(0, (Number(target) || 0) - g.principalN)) },
      ]}
      years={
        <YearTable
          columns={["Change", "Years to double"]}
          rows={[
            ["2 points lower", yearsToDouble((Number(rate) || 0) - 2) == null ? "—" : String(yearsToDouble((Number(rate) || 0) - 2))],
            ["As entered", years == null ? "—" : String(years)],
            ["2 points higher", yearsToDouble((Number(rate) || 0) + 2) == null ? "—" : String(yearsToDouble((Number(rate) || 0) + 2))],
          ]}
        />
      }
      advanced={
        g.nerd ? (
          <Sensitivity
            rows={sensitivityOf(
              (next, add) => monthsToTarget({ principal: g.principalN, monthly: add, apr: next * 100, target: Number(target) || 0 }) ?? 0,
              (Number(rate) || 0) / 100,
              Number(monthly) || 0,
            ).map((row) => ({ label: row.label, value: `${row.value} months` }))}
          />
        ) : null
      }
    />
  );
}
