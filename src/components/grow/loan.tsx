import { useState } from "react";
import { readLoan } from "@/lib/budget/calc-input";
import { loanCompare } from "@/lib/budget/grow-math";
import { amortizationSchedule } from "@/lib/budget/grow-tables";
import { formatMoney } from "@/lib/budget/money";
import { Input } from "../ui/field";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { useGrow } from "./grow-context";

function termLabel(months: number) {
  if (!Number.isFinite(months) || months <= 0) return "—";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} month${rest === 1 ? "" : "s"}`;
  if (rest === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${rest} month${rest === 1 ? "" : "s"}`;
}

export function LoanPage() {
  const g = useGrow();
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [years, setYears] = useState("");
  const [extra, setExtra] = useState("");
  const read = readLoan({ balance, apr, years, extra });
  const balanceN = read.ok ? read.balance : 0;
  const aprN = read.ok ? read.apr : 0;
  const yearsN = read.ok ? read.years : 1;
  const extraN = read.ok ? read.extra : 0;
  const result = loanCompare({ balance: balanceN, apr: aprN, years: yearsN, extra: extraN });
  const plain = loanCompare({ balance: balanceN, apr: aprN, years: yearsN, extra: 0 });
  const table = amortizationSchedule({ balance: balanceN, aprPercent: aprN, years: yearsN, extra: extraN });
  const saved = Math.max(0, plain.interest - result.extraInterest);
  const sentence = !read.ok ? "" : result.unfinished ? "This payment does not finish the loan in 50 years." : "";
  const schedule = table.filter((row) => row.month % 12 === 0 || row.month === table.length);
  const dash = !read.ok || result.unfinished;
  return (
    <CalcFrame
      question="What does an extra payment save?"
      headline={read.ok && !result.unfinished ? { value: `${formatMoney(result.payment)}/mo`, sub: `Extra ${formatMoney(extraN)} saves ${formatMoney(saved)}` } : undefined}
      result={sentence}
      missing={read.ok ? null : read.prompt}
      topic="loan"
      facts={g.tipFacts}
      assumptionIds={[]}
      numbers={
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Balance">
            <Input className="mt-1" aria-label="Loan balance" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </Field>
          <Field label="Interest %">
            <Input className="mt-1" aria-label="Loan interest" inputMode="decimal" value={apr} onChange={(e) => setApr(e.target.value)} />
          </Field>
          <Field label="Years">
            <Input className="mt-1" aria-label="Loan years" inputMode="decimal" placeholder="e.g. 30" value={years} onChange={(e) => setYears(e.target.value)} />
          </Field>
          <Field label="Extra each month">
            <Input className="mt-1" aria-label="Extra payment" inputMode="decimal" placeholder="0" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </Field>
        </div>
      }
      picture={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <div className="text-sm font-medium">Regular payment</div>
            <div className="mt-1 font-display text-2xl tabular">{read.ok ? formatMoney(result.payment) : "—"}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-sm font-medium">With extra</div>
            <div className="mt-1 font-display text-2xl tabular">{dash ? "—" : termLabel(result.extraMonths)}</div>
          </div>
        </div>
      }
      keyNumbers={
        read.ok
          ? [
              { label: "Payment", value: formatMoney(result.payment) },
              { label: "Paid off in", value: dash ? "—" : termLabel(result.months) },
              { label: "Interest", value: dash ? "—" : formatMoney(result.interest) },
              { label: "With extra", value: dash ? "—" : termLabel(result.extraMonths) },
              { label: "Interest with extra", value: dash ? "—" : formatMoney(result.extraInterest) },
              { label: "Extra saves", value: dash ? "—" : formatMoney(saved) },
            ]
          : []
      }
      years={
        <YearTable
          columns={["Month", "Interest", "Principal", "Left"]}
          rows={schedule.map((row) => [String(row.month), formatMoney(row.interest), formatMoney(row.principal), formatMoney(row.balance)])}
        />
      }
      advanced={
        g.nerd && read.ok ? (
          <Sensitivity
            rows={[
              { label: "No extra", value: `${termLabel(plain.extraMonths)} · ${formatMoney(plain.interest)}` },
              { label: "With this extra", value: `${termLabel(result.extraMonths)} · ${formatMoney(result.extraInterest)}` },
              { label: "This extra saves", value: formatMoney(saved) },
              {
                label: "Extra $100 more",
                value: (() => {
                  const more = loanCompare({ balance: balanceN, apr: aprN, years: yearsN, extra: extraN + 100 });
                  return more.unfinished ? "—" : `${termLabel(more.extraMonths)} · saves ${formatMoney(Math.max(0, plain.interest - more.extraInterest))}`;
                })(),
              },
            ]}
          />
        ) : null
      }
    />
  );
}
