import { useState } from "react";
import { formatMoney } from "@/lib/budget/money";
import { fiPath, fiWhatIfs, planFi, readFi, savingFromRate, yearsText } from "@/lib/budget/work-optional";
import { InfoTip } from "../info-tip";
import { Input } from "../ui/field";
import { ProgressRing } from "../visuals/progress-ring";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { useGrow } from "./grow-context";

const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;
const asText = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "" : String(Math.round(n * 100) / 100));

export function WorkOptionalPage() {
  const g = useGrow();
  // Pre-filled from your data until you type. A box you clear stays blank and is asked for.
  const [spendTyped, setSpend] = useState<string | null>(null);
  const [saveTyped, setSave] = useState<string | null>(null);
  const [investedTyped, setInvested] = useState<string | null>(null);
  const [withdrawalTyped, setWithdrawal] = useState<string | null>(null);

  const spendFact = g.facts.typicalSpendMonthly.value;
  const spendThisYear = g.book.activeMonths > 0 && g.book.expenses > 0 ? g.book.expenses / g.book.activeMonths : null;
  const spendDefault = spendFact ?? spendThisYear;
  const spend = spendTyped ?? asText(spendDefault);
  const rateSeen = g.facts.savingsRate ?? (g.book.activeMonths > 0 ? g.book.savingsRate : null);
  const saveFromRate = spendDefault != null && rateSeen != null ? savingFromRate(spendDefault, Math.max(0, rateSeen)) : null;
  const saveDefault = g.facts.monthlySaving.value ?? saveFromRate;
  const save = saveTyped ?? asText(saveDefault);
  // No retirement or investment balance in your accounts shows as 0, with a tag that says so.
  const investedDefault = g.facts.saved.value ?? 0;
  const invested = investedTyped ?? asText(investedDefault);
  const withdrawal = withdrawalTyped ?? asText((g.facts.withdrawal.value ?? 0.04) * 100);

  const read = readFi({ spendMonthly: spend, saveMonthly: save, invested, rate: g.rate, inflation: g.inflation, withdrawal });
  const input = read.ok ? read.input : null;
  const plan = input ? planFi(input, { age: g.facts.age.value, retireAge: g.facts.retireAge.value }) : null;
  const retireAge = g.facts.retireAge.value;

  let result = read.ok ? "" : read.prompt;
  let headline: { value: string; sub?: string } | undefined;
  let coast: { amount: string; there: boolean; age: number } | null = null;
  let needAge = false;
  if (input && plan) {
    const yrs = plan.years == null ? null : Math.round(plan.years * 10) / 10;
    if (plan.years === 0) headline = { value: "Already there", sub: `Your number: ${formatMoney(plan.target)}` };
    else if (plan.years == null) headline = { value: "Not within 100 years.", sub: `Your number: ${formatMoney(plan.target)}` };
    else if (plan.reachAge != null) headline = { value: `Age ${plan.reachAge} (~${yrs} yrs)`, sub: `Your number: ${formatMoney(plan.target)}` };
    else headline = { value: `~${yrs} yrs`, sub: `Your number: ${formatMoney(plan.target)}` };
    result = "";
    if (plan.coast != null && retireAge != null && plan.years !== 0) {
      coast = { amount: formatMoney(plan.coast), there: input.invested >= plan.coast, age: retireAge };
    } else if (plan.coast == null && g.facts.age.value == null) {
      needAge = true;
    }
  }
  const share = input && plan && plan.target > 0 ? Math.min(100, (input.invested / plan.target) * 100) : 0;
  const path = input ? fiPath(input) : [];

  return (
    <CalcFrame
      question="When could work be optional?"
      headline={headline}
      result={result}
      topic="free"
      facts={g.tipFacts}
      assumptionIds={["withdrawal", "inflation"]}
      extraAssumptions={[
        "Deposits at the end of each year.",
        "The number is your yearly spending divided by the withdrawal rate. At 4% that is 25 times a year of spending.",
        "Real growth = (1+return)÷(1+inflation)−1.",
        "Each year your money grows, then a year of saving is added. Everything is in today's dollars.",
        "Spending and saving come from your history until you type over them.",
      ]}
      assumptionEditor={
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <Field label="Return %">
            <Input className="mt-1" inputMode="decimal" aria-label="Yearly rate" value={g.rate} onChange={(e) => g.setRate(e.target.value)} />
          </Field>
          <Field label="Inflation %">
            <Input className="mt-1" inputMode="decimal" aria-label="Inflation percent" value={g.inflation} onChange={(e) => g.setInflation(e.target.value)} />
          </Field>
          <Field label="Withdrawal %">
            <Input className="mt-1" inputMode="decimal" aria-label="Withdrawal rate" value={withdrawal} onChange={(e) => setWithdrawal(e.target.value)} />
          </Field>
        </div>
      }
      numbers={
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Spending a month">
            <Input className="mt-1" inputMode="decimal" aria-label="Spending a month" value={spend} onChange={(e) => setSpend(e.target.value)} />
          </Field>
          <Field label="Saving a month">
            <Input className="mt-1" inputMode="decimal" aria-label="Saving a month" value={save} onChange={(e) => setSave(e.target.value)} />
          </Field>
          <Field label="Already invested" tag={investedTyped == null && g.facts.saved.value != null ? "from your accounts" : undefined}>
            <Input className="mt-1" inputMode="decimal" aria-label="Already invested" placeholder="0" value={invested} onChange={(e) => setInvested(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        input && plan ? (
          <div className="space-y-2">
            <ProgressRing pct={share} tone="primary" label={`${Math.round(share)}% of the number`} />
            {coast ? (
              <p className="flex items-center text-sm">
                Coast number {coast.amount}
                {coast.there ? " · Already there" : ""}
                <InfoTip label="What is the coast number?" text={`Invested now, this grows to your number by age ${coast.age} if you stop saving.`} />
              </p>
            ) : null}
            {needAge ? <p className="text-sm">Add your age to see your coast number.</p> : null}
          </div>
        ) : null
      }
      keyNumbers={
        input && plan
          ? [
              { label: "Years", value: plan.years == null ? "Not within 100" : yearsText(plan.years) },
              { label: "The number", value: formatMoney(plan.target) },
              { label: "Already invested", value: formatMoney(input.invested) },
              { label: "Saving a month", value: formatMoney(input.yearlySave / 12) },
              { label: "Growth after inflation", value: pct(plan.real) },
              { label: "Withdrawal", value: pct(input.withdrawal) },
              ...(plan.coast != null ? [{ label: "Coast number", value: formatMoney(plan.coast) }] : []),
            ]
          : []
      }
      years={
        path.length > 1 ? (
          <YearTable
            columns={["Year", "Invested, today's dollars", "Reached?"]}
            rows={path.map((row) => [String(row.year), formatMoney(row.balance), row.reached ? "Yes" : ""])}
          />
        ) : null
      }
      advanced={
        g.nerd && input ? (
          <Sensitivity rows={fiWhatIfs(input).map((row) => ({ label: row.label, value: row.years == null ? "Not within 100 years" : yearsText(row.years) }))} />
        ) : null
      }
    />
  );
}
