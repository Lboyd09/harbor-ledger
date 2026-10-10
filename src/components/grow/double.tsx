import { useEffect, useRef, useState } from "react";
import { needsPrompt, optionalAmount, readNumber } from "@/lib/budget/calc-input";
import { monthsToTarget, yearsToDouble } from "@/lib/budget/grow-math";
import { formatMoney } from "@/lib/budget/money";
import { dropSameWhatIfs, investingReadiness } from "@/lib/budget/phase4";
import { debtsInNetWorth } from "@/lib/budget/real-debts";
import { useBudgetStore } from "@/store/budget-store";
import { Input } from "../ui/field";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { tagOf } from "./source-tag";
import { useGrow } from "./grow-context";

function spanLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} month${rest === 1 ? "" : "s"}`;
  if (rest === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} and ${rest} month${rest === 1 ? "" : "s"}`;
}

function reachLabel(months: number | null, hasTarget: boolean) {
  if (!hasTarget) return "Add a target";
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
  const rateN = readNumber(rate) ?? 0;
  const years = yearsToDouble(rateN);
  const pile = optionalAmount(amount).amount;
  const savedN = optionalAmount(saved).amount;
  const monthlyN = optionalAmount(monthly).amount;
  const doubled = years == null ? 0 : pile * 2;
  const months = hasTarget
    ? monthsToTarget({ principal: savedN, monthly: monthlyN, apr: rateN, target: targetIn ?? 0 })
    : null;
  const reach = reachLabel(months, hasTarget);
  const accountPile = g.facts.cashSavings.value ?? g.facts.saved.value;
  const accountRounded = accountPile == null ? null : Math.round(accountPile);
  const amountTag = accountRounded != null && readNumber(amount) === accountRounded ? "from your accounts" : undefined;
  const savedTag = accountRounded != null && readNumber(saved) === accountRounded ? "from your accounts" : undefined;
  const monthlyTag =
    g.facts.monthlySaving.value != null && readNumber(monthly) === Math.round(g.facts.monthlySaving.value)
      ? tagOf(g.facts.monthlySaving.source)
      : undefined;
  function reachAt(apr: number, add: number) {
    if (!hasTarget) return "Add a target";
    return reachLabel(monthsToTarget({ principal: savedN, monthly: add, apr, target: targetIn ?? 0 }), true);
  }
  const liveDebts = debtsInNetWorth(g.debts, g.accounts, g.balances);
  const highDebt = liveDebts.filter((debt) => debt.balance > 0 && debt.apr > 8).sort((a, b) => b.apr - a.apr)[0];
  const ready = investingReadiness({
    monthsSaved: g.picture.cushionMonths ?? 0,
    highAprDebt: highDebt ? { name: highDebt.name, apr: highDebt.apr } : null,
  });
  return (
    <div className="space-y-3">
    {ready.step === "ready" ? null : <p className="text-sm">{ready.sentence}</p>}
    <CalcFrame
      question="How long to double, or to reach a number?"
      headline={years == null || missing ? undefined : { value: `${years} yrs`, sub: hasTarget ? `Target in ${reach}` : "Add a target." }}
      result={years == null ? "The rate has to be above zero." : hasTarget ? `Doubles in ${years} yrs · target in ${reach}` : `Doubles in ${years} yrs. Add a target.`}
      missing={missing}
      topic="double"
      facts={g.tipFacts}
      assumptionIds={["market-expected"]}
      extraAssumptions={["Compounded yearly.", g.facts.returns.note]}
      numbers={
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Amount" tag={amountTag}>
            <Input className="mt-1" aria-label="Amount to double" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Yearly rate %">
            <Input className="mt-1" aria-label="Double rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Field label="Already saved" tag={savedTag}>
            <Input className="mt-1" aria-label="Already saved for the target" inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} />
          </Field>
          <Field label="Add each month" tag={monthlyTag}>
            <Input className="mt-1" aria-label="Monthly add toward the target" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </Field>
          <Field label="Target">
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
            ["2 points lower", yearsToDouble(rateN - 2) == null ? "—" : String(yearsToDouble(rateN - 2))],
            ["As entered", years == null ? "—" : String(years)],
            ["2 points higher", yearsToDouble(rateN + 2) == null ? "—" : String(yearsToDouble(rateN + 2))],
          ]}
        />
      }
      advanced={
        g.nerd && hasTarget ? (
          <Sensitivity
            rows={dropSameWhatIfs([
              { label: "Return 2 points lower", value: reachAt(rateN - 2, monthlyN) },
              { label: "Return as entered", value: reach },
              { label: "Return 2 points higher", value: reachAt(rateN + 2, monthlyN) },
              { label: "Monthly $100 less", value: reachAt(rateN, Math.max(0, monthlyN - 100)) },
              { label: "Monthly $100 more", value: reachAt(rateN, monthlyN + 100) },
            ])}
          />
        ) : null
      }
    />
    </div>
  );
}
