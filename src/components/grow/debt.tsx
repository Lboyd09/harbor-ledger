import { useMemo, useState } from "react";
import { debtTimeline } from "@/lib/budget/grow-tables";
import { firstMissing, readNumber } from "@/lib/budget/calc-input";
import { debtWhatIfs, extraNeeded, paymentBelowInterest, simulatePayoff } from "@/lib/budget/grow-math";
import { dropSameWhatIfs, extraPaymentSavings } from "@/lib/budget/phase4";
import { formatMoney } from "@/lib/budget/money";
import { currentMonthKey, monthShort, shiftMonth } from "@/lib/budget/parse-date";
import { calculatorDebts } from "@/lib/budget/real-debts";
import type { DebtItem } from "@/lib/budget/types";
import { PayoffRace } from "../grow-pictures";
import { Button } from "../ui/button";
import { Input } from "../ui/field";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
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
  const extraIn = readNumber(extra);
  const extraMissing = extra.trim() === "" || extraIn == null;
  const extraN = extraMissing ? 0 : Math.max(0, extraIn);
  // A blank rate or minimum is not 0. Typing 0 on purpose is fine.
  const balanceIn = readNumber(balance);
  const aprIn = readNumber(apr);
  const minimumIn = readNumber(minimum);
  const debtNeeds = firstMissing([
    { label: "the balance", value: balanceIn, above: 0 },
    { label: "the rate", value: aprIn, min: 0 },
    { label: "the minimum", value: minimumIn, min: 0 },
  ]);
  const typing = Boolean(name.trim() || balance.trim() || apr.trim() || minimum.trim());
  const rateMissing = working.some((debt) => debt.apr < 0);
  const canCalc = !extraMissing && !rateMissing && working.length > 0;
  const emptySim = { months: 0, interest: 0, paid: 0, unfinished: true, payoffs: [], remaining: [0] };
  const snow = canCalc ? simulatePayoff(working, extraN, "snowball") : emptySim;
  const ava = canCalc ? simulatePayoff(working, extraN, "avalanche") : emptySim;
  const line = canCalc ? debtTimeline(working, extraN) : null;
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
      ? `Never paid off. Add ${formatMoney(add)}+/mo.`
      : `Over 50 years. Add ${formatMoney(add)}/mo.`
    : null;
  const cardOwed = g.facts.creditOwed.value ?? 0;
  const freeYm = shiftMonth(now, ava.months);
  const freeLabel = `${monthShort(freeYm)} ${freeYm.slice(0, 4)}`;
  const result = !working.length
    ? cardOwed > 0
      ? `Cards owe ${formatMoney(cardOwed)}. Add rate + minimum.`
      : "Add a card or loan."
    : (neverText ?? "");
  const headline =
    working.length && !neverText
      ? { value: `Debt-free ${freeLabel}`, sub: `${formatMoney(ava.interest)} interest · ${formatMoney(monthlyTotal)}/mo` }
      : undefined;
  const saved = extraN > 0 ? extraPaymentSavings(working, extraN) : null;
  return (
    <CalcFrame
      question="How long to pay off a debt?"
      headline={headline}
      result={saved && !neverText ? `Paying ${formatMoney(extraN)} extra saves ${formatMoney(saved.interestSaved)} in interest and ${saved.monthsSaved} months` : result}
      topic="debt"
      facts={g.tipFacts}
      assumptionIds={[]}
      extraAssumptions={[
        "Each month, interest is added first. Then every debt gets its minimum, and the rest goes to the highest rate. A paid-off debt's minimum moves to the next one.",
        "Month counts start from this month.",
      ]}
      numbers={
        <div className="space-y-2">
          <Field label="Extra payment each month">
            <Input className="mt-1 max-w-xs" inputMode="decimal" aria-label="Extra payment" placeholder="Amount" value={extra} onChange={(e) => setExtra(e.target.value)} />
            {extraMissing ? <p className="mt-1 text-xs text-muted" role="status">Enter an extra payment (0 is fine if you mean none).</p> : null}
          </Field>
          <ul className="space-y-2 text-sm">
            {working.map((debt) => (
              <li key={debt.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  {debt.name} · {formatMoney(debt.balance)}
                </span>
                <Input
                  aria-label={`${debt.name} rate`}
                  inputMode="decimal"
                  className="w-20"
                  placeholder="Rate %"
                  value={debt.apr < 0 ? "" : String(debt.apr)}
                  onChange={(e) => {
                    const next = readNumber(e.target.value);
                    setRows(working.map((row) => row.id === debt.id ? { ...row, apr: next == null ? -1 : next } : row));
                  }}
                />
                <Input
                  aria-label={`${debt.name} minimum`}
                  inputMode="decimal"
                  className="w-24"
                  placeholder="Min"
                  value={debt.minimum === 0 ? "" : String(debt.minimum)}
                  onChange={(e) => {
                    const next = readNumber(e.target.value);
                    setRows(working.map((row) => row.id === debt.id ? { ...row, minimum: next ?? 0 } : row));
                  }}
                />
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
          {fromAccounts.some((row) => working.some((debt) => debt.id === row.id)) ? <p className="text-xs text-muted">↺ from your accounts</p> : null}
          {rateMissing ? <p className="text-xs text-muted" role="status">Enter the rate for each debt. A blank rate leaves the result empty. Typing 0 is fine.</p> : null}
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
              { label: "Paying each month", value: extraMissing ? "—" : formatMoney(monthlyTotal) },
              { label: "Extra", value: formatMoney(extraN) },
            ]
          : [
              { label: "Highest rate first", value: ava.unfinished ? "—" : `${ava.months} months` },
              { label: "Interest, highest rate first", value: ava.unfinished ? "—" : formatMoney(ava.interest) },
              { label: "Smallest balance first", value: snow.unfinished ? "—" : `${snow.months} months` },
              { label: "Interest, smallest balance first", value: snow.unfinished ? "—" : formatMoney(snow.interest) },
              { label: "Paying each month", value: extraMissing ? "—" : formatMoney(monthlyTotal) },
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
            rows={dropSameWhatIfs(debtWhatIfs(working, extraN).map((row) => ({
              label: row.label,
              value: row.unfinished ? "Not within 50 years" : `${row.months} months, ${formatMoney(row.interest)} interest`,
            })))}
          />
        ) : null
      }
    />
  );
}
