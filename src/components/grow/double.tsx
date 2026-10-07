import { useEffect, useRef, useState } from "react";
import { needsPrompt, readNumber } from "@/lib/budget/calc-input";
import { monthsToTarget, yearsToDouble } from "@/lib/budget/grow-math";
import { formatMoney } from "@/lib/budget/money";
import { useBudgetStore } from "@/store/budget-store";
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

function reachLabel(months: number | null, hasTarget: boolean) {
  if (!hasTarget) return "Enter a target";
  if (months == null) return "Not within 50 years";
  if (months === 0) return "Already there";
  return spanLabel(months);
}

export function DoublePage() {
  const g = useGrow();
  const funds = useBudgetStore((s) => s.moneyBuckets);
  const started = useRef(false);
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [monthly, setMonthly] = useState("");
  const [saved, setSaved] = useState("");
  const [target, setTarget] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pile = g.facts.cashSavings.value ?? g.facts.saved.value;
    if (pile != null) {
      setAmount(String(Math.round(pile)));
      setSaved(String(Math.round(pile)));
    }
    setRate(String(Math.round(g.facts.returns.expected * 1000) / 10));
    if (g.facts.monthlySaving.value != null) setMonthly(String(Math.round(g.facts.monthlySaving.value)));
    const goal = (funds ?? []).find((fund) => (fund.target ?? 0) > 0);
    if (goal?.target) setTarget(String(Math.round(goal.target)));
  }, [g.facts, funds]);
  const missing = needsPrompt([{ label: "a yearly rate", value: readNumber(rate) }], "how long it takes");
  const targetIn = readNumber(target);
  const hasTarget = targetIn != null && targetIn > 0;
  const years = yearsToDouble(Number(rate) || 0);
  const pile = Number(amount) || 0;
  const savedN = Math.max(0, Number(saved) || 0);
  const doubled = years == null ? 0 : pile * 2;
  const months = hasTarget
    ? monthsToTarget({ principal: savedN, monthly: Number(monthly) || 0, apr: Number(rate) || 0, target: targetIn ?? 0 })
    : null;
  const reach = reachLabel(months, hasTarget);
  const reachSentence = hasTarget ? ` Reaching the target takes ${reach}.` : " Enter a target to see how long reaching it takes.";
  const amountTag = g.facts.cashSavings.value != null || g.facts.saved.value != null ? "from your accounts" : "typed";
  const goal = (funds ?? []).find((fund) => (fund.target ?? 0) > 0);
  function reachAt(apr: number, add: number) {
    if (!hasTarget) return "Enter a target";
    return reachLabel(monthsToTarget({ principal: savedN, monthly: add, apr, target: targetIn ?? 0 }), true);
  }
  return (
    <CalcFrame
      question="How long to double, or to reach a number?"
      result={years == null ? "The rate has to be above zero." : `${readNumber(amount) == null ? "Money" : formatMoney(pile)} doubles in about ${years} years.${reachSentence}`}
      missing={missing}
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
          <Field label="Already saved" tag={savedN > 0 ? amountTag : "typed"}>
            <Input className="mt-1" aria-label="Already saved for the target" inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} />
          </Field>
          <Field label="Add each month" tag={tagOf(g.facts.monthlySaving.source)}>
            <Input className="mt-1" aria-label="Monthly add toward the target" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </Field>
          <Field label="Target" tag={goal ? "from a savings goal" : "typed"}>
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
        { label: "Months to target", value: !hasTarget || months == null ? "—" : String(months) },
        { label: "Still to go", value: formatMoney(Math.max(0, (targetIn ?? 0) - savedN)) },
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
        g.nerd && hasTarget ? (
          <Sensitivity
            rows={[
              { label: "Return 2 points lower", value: reachAt((Number(rate) || 0) - 2, Number(monthly) || 0) },
              { label: "Return as entered", value: reach },
              { label: "Return 2 points higher", value: reachAt((Number(rate) || 0) + 2, Number(monthly) || 0) },
              { label: "Monthly $100 less", value: reachAt(Number(rate) || 0, Math.max(0, (Number(monthly) || 0) - 100)) },
              { label: "Monthly $100 more", value: reachAt(Number(rate) || 0, (Number(monthly) || 0) + 100) },
            ]}
          />
        ) : null
      }
    />
  );
}
