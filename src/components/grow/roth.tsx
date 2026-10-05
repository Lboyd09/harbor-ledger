import { rothVsTraditional } from "@/lib/budget/grow-math";
import { sensitivityOf } from "@/lib/budget/grow-tables";
import { formatMoney } from "@/lib/budget/money";
import { RothBars } from "../grow-pictures";
import { ProgressRing } from "../visuals/progress-ring";
import { Input } from "../ui/field";
import { IraEditors, SharedRates } from "./editors";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { useGrow } from "./session";

export function RothPage() {
  const g = useGrow();
  const over = g.annualN > g.limit;
  const winner = g.compare.roth >= g.compare.traditional ? "Roth" : "Traditional";
  const rows = Array.from({ length: Math.min(Math.max(1, Math.round(g.yearCount)), 30) }, (_, index) => {
    const year = index + 1;
    return [
      String(year),
      formatMoney((g.compare.rothContributed / Math.max(1, g.yearCount)) * year),
      formatMoney((g.compare.traditionalContributed / Math.max(1, g.yearCount)) * year),
    ];
  });
  return (
    <CalcFrame
      question="Roth or traditional, after tax?"
      result={`${winner} leaves about ${formatMoney(Math.max(g.compare.roth, g.compare.traditional))} in this estimate.`}
      topic="roth"
      facts={g.tipFacts}
      assumptionIds={["ira-under-50", "ira-catch-up", "roth-single-start", "roth-single-end", "market-expected", "inflation"]}
      assumptionEditor={
        <>
          <SharedRates />
          <IraEditors />
        </>
      }
      numbers={
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Pre-tax amount each year" tag="typed">
            <Input className="mt-1" inputMode="decimal" aria-label="Yearly amount" value={g.annual} onChange={(e) => g.setAnnual(e.target.value)} />
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
          {over ? <p className="text-sm">Over the {g.ira.year} limit of {formatMoney(g.limit)}. Check the current year.</p> : null}
          {g.room === "partial" ? <p className="text-sm text-muted">Income is inside the phase-out. Only part may be allowed.</p> : null}
          {g.room === "none" ? <p className="text-sm text-muted">Income is past the phase-out in your settings.</p> : null}
          <RothBars roth={g.compare.roth} traditional={g.compare.traditional} taxNow={g.taxNow} taxLater={g.taxLater} />
          <ProgressRing
            pct={g.limit > 0 ? Math.min(100, (g.annualN / g.limit) * 100) : 0}
            tone={over ? "danger" : "primary"}
            label={over ? `Over the ${g.ira.year} limit` : `${formatMoney(g.annualN)} of ${formatMoney(g.limit)}`}
          />
        </div>
      }
      keyNumbers={[
        { label: "Roth after tax", value: formatMoney(g.compare.roth) },
        { label: "Traditional after tax", value: formatMoney(g.compare.traditional) },
        { label: "Roth put in", value: formatMoney(g.compare.rothContributed) },
        { label: "Traditional put in", value: formatMoney(g.compare.traditionalContributed) },
        { label: "Limit", value: formatMoney(g.limit) },
        { label: "Room", value: g.room },
      ]}
      years={<YearTable columns={["Year", "Roth put in", "Traditional put in"]} rows={rows} />}
      advanced={
        g.nerd ? (
          <Sensitivity
            rows={sensitivityOf(
              (next) =>
                rothVsTraditional({
                  annual: g.annualN,
                  years: g.yearCount,
                  rate: next,
                  taxNow: g.taxNowN,
                  taxLater: g.taxLaterN,
                  inflation: g.inflationRate,
                  today: g.today,
                }).roth,
              g.market,
              0,
            ).map((row) => ({ label: row.label, value: formatMoney(row.value) }))}
          />
        ) : null
      }
    />
  );
}
