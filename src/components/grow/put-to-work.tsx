import { yearRows } from "@/lib/budget/grow-tables";
import { debtFirstNote, growLump, lumpPath, lumpWhatIfs, readLump } from "@/lib/budget/lump";
import { formatMoney } from "@/lib/budget/money";
import { cashAboveCushion, dropSameWhatIfs, investingReadiness } from "@/lib/budget/phase4";
import { planTotal } from "@/lib/budget/plans";
import { debtsInNetWorth } from "@/lib/budget/real-debts";
import { InfoTip } from "../info-tip";
import { GrowthArea, PlaceMap } from "../grow-pictures";
import { Input } from "../ui/field";
import { SharedRates } from "./editors";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { tagOf } from "./source-tag";
import { useGrow } from "./grow-context";

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
  let result = read.ok ? "" : read.prompt;
  let headline: { value: string; sub?: string } | undefined;
  if (input && out) {
    const start = formatMoney(input.amount);
    if (out.months === 0) {
      result = `0 years: stays ${start}.`;
    } else {
      headline = {
        value: `${formatMoney(out.shownBeforeTax)} in ${input.years} yrs`,
        sub: out.taxOnGain > 0 ? `${formatMoney(out.shownAfterTax)} after tax` : "Before tax",
      };
      result = "";
    }
  }
  const debtNote = input ? debtFirstNote(debtsInNetWorth(g.debts, g.accounts, g.balances), input.rate) : null;
  const liveDebts = debtsInNetWorth(g.debts, g.accounts, g.balances);
  const highDebt = liveDebts.filter((debt) => debt.balance > 0 && debt.apr > 8).sort((a, b) => b.apr - a.apr)[0];
  const ready = investingReadiness({
    monthsSaved: g.picture.cushionMonths ?? 0,
    highAprDebt: highDebt ? { name: highDebt.name, apr: highDebt.apr } : null,
    employerMatchShort: false,
  });
  const spare = cashAboveCushion(g.picture.cash, planTotal(g.categories));
  const spareTag = spare != null && Number(g.principal) === spare;
  const rows = input ? yearRows({ principal: input.amount, monthly: 0, years: input.years, rate: input.rate, inflation: input.inflation, today: input.today }) : [];
  return (
    <CalcFrame
      question="What if this amount is left alone?"
      headline={headline}
      result={result}
      topic="work"
      facts={g.tipFacts}
      assumptionIds={g.today ? ["inflation"] : []}
      extraAssumptions={[
        "Deposits at the end of each month.",
        "Grows monthly at rate ÷ 12.",
        "Tax on the gain is taken once, when you sell at the end. Long-term gains are often taxed at 0%, 15% or 20%. Check your own rate.",
        "In a Roth or other tax-free account you would keep the before-tax amount, within the yearly limits.",
        ...(g.today ? ["Today's dollars divide by inflation for each year."] : []),
      ]}
      assumptionEditor={<SharedRates />}
      numbers={
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Amount" tag={spareTag ? "from your accounts" : amountTag}>
            <Input className="mt-1" inputMode="decimal" aria-label="Amount" value={g.principal} onChange={(e) => g.setPrincipal(e.target.value)} />
            {spare != null && g.principal.trim() === "" ? (
              <button type="button" className="mt-1 text-sm text-primary" onClick={() => g.setPrincipal(String(spare))}>
                Use {formatMoney(spare)} (cash above a 3-month cushion)
              </button>
            ) : null}
          </Field>
          <Field label="Years">
            <Input className="mt-1" inputMode="decimal" aria-label="Years" value={g.years} onChange={(e) => g.setYears(e.target.value)} />
          </Field>
          <Field label="Yearly return %">
            <Input className="mt-1" inputMode="decimal" aria-label="Yearly return" value={g.rate} onChange={(e) => g.setRate(e.target.value)} />
          </Field>
          <Field label="Tax on the gain %, taxable account">
            <Input className="mt-1" inputMode="decimal" aria-label="Tax on the gain" value={g.gainTax} onChange={(e) => g.setGainTax(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        <div className="space-y-3">
          {ready.step === "ready" ? null : <p className="text-sm">{ready.sentence}</p>}
          {debtNote ? (
            <p className="flex items-center text-sm">
              High-rate debt first
              <InfoTip label="Why debt comes first" text={debtNote} />
            </p>
          ) : null}
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
          <Sensitivity rows={dropSameWhatIfs(lumpWhatIfs(input).map((row) => ({ label: row.label, value: `${formatMoney(row.beforeTax)} before tax, ${formatMoney(row.afterTax)} after tax on the gain` })))} />
        ) : null
      }
    />
  );
}
