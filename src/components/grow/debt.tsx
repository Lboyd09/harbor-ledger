import { useEffect, useRef, useState } from "react";
import { debtTimeline } from "@/lib/budget/grow-tables";
import { debtWhatIfs, extraNeeded, paymentBelowInterest, simulatePayoff } from "@/lib/budget/grow-math";
import { formatMoney } from "@/lib/budget/money";
import { currentMonthKey, monthShort, shiftMonth } from "@/lib/budget/parse-date";
import { PayoffRace } from "../grow-pictures";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "../ui/button";
import { Input } from "../ui/field";
import { CalcFrame, Field, Sensitivity, YearTable, tagOf } from "./frame";
import { useGrow } from "./session";

export function DebtPage() {
  const g = useGrow();
  const addDebt = useBudgetStore((s) => s.addDebt);
  const removeDebt = useBudgetStore((s) => s.removeDebt);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minimum, setMinimum] = useState("");
  const [extra, setExtra] = useState("50");
  const started = useRef(false);
  useEffect(() => {
    if (started.current || g.debts.length) return;
    if (g.facts.creditOwed.value == null) return;
    started.current = true;
    setBalance(String(Math.round(g.facts.creditOwed.value)));
  }, [g.debts.length, g.facts]);
  const extraN = Math.max(0, Number(extra) || 0);
  const snow = simulatePayoff(g.debts, extraN, "snowball");
  const ava = simulatePayoff(g.debts, extraN, "avalanche");
  const line = g.debts.length ? debtTimeline(g.debts, extraN) : null;
  const single = g.debts.length === 1;
  const now = currentMonthKey();
  const when = (months: number) => {
    const ym = shiftMonth(now, months);
    return `${months} month${months === 1 ? "" : "s"} (${monthShort(ym)} ${ym.slice(0, 4)})`;
  };
  const monthlyTotal = g.debts.reduce((sum, debt) => sum + Math.max(0, debt.minimum), 0) + extraN;
  const add = ava.unfinished ? extraNeeded(g.debts, extraN) : 0;
  const neverText = ava.unfinished
    ? paymentBelowInterest(g.debts, extraN)
      ? `This payment never pays it off, because it doesn't cover the interest. Add at least ${formatMoney(add)} a month.`
      : `At this payment it takes more than 50 years. Add at least ${formatMoney(add)} a month to finish within 50 years.`
    : null;
  const result = !g.debts.length
    ? g.facts.creditOwed.value != null
      ? `Cards total ${formatMoney(g.facts.creditOwed.value)}. Type the rate and the minimum, then add the debt.`
      : "Type each card or loan. The payoff shows once a debt is added."
    : neverText
      ? neverText
      : single
        ? `Paying ${formatMoney(monthlyTotal)} a month, ${g.debts[0].name} is paid off in ${when(ava.months)} with ${formatMoney(ava.interest)} in interest.`
        : `Paying highest interest first, you're debt-free in ${when(ava.months)} and pay ${formatMoney(ava.interest)} in interest.`;
  return (
    <CalcFrame
      question="How long to pay off a debt?"
      result={result}
      topic="debt"
      facts={g.tipFacts}
      assumptionIds={[]}
      extraAssumptions={[
        "Each month, interest is added first. Then every debt gets its minimum, and the rest goes to the highest rate. A paid-off debt's minimum moves to the next one.",
        "Month counts start from this month.",
      ]}
      numbers={
        <div className="space-y-2">
          <Field label="Extra payment each month" tag="typed">
            <Input className="mt-1 max-w-xs" inputMode="decimal" aria-label="Extra payment" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </Field>
          <ul className="space-y-1 text-sm">
            {g.debts.map((debt) => (
              <li key={debt.id} className="flex items-center justify-between gap-2">
                <span>{debt.name} · {formatMoney(debt.balance)} · {debt.apr}%</span>
                <button type="button" className="min-h-11 text-xs text-muted" onClick={() => removeDebt(debt.id)}>Remove</button>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input aria-label="Debt name" placeholder="Card or loan" value={name} onChange={(e) => setName(e.target.value)} />
            <Input aria-label="Balance" inputMode="decimal" placeholder="Balance" value={balance} onChange={(e) => setBalance(e.target.value)} />
            <Input aria-label="APR" inputMode="decimal" placeholder="Interest %" value={apr} onChange={(e) => setApr(e.target.value)} />
            <Input aria-label="Minimum" inputMode="decimal" placeholder="Minimum" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
          </div>
          <p className="text-xs text-muted">{tagOf(g.facts.creditOwed.source)}</p>
          <Button
            size="sm"
            disabled={!name.trim() || !(Number(balance) > 0)}
            onClick={() => {
              addDebt({ name, balance: Number(balance), apr: Number(apr) || 0, minimum: Number(minimum) || 0 });
              setName("");
              setBalance("");
              setApr("");
              setMinimum("");
            }}
          >
            Add this debt
          </Button>
        </div>
      }
      picture={
        g.debts.length ? (
          <div className="space-y-3">
            {!single ? (
              <ul className="space-y-1 text-sm" aria-label="When each debt is paid off">
                {ava.payoffs.map((debt) => (
                  <li key={debt.id}>
                    {debt.month == null ? `${debt.name} is not paid off within 50 years.` : `${debt.name} paid off in ${when(debt.month)}.`}
                  </li>
                ))}
              </ul>
            ) : null}
            {!single && !ava.unfinished && !snow.unfinished ? (
              <PayoffRace snowMonths={snow.months} avaMonths={ava.months} snowInterest={snow.interest} avaInterest={ava.interest} />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">No debts yet.</p>
        )
      }
      keyNumbers={
        single
          ? [
              { label: "Paid off in", value: ava.unfinished ? "50+ years" : `${ava.months} months` },
              { label: "Interest", value: formatMoney(ava.interest) },
              { label: "Paying each month", value: formatMoney(monthlyTotal) },
              { label: "Extra", value: formatMoney(extraN) },
            ]
          : [
              { label: "Highest rate first", value: ava.unfinished ? "50+ years" : `${ava.months} months` },
              { label: "Interest, highest rate first", value: formatMoney(ava.interest) },
              { label: "Smallest balance first", value: snow.unfinished ? "50+ years" : `${snow.months} months` },
              { label: "Interest, smallest balance first", value: formatMoney(snow.interest) },
              { label: "Paying each month", value: formatMoney(monthlyTotal) },
              { label: "Debts", value: String(g.debts.length) },
            ]
      }
      years={
        line ? (
          <YearTable
            columns={["Month", "Minimums left", "With extra"]}
            rows={line.withExtra.filter((row, index) => index % 6 === 0 || index === line.withExtra.length - 1).map((row) => {
              const min = line.minimums.find((item) => item.month === row.month);
              return [String(row.month), formatMoney(min?.remaining ?? 0), formatMoney(row.remaining)];
            })}
          />
        ) : null
      }
      advanced={
        g.nerd && g.debts.length ? (
          <Sensitivity
            rows={debtWhatIfs(g.debts, extraN).map((row) => ({
              label: row.label,
              value: row.unfinished ? "Not within 50 years" : `${row.months} months, ${formatMoney(row.interest)} interest`,
            }))}
          />
        ) : null
      }
    />
  );
}
