import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/budget/money";
import { monthShort } from "@/lib/budget/parse-date";
import {
  buildYearWorkbook,
  statusLabel,
  yearSheetCsv,
  type MonthStatus,
  type SheetRow,
} from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";
import { YearSwitcher } from "./year-switcher";

function tone(status: MonthStatus) {
  if (status === "over" || status === "behind") return "text-danger";
  if (status === "on-track") return "text-good";
  return "text-muted";
}

function MoneyCell({ value, warn }: { value: number; warn?: boolean }) {
  return (
    <td className={cn("whitespace-nowrap px-2 py-1.5 text-right tabular", warn && "text-danger")}>
      {formatMoney(value, { dashZero: true })}
    </td>
  );
}

function SheetSection({
  title,
  rows,
  totalLabel,
  totalMonths,
  yearTotal,
}: {
  title: string;
  rows: SheetRow[];
  totalLabel: string;
  totalMonths: number[];
  yearTotal: number;
}) {
  return (
    <>
      <tr>
        <th
          colSpan={16}
          className="sticky left-0 bg-chip px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted"
        >
          {title}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={r.id} className="border-b border-border/70">
          <th className="sticky left-0 max-w-40 truncate bg-surface px-3 py-1.5 text-left font-medium">{r.name}</th>
          {r.months.map((n, i) => (
            <MoneyCell
              key={i}
              value={n}
              warn={r.kind === "expense" && r.effectivePlan > 0 && n > r.effectivePlan + 0.5}
            />
          ))}
          <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium tabular">
            {formatMoney(r.yearTotal, { dashZero: true })}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular text-muted">
            {formatMoney(r.typical, { dashZero: true })}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular">
            {formatMoney(r.effectivePlan, { dashZero: true })}
            {r.usingSuggested ? <div className="text-xs font-normal text-muted">Suggested</div> : null}
          </td>
          <td className={cn("whitespace-nowrap px-2 py-1.5 text-right text-xs", tone(r.status))}>
            {statusLabel(r.status)}
          </td>
        </tr>
      ))}
      <tr className="border-b border-border bg-chip font-medium">
        <th className="sticky left-0 bg-chip px-3 py-2 text-left">{totalLabel}</th>
        {totalMonths.map((n, i) => (
          <MoneyCell key={i} value={n} />
        ))}
        <td className="px-2 py-2 text-right tabular">{formatMoney(yearTotal, { dashZero: true })}</td>
        <td className="px-2 py-2" />
        <td className="px-2 py-2" />
        <td className="px-2 py-2" />
      </tr>
    </>
  );
}

