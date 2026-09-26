import { formatMoney } from "@/lib/budget/money";
import type { MonthGroup } from "@/lib/budget/month-view";

export function CashSplitChart({
  income,
  expenses,
}: {
  income: number;
  expenses: number;
}) {
  const max = Math.max(income, expenses, 1);
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">This month, side by side</p>
      <div className="mt-3 space-y-3">
        <Bar label="Income" value={income} max={max} tone="in" />
        <Bar label="Expenses" value={expenses} max={max} tone="out" />
      </div>
      <p className="mt-3 text-sm text-muted">
        Leftover {formatMoney(income - expenses, { signed: true })}. Income and expenses stay on separate lists so a
        paycheck never looks like a purchase.
      </p>
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "in" | "out" }) {
  const pct = Math.min(100, Math.round((Math.max(0, value) / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className={tone === "in" ? "text-good" : "text-danger"}>{label}</span>
        <span className="tabular font-medium">{formatMoney(value)}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full bg-chip">
        <div
          className={tone === "in" ? "h-full bg-good" : "h-full bg-danger"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CategoryBars({ title, groups, tone }: { title: string; groups: MonthGroup[]; tone: "in" | "out" }) {
  const max = Math.max(1, ...groups.map((g) => Math.abs(g.total)));
  if (!groups.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-3 space-y-2">
        {groups
          .filter((g) => !g.open)
          .slice(0, 8)
          .map((g) => {
            const pct = Math.min(100, Math.round((Math.abs(g.total) / max) * 100));
            return (
              <li key={g.id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{g.name}</span>
                  <span className="tabular">{formatMoney(g.total)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-chip">
                  <div className={tone === "in" ? "h-full bg-good" : "h-full bg-danger/80"} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
