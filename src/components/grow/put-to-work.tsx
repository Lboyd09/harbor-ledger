import { yearRows } from "@/lib/budget/grow-tables";
import { debtFirstNote, growLump, lumpPath, lumpWhatIfs, readLump } from "@/lib/budget/lump";
import { formatMoney } from "@/lib/budget/money";
import { GrowthArea, PlaceMap } from "../grow-pictures";
import { Input } from "../ui/field";
import { SharedRates } from "./editors";
import { CalcFrame, Field, Sensitivity, YearTable, tagOf } from "./frame";
import { useGrow } from "./session";

const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;

export function PutToWork() {
  const g = useGrow();
  const read = readLump({ amount: g.principal, years: g.years, rate: g.rate, gainTax: g.gainTax, inflation: g.inflation, today: g.today });
  const input = read.ok ? read.input : null;
  const out = input ? growLump(input) : null;
  const typedAmount = Number(g.principal);
  const amountTag =
    g.facts.saved.value != null && typedAmount === Math.round(g.facts.saved.value)
      ? tagOf(g.facts.saved.source)
      : g.surplus.balance > 0 && typedAmount === Math.round(g.surplus.balance)
        ? "from your budget"
        : "typed";
  const dollars = g.today ? " in today's dollars" : "";
  let result = read.ok ? "" : read.prompt;
  if (input && out) {
    const start = formatMoney(input.amount);
    const span = `${input.years} ${input.years === 1 ? "year" : "years"}`;
    if (out.months === 0) {
      result = `With 0 years there is no time to grow, so it stays ${start}.`;
    } else {
      result = `Left alone for ${span} at ${pct(input.rate)} a year, ${start} grows to about ${formatMoney(out.shownBeforeTax)}${dollars}, before tax.`;
      if (out.taxOnGain > 0) {
        result += ` In a taxable account, after ${pct(input.gainTax)} tax on the gain, you'd keep about ${formatMoney(out.shownAfterTax)}.`;
      } else if (out.gain > 0) {
        result += " With no tax on the gain, you keep all of it.";
      }
    }
  }
  const debtNote = input ? debtFirstNote(g.debts, input.rate) : null;
  const rows = input ? yearRows({ principal: input.amount, monthly: 0, years: input.years, rate: input.rate, inflation: input.inflation, today: input.today }) : [];
  return (
    <CalcFrame
      question="What if this amount is left alone?"
      result={debtNote ? `${result} ${debtNote}` : result}
      topic="work"
      facts={g.tipFacts}
      assumptionIds={g.today ? ["inflation"] : []}
      extraAssumptions={[
        "It grows every month at the yearly rate you typed, divided by 12, the same way as Add every month. Nothing is added or taken out.",
        "Tax on the gain is taken once, when you sell at the end. Long-term gains are often taxed at 0%, 15% or 20%. Check your own rate.",
        "In a Roth or other tax-free account you would keep the before-tax amount, within the yearly limits.",
        ...(g.today ? ["Today's dollars divide by inflation for each year."] : []),
      ]}
      assumptionEditor={<SharedRates />}
      numbers={
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Amount" tag={amountTag}>
            <Input className="mt-1" inputMode="decimal" aria-label="Amount" value={g.principal} onChange={(e) => g.setPrincipal(e.target.value)} />
          </Field>
          <Field label="Years" tag="typed">
            <Input className="mt-1" inputMode="decimal" aria-label="Years" value={g.years} onChange={(e) => g.setYears(e.target.value)} />
          </Field>
          <Field label="Yearly return %" tag="typed">
            <Input className="mt-1" inputMode="decimal" aria-label="Yearly return" value={g.rate} onChange={(e) => g.setRate(e.target.value)} />
          </Field>
          <Field label="Tax on the gain %" tag="when you sell, in a taxable account">
            <Input className="mt-1" inputMode="decimal" aria-label="Tax on the gain" value={g.gainTax} onChange={(e) => g.setGainTax(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        <div className="space-y-3">
          <PlaceMap />
          {input && out && out.months > 0 ? <GrowthArea points={lumpPath(input)} rate={input.rate} today={input.today} lively={g.lively} /> : null}
        </div>
      }
      keyNumbers={
        input && out
          ? [
              { label: g.today ? "Before tax, today's dollars" : "Before tax", value: formatMoney(out.shownBeforeTax) },
              { label: g.today ? "After tax on the gain, today's dollars" : "After tax on the gain", value: formatMoney(out.shownAfterTax) },
              { label: "Growth", value: formatMoney(out.gain) },
              { label: "Tax on the gain", value: formatMoney(out.taxOnGain) },
              { label: "Starting amount", value: formatMoney(input.amount) },
              { label: "Rate a year", value: pct(input.rate) },
            ]
          : []
      }
      years={
        rows.length ? (
          <YearTable columns={["Year", "Put in", g.today ? "Before tax, today's dollars" : "Before tax"]} rows={rows.map((row) => [String(row.year), formatMoney(row.contributed), formatMoney(row.balance)])} />
        ) : null
      }
      advanced={
        g.nerd && input ? (
          <Sensitivity rows={lumpWhatIfs(input).map((row) => ({ label: row.label, value: `${formatMoney(row.beforeTax)} before tax, ${formatMoney(row.afterTax)} after tax on the gain` }))} />
        ) : null
      }
    />
  );
}
