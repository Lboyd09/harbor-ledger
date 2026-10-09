import { useState } from "react";
import { formatMoney } from "@/lib/budget/money";
import { fiPath, fiWhatIfs, planFi, readFi, savingFromRate, yearsText } from "@/lib/budget/work-optional";
import { Input } from "../ui/field";
import { ProgressRing } from "../visuals/progress-ring";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { useGrow } from "./session";

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

  const tagFor = (typedValue: string | null, auto: string, source: string) => (typedValue == null && auto !== "" ? source : "typed");
  const read = readFi({ spendMonthly: spend, saveMonthly: save, invested, rate: g.rate, inflation: g.inflation, withdrawal });
  const input = read.ok ? read.input : null;
  const plan = input ? planFi(input, { age: g.facts.age.value, retireAge: g.facts.retireAge.value }) : null;
  const retireAge = g.facts.retireAge.value;

  let result = read.ok ? "" : read.prompt;
  let coastLine = "";
  if (input && plan) {
    const multiple = Math.round(10 / input.withdrawal) / 10;
    const numberPart = `Work becomes optional at about ${formatMoney(plan.target)}, which is ${multiple}× your ${formatMoney(input.yearlySpend)} yearly spending.`;
    const growth = `growing ${pct(plan.real)} a year after inflation`;
    if (plan.years === 0) {
      result = `${numberPart} The ${formatMoney(input.invested)} you have invested already covers it.`;
    } else if (plan.years == null) {
      result = `${numberPart} Saving ${formatMoney(input.yearlySave / 12)} a month and ${growth}, you don't get there within 100 years. Saving more or spending less brings it closer.`;
    } else {
      const start = input.invested > 0 ? `Starting from the ${formatMoney(input.invested)} you have and saving` : "Starting from $0 and saving";
      const age = plan.reachAge != null ? ` (around age ${plan.reachAge})` : "";
      result = `${numberPart} ${start} ${formatMoney(input.yearlySave / 12)} a month, ${growth}, that's about ${yearsText(plan.years)}${age}.`;
    }
    if (plan.coast != null && retireAge != null && plan.years !== 0) {
      const where = input.invested >= plan.coast
        ? `You have ${formatMoney(input.invested)}, so you're already past it.`
        : `You have ${formatMoney(input.invested)}, so keep saving to get there.`;
      coastLine = `Coast number: ${formatMoney(plan.coast)}. If you stopped saving today, that much invested now would grow to the number by age ${retireAge} on its own. ${where}`;
    } else if (plan.coast == null && g.facts.age.value == null) {
      coastLine = "Add your age in Account to see the coast number: what you'd need invested now to stop saving and still get there by your retire age.";
    }
  }
  const share = input && plan && plan.target > 0 ? Math.min(100, (input.invested / plan.target) * 100) : 0;
  const path = input ? fiPath(input) : [];

  return (
    <CalcFrame
      question="When could work be optional?"
      result={result}
      topic="free"
      facts={g.tipFacts}
      assumptionIds={["withdrawal", "inflation"]}
      extraAssumptions={[
        "The number is your yearly spending divided by the withdrawal rate. At 4% that is 25 times a year of spending.",
        "Growth after inflation is (1 + return) ÷ (1 + inflation) − 1, so 7% with 2.5% inflation is 4.39%. It can be 0 or below; nothing is swapped in.",
        "Each year your money grows, then a year of saving is added. Everything is in today's dollars.",
        "Spending and saving come from your history until you type over them.",
      ]}
      assumptionEditor={
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <Field label="Return %" tag="before inflation, shared with other pages">
            <Input className="mt-1" inputMode="decimal" aria-label="Yearly rate" value={g.rate} onChange={(e) => g.setRate(e.target.value)} />
          </Field>
          <Field label="Inflation %" tag="shared with other pages">
            <Input className="mt-1" inputMode="decimal" aria-label="Inflation percent" value={g.inflation} onChange={(e) => g.setInflation(e.target.value)} />
          </Field>
          <Field label="Withdrawal %" tag={tagFor(withdrawalTyped, "x", g.facts.withdrawal.source === "typed" ? "from Account" : "a common starting point")}>
            <Input className="mt-1" inputMode="decimal" aria-label="Withdrawal rate" value={withdrawal} onChange={(e) => setWithdrawal(e.target.value)} />
          </Field>
        </div>
      }
      numbers={
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Spending a month" tag={tagFor(spendTyped, asText(spendDefault), spendFact != null ? "from your spending" : "from this year")}>
            <Input className="mt-1" inputMode="decimal" aria-label="Spending a month" value={spend} onChange={(e) => setSpend(e.target.value)} />
          </Field>
          <Field label="Saving a month" tag={tagFor(saveTyped, asText(saveDefault), saveFromRate != null ? "from your savings rate" : "from your income")}>
            <Input className="mt-1" inputMode="decimal" aria-label="Saving a month" value={save} onChange={(e) => setSave(e.target.value)} />
          </Field>
          <Field label="Already invested" tag={tagFor(investedTyped, asText(investedDefault), g.facts.saved.value != null ? "from your accounts" : "no investment balance in your accounts")}>
            <Input className="mt-1" inputMode="decimal" aria-label="Already invested" value={invested} onChange={(e) => setInvested(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        input && plan ? (
          <div className="space-y-2">
            <ProgressRing pct={share} tone="primary" label={`${Math.round(share)} percent of the number`} />
            {coastLine ? <p className="text-sm">{coastLine}</p> : null}
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
