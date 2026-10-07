import { fiNumbers, sensitivityOf } from "@/lib/budget/grow-tables";
import { formatMoney } from "@/lib/budget/money";
import { ProgressRing } from "../visuals/progress-ring";
import { CalcFrame, Sensitivity, YearTable } from "./frame";
import { useGrow } from "./session";

export function WorkOptionalPage() {
  const g = useGrow();
  const yearly = g.facts.typicalSpendMonthly.value != null ? g.facts.typicalSpendMonthly.value * 12 : g.book.activeMonths > 0 ? (g.book.expenses / g.book.activeMonths) * 12 : 0;
  const rate = g.facts.savingsRate != null ? Math.max(0, g.facts.savingsRate) : Math.max(0, g.book.savingsRate);
  const withdrawal = g.facts.withdrawal.value ?? 0.04;
  // A typed 0% inflation stays 0%, and a real return of 0 stays 0. Only a blank box falls back.
  const inflation = g.inflationIn != null ? Math.max(0, g.inflationIn / 100) : (g.facts.inflation.value ?? 0.02);
  const real = Math.max(0, (g.facts.returns.expected ?? 0.05) - inflation);
  const yearsLeft = g.facts.age.value != null && g.facts.retireAge.value != null ? Math.max(0, g.facts.retireAge.value - g.facts.age.value) : null;
  const fi = fiNumbers({ yearlySpend: yearly, withdrawal, savingsRate: rate, realReturn: real, yearsLeft });
  const saved = g.facts.saved.value ?? 0;
  const result = yearly > 0
    ? `Work is optional around ${formatMoney(fi.fi ?? 0)}, in ${fi.years == null ? "an unknown number of" : fi.years} years.`
    : "Import spending for a few months before this is useful.";
  return (
    <CalcFrame
      question="When could work be optional?"
      result={result}
      topic="free"
      facts={g.tipFacts}
      assumptionIds={["withdrawal", "market-expected", "inflation"]}
      numbers={
        <p className="text-sm text-muted">
          Spending {g.facts.typicalSpendMonthly.value != null ? "from your spending" : "from this year"}. Savings rate {Math.round(rate * 100)} percent.
        </p>
      }
      picture={
        <ProgressRing
          pct={fi.fi ? Math.min(100, (saved / fi.fi) * 100) : 0}
          tone="primary"
          label={fi.fi ? `${Math.round(Math.min(100, (saved / fi.fi) * 100))} percent of the number` : "Need spending first"}
        />
      }
      keyNumbers={[
        { label: "Years", value: fi.years == null ? "—" : String(fi.years) },
        { label: "The number", value: fi.fi == null ? "—" : formatMoney(fi.fi) },
        { label: "Coast", value: fi.coast == null ? "—" : formatMoney(fi.coast) },
        { label: "Yearly spending", value: formatMoney(yearly) },
        { label: "Savings rate", value: `${Math.round(rate * 100)}%` },
        { label: "Withdrawal", value: `${Math.round(withdrawal * 1000) / 10}%` },
      ]}
      years={
        <YearTable
          columns={["Piece", "Amount"]}
          rows={[
            ["Yearly spending", formatMoney(yearly)],
            ["The number", fi.fi == null ? "—" : formatMoney(fi.fi)],
            ["Coast", fi.coast == null ? "—" : formatMoney(fi.coast)],
            ["Years to the retire age", yearsLeft == null ? "Age not entered" : String(yearsLeft)],
          ]}
        />
      }
      advanced={
        g.nerd ? (
          <Sensitivity
            rows={sensitivityOf(
              (next) => fiNumbers({ yearlySpend: yearly, withdrawal, savingsRate: rate, realReturn: Math.max(0, next), yearsLeft }).years ?? 0,
              real,
              0,
            ).map((row) => ({ label: row.label, value: `${row.value} years` }))}
          />
        ) : null
      }
    />
  );
}
