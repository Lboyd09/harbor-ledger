import { useMemo } from "react";
import { fileReadout } from "@/lib/budget/readout";
import { formatMoney } from "@/lib/budget/money";
import type { Category, Transaction } from "@/lib/budget/types";

export function ReadoutCard({
  transactions,
  categories,
  title = "What the numbers say",
}: {
  transactions: Transaction[];
  categories: Category[];
  title?: string;
}) {
  const read = useMemo(() => fileReadout(transactions, categories), [transactions, categories]);
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 font-display text-2xl font-semibold">{read.headline}</p>
      {read.moneyIn > 0 || read.moneyOut > 0 ? (
        <p className="mt-1 text-sm text-muted">
          {formatMoney(read.moneyIn)} in · {formatMoney(read.moneyOut)} out
          {read.monthCount > 1 ? ` · ${read.monthCount} months` : ""}
        </p>
      ) : null}
      {read.lines.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {read.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
