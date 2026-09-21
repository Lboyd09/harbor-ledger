import { ChevronLeft, ChevronRight } from "lucide-react";
import { yearsInData } from "@/lib/budget/year";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";

export function YearSwitcher() {
  const activeMonth = useBudgetStore((s) => s.activeMonth);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const transactions = useBudgetStore((s) => s.transactions);
  const year = activeMonth.slice(0, 4);
  const years = yearsInData(transactions);
  const month = activeMonth.slice(5, 7) || "01";

  function go(nextYear: number) {
    setActiveMonth(`${nextYear}-${month}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm" aria-label="Previous year" onClick={() => go(Number(year) - 1)}>
        <ChevronLeft className="size-4" />
      </Button>
      <div className="min-w-20 text-center font-display text-lg font-semibold">{year}</div>
      <Button variant="ghost" size="sm" aria-label="Next year" onClick={() => go(Number(year) + 1)}>
        <ChevronRight className="size-4" />
      </Button>
      {years.length > 1 ? (
        <select
          aria-label="Jump to year"
          className="ml-1 min-h-9 rounded-md border border-border bg-surface px-2 text-sm"
          value={years.includes(year) ? year : ""}
          onChange={(e) => e.target.value && go(Number(e.target.value))}
        >
          <option value="">Jump…</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
