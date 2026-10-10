import { useEffect, useRef, useState } from "react";
import { needsPrompt, readNumber } from "@/lib/budget/calc-input";
import { inflated } from "@/lib/budget/grow-math";
import { formatMoney } from "@/lib/budget/money";
import { Input } from "../ui/field";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { tagOf } from "./source-tag";
import { useGrow } from "./grow-context";

export function InflationPage() {
  const g = useGrow();
  const started = useRef(false);
  const [amount, setAmount] = useState("");
  const [years, setYears] = useState("10");
  const [rate, setRate] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (g.facts.typicalSpendMonthly.value != null) setAmount(String(Math.round(g.facts.typicalSpendMonthly.value * 12)));
    else if (g.facts.cashSavings.value != null) setAmount(String(Math.round(g.facts.cashSavings.value)));
    setRate(String(Math.round((g.facts.inflation.value ?? 0.02) * 1000) / 10));
  }, [g.facts]);
  const missing = needsPrompt(
    [
      { label: "an amount", value: readNumber(amount), above: 0 },
      { label: "how many years", value: readNumber(years), min: 0 },
      { label: "the inflation rate (0 is fine)", value: readNumber(rate) },
    ],
    "what it buys later",
  );
  const pile = readNumber(amount) ?? 0;
  const yearCount = Math.max(0, Math.round(readNumber(years) ?? 0));
  const inflation = readNumber(rate) ?? 0;
  const result = inflated(pile, yearCount, inflation);
  const source = g.facts.typicalSpendMonthly.value != null ? "from your spending" : tagOf(g.facts.cashSavings.source);
  return (
    <CalcFrame
      question="What will today's money buy later?"
      headline={missing ? undefined : { value: `${formatMoney(result.buyingPower)} of buying power`, sub: `in ${yearCount} yrs at ${inflation}%` }}
      result=""
      missing={missing}
      topic="inflation"
      facts={g.tipFacts}
      assumptionIds={["inflation"]}
      numbers={
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Amount today" tag={source}>
            <Input className="mt-1" aria-label="Amount today" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Years">
            <Input className="mt-1" aria-label="Inflation years" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
          </Field>
          <Field label="Inflation %">
            <Input className="mt-1" aria-label="Inflation percent" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <div className="text-sm">Later price</div>
            <div className="font-display text-2xl tabular">{formatMoney(result.later)}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-sm">Buying power</div>
            <div className="font-display text-2xl tabular">{formatMoney(result.buyingPower)}</div>
          </div>
        </div>
      }
      keyNumbers={[
        { label: "Amount today", value: formatMoney(pile) },
        { label: "Years", value: String(yearCount) },
        { label: "Inflation", value: `${inflation}%` },
        { label: "Later price", value: formatMoney(result.later) },
        { label: "Buying power", value: formatMoney(result.buyingPower) },
        { label: "Lost to prices", value: formatMoney(Math.max(0, pile - result.buyingPower)) },
      ]}
      years={<YearTable columns={["Year", "Buying power"]} rows={Array.from({ length: Math.min(yearCount, 30) }, (_, index) => [String(index + 1), formatMoney(inflated(pile, index + 1, inflation).buyingPower)])} />}
      advanced={
        g.nerd ? (
          <Sensitivity
            rows={[
              { label: "Inflation 2 points lower", value: formatMoney(inflated(pile, yearCount, Math.max(0, inflation - 2)).buyingPower) },
              { label: "Inflation as entered", value: formatMoney(result.buyingPower) },
              { label: "Inflation 2 points higher", value: formatMoney(inflated(pile, yearCount, inflation + 2).buyingPower) },
            ]}
          />
        ) : null
      }
    />
  );
}
