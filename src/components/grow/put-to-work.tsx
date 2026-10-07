import { needsPrompt } from "@/lib/budget/calc-input";
import { sensitivityOf, yearRows } from "@/lib/budget/grow-tables";
import { formatMoney } from "@/lib/budget/money";
import { GrowthArea, PlaceMap } from "../grow-pictures";
import { Input } from "../ui/field";
import { SharedRates } from "./editors";
import { CalcFrame, Field, Sensitivity, YearTable, tagOf } from "./frame";
import { useGrow } from "./session";

export function PutToWork() {
  const g = useGrow();
  const rows = yearRows({ principal: g.principalN, monthly: 0, years: g.yearCount, rate: g.market, inflation: g.inflationRate, today: g.today });
  const missing = needsPrompt(
    [
      { label: "an amount", value: g.principalIn, above: 0 },
      { label: "how many years", value: g.yearsIn, min: 0 },
      { label: "the yearly rate", value: g.rateIn },
      { label: "the tax rate now (0 is fine)", value: g.taxNowIn, min: 0 },
      { label: "the tax rate later (0 is fine)", value: g.taxLaterIn, min: 0 },
      ...(g.today ? [{ label: "inflation", value: g.inflationIn }] : []),
    ],
    "what it could grow to",
  );
  const amountTag = g.facts.saved.value != null && Number(g.principal) === Math.round(g.facts.saved.value) ? tagOf(g.facts.saved.source) : g.principalN > 0 ? "from your accounts" : "typed";
  return (
    <CalcFrame
        question="What if this amount is left alone?"
        result={`Savings about ${formatMoney(g.savings.expected)}. Taxable about ${formatMoney(g.taxable.expected)}. Roth about ${formatMoney(g.rothLump.expected)}. Traditional about ${formatMoney(g.traditionalLump.expected)}.`}
        missing={missing}
        topic="work"
        facts={g.tipFacts}
        assumptionIds={["savings-expected", "market-expected", "inflation"]}
        assumptionEditor={<SharedRates />}
        numbers={
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Amount" tag={amountTag}>
              <Input className="mt-1" inputMode="decimal" aria-label="Amount" value={g.principal} onChange={(e) => g.setPrincipal(e.target.value)} />
            </Field>
            <Field label="Years" tag="typed">
              <Input className="mt-1" inputMode="decimal" aria-label="Years" value={g.years} onChange={(e) => g.setYears(e.target.value)} />
            </Field>
            <Field label="Tax now %" tag="typed">
              <Input className="mt-1" inputMode="decimal" aria-label="Tax now" value={g.taxNow} onChange={(e) => g.setTaxNow(e.target.value)} />
            </Field>
            <Field label="Tax later %" tag="typed">
              <Input className="mt-1" inputMode="decimal" aria-label="Tax later" value={g.taxLater} onChange={(e) => g.setTaxLater(e.target.value)} />
            </Field>
          </div>
        }
        picture={
          <div className="space-y-3">
            <PlaceMap />
            <GrowthArea principal={g.principalN} years={g.yearCount} inflation={g.inflationRate} today={g.today} gainTax={g.taxNowN} lively={g.lively} />
          </div>
        }
        keyNumbers={[
          { label: "Savings, likely", value: formatMoney(g.savings.expected) },
          { label: "Taxable, likely", value: formatMoney(g.taxable.expected) },
          { label: "Roth, likely", value: formatMoney(g.rothLump.expected) },
          { label: "Traditional, likely", value: formatMoney(g.traditionalLump.expected) },
          { label: "Starting amount", value: formatMoney(g.principalN) },
          { label: "Years", value: String(g.yearCount) },
        ]}
        years={<YearTable columns={["Year", "Put in", "Balance"]} rows={rows.map((row) => [String(row.year), formatMoney(row.contributed), formatMoney(row.balance)])} />}
        advanced={
          g.nerd ? (
            <Sensitivity
              rows={sensitivityOf(
                (next) => yearRows({ principal: g.principalN, monthly: 0, years: g.yearCount, rate: next, inflation: g.inflationRate, today: g.today }).at(-1)?.balance ?? 0,
                g.market,
                0,
              ).map((row) => ({ label: row.label, value: formatMoney(row.value) }))}
            />
          ) : null
        }
      />
  );
}
