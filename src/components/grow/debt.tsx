import { useMemo, useState } from "react";
import { debtTimeline } from "@/lib/budget/grow-tables";
import { firstMissing, readNumber } from "@/lib/budget/calc-input";
import { debtWhatIfs, extraNeeded, paymentBelowInterest, simulatePayoff } from "@/lib/budget/grow-math";
import { formatMoney } from "@/lib/budget/money";
import { currentMonthKey, monthShort, shiftMonth } from "@/lib/budget/parse-date";
import { calculatorDebts } from "@/lib/budget/real-debts";
import type { DebtItem } from "@/lib/budget/types";
import { PayoffRace } from "../grow-pictures";
import { Button } from "../ui/button";
import { Input } from "../ui/field";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { tagOf } from "./source-tag";
import { useGrow } from "./grow-context";

export function DebtPage() {
  const g = useGrow();
  const fromAccounts = useMemo(
    () => calculatorDebts(g.accounts, g.balances, g.debts),
    [g.accounts, g.balances, g.debts],
  );
  const [rows, setRows] = useState<DebtItem[] | null>(null);
  const working = rows ?? fromAccounts;
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minimum, setMinimum] = useState("");
  const [extra, setExtra] = useState("50");
  const extraN = Math.max(0, Number(extra) || 0);
  // A blank rate or minimum is not 0. Typing 0 on purpose is fine.
  const balanceIn = readNumber(balance);
  const aprIn = readNumber(apr);
  const minimumIn = readNumber(minimum);
  const debtNeeds = firstMissing([
    { label: "the balance", value: balanceIn, above: 0 },
    { label: "the interest rate (0 is fine)", value: aprIn, min: 0 },
    { label: "the minimum payment (0 is fine)", value: minimumIn, min: 0 },
  ]);
  const typing = Boolean(name.trim() || balance.trim() || apr.trim() || minimum.trim());
  const snow = simulatePayoff(working, extraN, "snowball");
  const ava = simulatePayoff(working, extraN, "avalanche");
  const line = working.length ? debtTimeline(working, extraN) : null;
  const single = working.length === 1;
  const now = currentMonthKey();
  const when = (months: number) => {
    const ym = shiftMonth(now, months);
    return `${months} month${months === 1 ? "" : "s"} (${monthShort(ym)} ${ym.slice(0, 4)})`;
  };
  const monthlyTotal = working.reduce((sum, debt) => sum + Math.max(0, debt.minimum), 0) + extraN;
  const add = ava.unfinished ? extraNeeded(working, extraN) : 0;
  const neverText = ava.unfinished
    ? paymentBelowInterest(working, extraN)
      ? `This payment never pays it off, because it doesn't cover the interest. Add at least ${formatMoney(add)} a month.`
      : `At this payment it takes more than 50 years. Add at least ${formatMoney(add)} a month to finish within 50 years.`
    : null;
  const result = !working.length
    ? "Add a card or loan."
    : neverText
      ? neverText
      : single
        ? `Paying ${formatMoney(monthlyTotal)} a month, ${working[0].name} is paid off in ${when(ava.months)} with ${formatMoney(ava.interest)} in interest.`
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
            {working.map((debt) => (
              <li key={debt.id} className="flex items-center justify-between gap-2">
                <span>
                  {debt.name} · {formatMoney(debt.balance)} · {debt.apr}%
                  {debt.origin === "plan" || debt.origin === "money" ? " · from your accounts" : ""}
                </span>
                <button type="button" className="min-h-11 text-xs text-muted" onClick={() => setRows(working.filter((row) => row.id !== debt.id))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" onClick={() => setRows(fromAccounts)}>
            Reset to my accounts
          </Button>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input aria-label="Debt name" placeholder="Card or loan" value={name} onChange={(e) => setName(e.target.value)} />
            <Input aria-label="Balance" inputMode="decimal" placeholder="Balance" value={balance} onChange={(e) => setBalance(e.target.value)} />
            <Input aria-label="APR" inputMode="decimal" placeholder="Interest %" value={apr} onChange={(e) => setApr(e.target.value)} />
            <Input aria-label="Minimum" inputMode="decimal" placeholder="Minimum" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
          </div>
          <p className="text-xs text-muted">{tagOf(g.facts.creditOwed.source)}</p>
          {typing && (debtNeeds || !name.trim()) ? (
            <p className="text-xs text-muted" role="status">
              {debtNeeds ? `Enter ${debtNeeds} to add this debt.` : "Enter a name to add this debt."}
            </p>
          ) : null}
          <Button
            size="sm"
            disabled={!name.trim() || debtNeeds != null}
            onClick={() => {
              if (balanceIn == null || aprIn == null || minimumIn == null) return;
              setRows([
                ...working,
                { id: `plan_${Date.now()}`, name, balance: balanceIn, apr: aprIn, minimum: minimumIn, origin: "plan" },
              ]);
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
        working.length ? (
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
              { label: "Paid off in", value: ava.unfinished ? "—" : `${ava.months} months` },
              { label: "Interest", value: ava.unfinished ? "—" : formatMoney(ava.interest) },
              { label: "Paying each month", value: formatMoney(monthlyTotal) },
              { label: "Extra", value: formatMoney(extraN) },
            ]
          : [
              { label: "Highest rate first", value: ava.unfinished ? "—" : `${ava.months} months` },
              { label: "Interest, highest rate first", value: ava.unfinished ? "—" : formatMoney(ava.interest) },
              { label: "Smallest balance first", value: snow.unfinished ? "—" : `${snow.months} months` },
              { label: "Interest, smallest balance first", value: snow.unfinished ? "—" : formatMoney(snow.interest) },
              { label: "Paying each month", value: formatMoney(monthlyTotal) },
              { label: "Debts", value: String(working.length) },
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
        g.nerd && working.length ? (
          <Sensitivity
            rows={debtWhatIfs(working, extraN).map((row) => ({
              label: row.label,
              value: row.unfinished ? "Not within 50 years" : `${row.months} months, ${formatMoney(row.interest)} interest`,
            }))}
          />
        ) : null
      }
    />
  );
}
