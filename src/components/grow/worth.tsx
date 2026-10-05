import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { netWorthSeries } from "@/lib/budget/grow-tables";
import { formatMoney } from "@/lib/budget/money";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "../ui/button";
import { Input } from "../ui/field";
import { CalcFrame, YearTable } from "./frame";
import { useGrow } from "./session";

export function WorthPage() {
  const g = useGrow();
  const addNetWorth = useBudgetStore((s) => s.addNetWorth);
  const removeNetWorth = useBudgetStore((s) => s.removeNetWorth);
  const [date, setDate] = useState("");
  const [worth, setWorth] = useState("");
  const [note, setNote] = useState("");
  const latest = g.netWorth.at(-1);
  const series = netWorthSeries(g.accounts, g.balances);
  const fromAccounts = series.at(-1);
  return (
    <CalcFrame
      question="What do you own, minus what you owe?"
      result={latest ? `Last snapshot is ${formatMoney(latest.amount)} on ${latest.date}.` : fromAccounts ? `Accounts total ${formatMoney(fromAccounts.total)} as of ${fromAccounts.date}.` : "Nothing entered yet. Harbor cannot see a bank."}
      topic="worth"
      facts={g.tipFacts}
      assumptionIds={[]}
      extraAssumptions={["Each account keeps its latest balance on or before that date. A card you owe lowers the total."]}
      numbers={
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input aria-label="Amount" inputMode="decimal" placeholder="Total" value={worth} onChange={(e) => setWorth(e.target.value)} />
            <Input aria-label="Note" placeholder="Note, optional" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)}
            onClick={() => {
              addNetWorth({ date, amount: Number(worth) || 0, note });
              setDate("");
              setWorth("");
              setNote("");
            }}
          >
            Save this snapshot
          </Button>
          <ul className="text-sm">
            {g.netWorth.map((point) => (
              <li key={point.id} className="flex justify-between gap-2 py-1">
                <span>{point.date} · {formatMoney(point.amount)} {point.note}</span>
                <button type="button" className="min-h-11 text-xs text-muted" onClick={() => removeNetWorth(point.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      }
      picture={
        g.netWorth.length > 1 ? (
          <div className="chart-rise h-40 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={g.netWorth.map((point) => ({ name: point.date.slice(0, 7), Amount: point.amount }))}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
                <Tooltip formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))} />
                <Line type="monotone" dataKey="Amount" stroke="var(--color-primary)" dot={false} isAnimationActive={g.lively} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted">{fromAccounts ? `From your accounts: ${formatMoney(fromAccounts.total)}.` : "Add a date and an amount."}</p>
        )
      }
      keyNumbers={[
        { label: "Last snapshot", value: latest ? formatMoney(latest.amount) : "—" },
        { label: "Snapshots", value: String(g.netWorth.length) },
        { label: "Accounts", value: formatMoney(fromAccounts?.total ?? 0) },
        { label: "Checking", value: formatMoney(fromAccounts?.byKind.checking ?? 0) },
        { label: "Savings", value: formatMoney(fromAccounts?.byKind.savings ?? 0) },
        { label: "Retirement", value: formatMoney((fromAccounts?.byKind.retirement ?? 0) + (fromAccounts?.byKind.investment ?? 0)) },
      ]}
      years={<YearTable columns={["Date", "Total"]} rows={series.map((point) => [point.date, formatMoney(point.total)])} />}
    />
  );
}