export function YearSheet({ embedded = false }: { embedded?: boolean }) {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const activeMonth = useBudgetStore((s) => s.activeMonth);
  const applyRecommendedPlans = useBudgetStore((s) => s.applyRecommendedPlans);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const [applied, setApplied] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const year = activeMonth.slice(0, 4);
  const book = useMemo(
    () => buildYearWorkbook(transactions, categories, year),
    [transactions, categories, year],
  );
  const incomeRows = showEmpty ? book.incomeRows : book.incomeRows.filter((r) => r.yearTotal !== 0);
  const expenseRows = showEmpty ? book.expenseRows : book.expenseRows.filter((r) => r.yearTotal !== 0);
  const incomeMonths = book.months.map((_, i) => incomeRows.reduce((s, r) => s + r.months[i], 0));
  const expenseMonths = book.months.map((_, i) => expenseRows.reduce((s, r) => s + r.months[i], 0));

  function downloadCsv() {
    const blob = new Blob([yearSheetCsv(book)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `harbor-${year}-sheet.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!transactions.length) {
    if (embedded) return null;
    return (
      <div className="mx-auto max-w-lg space-y-4 py-6">
        <h1 className="font-display text-3xl font-semibold">Year sheet</h1>
        <p className="text-sm text-muted">
          Import a bank CSV and this page becomes a 12-month grid of every income source and expense category.
        </p>
        <Link to="/import">
          <Button>Import a CSV</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {embedded ? (
          <p className="max-w-xl text-sm text-muted">Months across, categories down. Scroll sideways on a phone.</p>
        ) : (
          <div>
            <h1 className="font-display text-2xl font-semibold md:text-3xl">{year} sheet</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Months across, categories down. Typical is the median of months with activity. A blank plan uses that typical
              amount to judge on-track vs over.
            </p>
            <p className="mt-2 text-sm text-muted">
              {formatMoney(book.income)} in · {formatMoney(book.expenses)} out ·{" "}
              <span className={book.net < 0 ? "text-danger" : "text-good"}>
                {formatMoney(book.net, { signed: true })} saved
              </span>
              {book.income > 0 ? ` · ${Math.round(book.savingsRate * 100)}%` : ""} · {book.monthsOnTrack}/{book.activeMonths}{" "}
              months on track
            </p>
          </div>
        )}
        {embedded ? null : <YearSwitcher />}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            const n = applyRecommendedPlans(year);
            setApplied(n > 0);
          }}
        >
          {applied ? "Plan filled from typical months" : "Save typical amounts as my plan"}
        </Button>
        <Link to="/plan">
          <Button variant="ghost">Edit plan amounts</Button>
        </Link>
        <Button variant="ghost" onClick={downloadCsv}>
          Download this sheet
        </Button>
        <Button variant="ghost" onClick={() => setShowEmpty((v) => !v)}>
          {showEmpty ? "Hide empty categories" : "Show empty categories"}
        </Button>
      </div>

      <div className="sheet-wrap rounded-lg border border-border bg-surface">
        <table className="sheet-table w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="sticky left-0 bg-surface px-3 py-2 text-left font-medium">Category</th>
              {book.months.map((ym) => (
                <th key={ym} className="px-2 py-2 text-right font-medium">
                  <button type="button" onClick={() => setActiveMonth(ym)}>
                    {monthShort(ym)}
                  </button>
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">Year</th>
              <th className="px-2 py-2 text-right font-medium">Typical</th>
              <th className="px-2 py-2 text-right font-medium">Plan / mo</th>
              <th className="px-2 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <SheetSection
              title="Income"
              rows={incomeRows}
              totalLabel="Total in"
              totalMonths={incomeMonths}
              yearTotal={book.income}
            />
            <SheetSection
              title="Expenses"
              rows={expenseRows}
              totalLabel="Total out"
              totalMonths={expenseMonths}
              yearTotal={book.expenses}
            />
            {book.uncategorizedRow ? (
              <tr className="border-b border-border/70">
                <th className="sticky left-0 bg-surface px-3 py-1.5 text-left font-medium text-warn">
                  {book.uncategorizedRow.name}
                </th>
                {book.uncategorizedRow.months.map((n, i) => (
                  <MoneyCell key={i} value={n} />
                ))}
                <td className="px-2 py-1.5 text-right tabular text-warn">
                  {formatMoney(book.uncategorizedRow.yearTotal)}
                </td>
                <td className="px-2 py-1.5" />
                <td className="px-2 py-1.5" />
                <td className="px-2 py-1.5" />
              </tr>
            ) : null}
            <tr className="bg-chip font-medium">
              <th className="sticky left-0 bg-chip px-3 py-2 text-left">Net leftover</th>
              {book.monthSummaries.map((m) => (
                <td
                  key={m.ym}
                  className={cn("px-2 py-2 text-right tabular", m.net < 0 ? "text-danger" : "text-good")}
                >
                  {formatMoney(m.net, { signed: true, dashZero: true })}
                </td>
              ))}
              <td className={cn("px-2 py-2 text-right tabular", book.net < 0 ? "text-danger" : "text-good")}>
                {formatMoney(book.net, { signed: true })}
              </td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right tabular">
                {formatMoney(book.planLeftover, { signed: true, dashZero: true })}
              </td>
              <td className="px-2 py-2 text-right text-xs text-muted">
                {book.income > 0 ? `${Math.round(book.savingsRate * 100)}% saved` : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}


