import { needsPrompt, readNumber } from "@/lib/budget/calc-input";
import { iraLimitCheck, rothVerdict, rothVsTraditional, rothWhatIfs } from "@/lib/budget/grow-math";
import { reducedRothLimit } from "@/lib/budget/ira";
import { formatMoney } from "@/lib/budget/money";
import { InfoTip } from "../info-tip";
import { RothBars } from "../grow-pictures";
import { Input } from "../ui/field";
import { IraEditors, SharedRates } from "./editors";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { useGrow } from "./grow-context";

const METHOD_NOTE =
  "Both use the same pre-tax pay each year. Roth puts in what's left after today's tax and is tax-free later. Traditional puts in all of it and is taxed when you take it out. Deposits go in at the end of each year.";

export function RothPage() {
  const g = useGrow();
  const missing = needsPrompt(
    [
      { label: "the pre-tax amount each year", value: g.annualIn, above: 0 },
      { label: "how many years", value: g.yearsIn, above: 0 },
      { label: "the yearly rate", value: g.rateIn },
      { label: "the tax rate now (0 is fine)", value: g.taxNowIn, min: 0 },
      { label: "the tax rate later (0 is fine)", value: g.taxLaterIn, min: 0 },
      ...(g.today ? [{ label: "inflation", value: g.inflationIn }] : []),
    ],
    "which one leaves more",
  );
  const input = {
    annual: g.annualN,
    years: g.yearCount,
    rate: g.market,
    taxNow: g.taxNowN,
    taxLater: g.taxLaterN,
    inflation: g.inflationRate,
    today: g.today,
  };
  const allowed = reducedRothLimit(g.ira, Math.max(0, readNumber(g.magi) ?? 0), g.joint, g.limit);
  const rothCheck = iraLimitCheck(g.annualN, g.taxNowN, allowed);
  const tradCheck = iraLimitCheck(g.annualN, g.taxNowN, g.limit);
  const verdict = rothVerdict(g.compare, g.taxNowN, g.taxLaterN);
  const ahead = g.compare.roth - g.compare.traditional;
  const shortResult =
    Math.abs(ahead) < 1 ? "About the same after tax." : ahead > 0 ? `Roth leaves ${formatMoney(ahead)} more.` : `Traditional leaves ${formatMoney(-ahead)} more.`;
  const limitLine = (name: string, amount: number, over: number) =>
    `${name}: ${formatMoney(amount)} a year goes in, ${over > 0 ? `${formatMoney(over)} over the limit` : "within the limit"}.`;
  const rows = Array.from({ length: Math.min(Math.floor(g.yearCount), 30) }, (_, index) => {
    const year = index + 1;
    const at = rothVsTraditional({ ...input, years: year });
    return [String(year), formatMoney(at.rothContributed), formatMoney(at.roth), formatMoney(at.traditionalContributed), formatMoney(at.traditional)];
  });
  return (
    <CalcFrame
      question="Roth or traditional, after tax?"
      headline={
        missing
          ? undefined
          : {
              value: formatMoney(Math.max(g.compare.roth, g.compare.traditional)),
              sub: g.compare.roth === g.compare.traditional ? "Same either way" : g.compare.roth > g.compare.traditional ? "Roth, after tax" : "Traditional, after tax",
            }
      }
      result={shortResult}
      missing={missing}
      topic="roth"
      facts={g.tipFacts}
      assumptionIds={["ira-under-50", "ira-catch-up", "roth-single-start", "roth-single-end", "market-expected", "inflation"]}
      extraAssumptions={["Deposits at the end of each year.", METHOD_NOTE]}
      assumptionEditor={
        <>
          <SharedRates />
          <IraEditors />
        </>
      }
      numbers={
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Pre-tax amount each year">
            <Input className="mt-1" inputMode="decimal" aria-label="Yearly amount" value={g.annual} onChange={(e) => g.setAnnual(e.target.value)} />
          </Field>
          <Field label="Years">
            <Input className="mt-1" inputMode="decimal" aria-label="Years" value={g.years} onChange={(e) => g.setYears(e.target.value)} />
          </Field>
          <Field label="Tax now %">
            <Input className="mt-1" inputMode="decimal" aria-label="Tax now" value={g.taxNow} onChange={(e) => g.setTaxNow(e.target.value)} />
          </Field>
          <Field label="Tax later %">
            <Input className="mt-1" inputMode="decimal" aria-label="Tax later" value={g.taxLater} onChange={(e) => g.setTaxLater(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        <div className="space-y-3">
          <InfoTip label="Why this result" text={verdict} />
          <RothBars roth={g.compare.roth} traditional={g.compare.traditional} taxNow={g.taxNow} taxLater={g.taxLater} />
          <div className="space-y-1 text-sm" aria-label="Yearly limit">
            <p className="font-medium">
              {g.room === "none" ? "Over the Roth income limit" : `You can put in up to ${formatMoney(allowed)} this year`}
            </p>
            {g.room === "full" ? <p className="text-muted">Full Roth allowed</p> : null}
            {g.room === "partial" ? <p className="text-muted">Partial Roth only</p> : null}
            <p>{limitLine("Roth", rothCheck.rothIn, rothCheck.rothOver)}</p>
            <p>{limitLine("Traditional", tradCheck.traditionalIn, tradCheck.traditionalOver)}</p>
          </div>
        </div>
      }
      keyNumbers={[
        { label: "Roth, after tax", value: formatMoney(g.compare.roth) },
        { label: "Traditional, after tax", value: formatMoney(g.compare.traditional) },
        { label: "Roth, you put in", value: formatMoney(g.compare.rothContributed) },
        { label: "Traditional, you put in", value: formatMoney(g.compare.traditionalContributed) },
        { label: "You can put in", value: `Up to ${formatMoney(g.limit)} a year` },
        { label: "Roth at your income", value: g.room === "none" ? "Over the limit" : `Up to ${formatMoney(allowed)}` },
      ]}
      years={<YearTable columns={["Year", "Roth put in", "Roth value", "Traditional put in", "Traditional after tax"]} rows={rows} />}
      advanced={
        g.nerd ? (
          <Sensitivity
            rows={rothWhatIfs(input).map((row) => ({
              label: row.label,
              value: `Roth ${formatMoney(row.roth)}, traditional ${formatMoney(row.traditional)}`,
            }))}
          />
        ) : null
      }
    />
  );
}
