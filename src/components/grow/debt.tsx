import { useEffect, useRef, useState } from "react";
import { debtTimeline, sensitivityOf } from "@/lib/budget/grow-tables";
import { payoffPlan } from "@/lib/budget/grow-math";
import { formatMoney } from "@/lib/budget/money";
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
  const snow = payoffPlan(g.debts, extraN, "snowball");
  const ava = payoffPlan(g.debts, extraN, "avalanche");
  const line = g.debts.length ? debtTimeline(g.debts, extraN) : null;
  const result = g.debts.length
    ? `Highest interest first finishes in ${ava.unfinished ? "more than 50 years" : `${ava.months} months`} and costs ${formatMoney(ava.interest)} in interest.`
    : g.facts.creditOwed.value != null
      ? `Cards total ${formatMoney(g.facts.creditOwed.value)}. Type the rate and the minimum, then add the debt.`
      : "Type each card or loan. The payoff shows once a debt is added.";
  return (
    <CalcFrame
      question="How long to pay off a debt?"
      result={result}
      topic="debt"
      facts={g.tipFacts}
      assumptionIds={[]}
      extraAssumptions={["Highest interest is paid first. The month count is from now."]}
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
      picture={g.debts.length ? <PayoffRace snowMonths={snow.months} avaMonths={ava.months} snowInterest={snow.interest} avaInterest={ava.interest} /> : <p className="text-sm text-muted">No debts yet.</p>}
      keyNumbers={[
        { label: "Highest rate", value: ava.unfinished ? "50+ years" : `${ava.months} months` },
        { label: "Interest", value: formatMoney(ava.interest) },
        { label: "Smallest balance", value: snow.unfinished ? "50+ years" : `${snow.months} months` },
        { label: "That interest", value: formatMoney(snow.interest) },
        { label: "Extra", value: formatMoney(extraN) },
        { label: "Debts", value: String(g.debts.length) },
      ]}
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
            rows={sensitivityOf(
              (_rate, add) => payoffPlan(g.debts, add, "avalanche").months,
              0,
              extraN,
            ).map((row) => ({ label: row.label, value: `${row.value} months` }))}
          />
        ) : null
      }
    />
  );
}
