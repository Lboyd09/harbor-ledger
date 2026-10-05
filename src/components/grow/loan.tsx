import { useEffect, useRef, useState } from "react";
import { amortizationSchedule } from "@/lib/budget/grow-tables";
import { loanCompare } from "@/lib/budget/grow-math";
import { formatMoney } from "@/lib/budget/money";
import { Input } from "../ui/field";
import { CalcFrame, Field, Sensitivity, YearTable, tagOf } from "./frame";
import { useGrow } from "./session";

export function LoanPage() {
  const g = useGrow();
  const started = useRef(false);
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [years, setYears] = useState("5");
  const [extra, setExtra] = useState("0");
  useEffect(() => {
    if (started.current) return;
    if (g.facts.creditOwed.value == null) return;
    started.current = true;
    setBalance(String(Math.round(g.facts.creditOwed.value)));
  }, [g.facts]);
  const balanceN = Number(balance) || 0;
  const aprN = Number(apr) || 0;
  const yearsN = Number(years) || 1;
  const extraN = Number(extra) || 0;
  const result = loanCompare({ balance: balanceN, apr: aprN, years: yearsN, extra: extraN });
  const table = amortizationSchedule({ balance: balanceN, aprPercent: aprN, years: yearsN, extra: extraN });
  const sentence = result.unfinished
    ? "This payment does not finish the loan in 50 years."
    : `The regular payment is ${formatMoney(result.payment)}. Extra saves ${formatMoney(Math.max(0, result.interest - result.extraInterest))}.`;
  return (
    <CalcFrame
      question="What does an extra payment save?"
      result={sentence}
      topic="loan"
      facts={g.tipFacts}
      assumptionIds={[]}
      extraAssumptions={["The regular payment matches this loan. Extra is added on top."]}
      numbers={
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Balance" tag={tagOf(g.facts.creditOwed.source)}>
            <Input className="mt-1" aria-label="Loan balance" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </Field>
          <Field label="Interest %" tag="typed">
            <Input className="mt-1" aria-label="Loan interest" inputMode="decimal" value={apr} onChange={(e) => setApr(e.target.value)} />
          </Field>
          <Field label="Years" tag="typed">
            <Input className="mt-1" aria-label="Loan years" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
          </Field>
          <Field label="Extra each month" tag="typed">
            <Input className="mt-1" aria-label="Extra payment" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <div className="text-sm font-medium">Regular payment</div>
            <div className="mt-1 font-display text-2xl tabular">{formatMoney(result.payment)}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-sm font-medium">With extra</div>
            <div className="mt-1 font-display text-2xl tabular">{result.extraMonths} months</div>
          </div>
        </div>
      }
      keyNumbers={[
        { label: "Payment", value: formatMoney(result.payment) },
        { label: "Months", value: String(result.months) },
        { label: "Interest", value: formatMoney(result.interest) },
        { label: "Months with extra", value: String(result.extraMonths) },
        { label: "Interest with extra", value: formatMoney(result.extraInterest) },
        { label: "Saved", value: formatMoney(Math.max(0, result.interest - result.extraInterest)) },
      ]}
      years={
        <YearTable
          columns={["Month", "Interest", "Principal", "Left"]}
          rows={table.filter((row) => row.month % 6 === 0 || row.month === table.length).slice(0, 40).map((row) => [String(row.month), formatMoney(row.interest), formatMoney(row.principal), formatMoney(row.balance)])}
        />
      }
      advanced={
        g.nerd ? (
          <Sensitivity
            rows={[
              { label: "Rate 2 points lower", value: formatMoney(loanCompare({ balance: balanceN, apr: aprN - 2, years: yearsN, extra: extraN }).interest) },
              { label: "Rate as entered", value: formatMoney(loanCompare({ balance: balanceN, apr: aprN, years: yearsN, extra: 0 }).interest) },
              { label: "Rate 2 points higher", value: formatMoney(loanCompare({ balance: balanceN, apr: aprN + 2, years: yearsN, extra: extraN }).interest) },
              { label: "Extra $100 less", value: `${loanCompare({ balance: balanceN, apr: aprN, years: yearsN, extra: Math.max(0, extraN - 100) }).extraMonths} months` },
              { label: "Extra $100 more", value: `${loanCompare({ balance: balanceN, apr: aprN, years: yearsN, extra: extraN + 100 }).extraMonths} months` },
            ]}
          />
        ) : null
      }
    />
  );
}
