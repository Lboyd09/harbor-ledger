import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonth, shiftWeek, weekLabel } from "@/lib/budget/parse-date";
import { monthsInData, weeksInData } from "@/lib/budget/totals";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";

export function PeriodToggle() {
  const period = useBudgetStore((s) => s.profile.budgetPeriod);
  const setBudgetPeriod = useBudgetStore((s) => s.setBudgetPeriod);
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
      <button
        type="button"
        className={`min-h-9 rounded-sm px-3 text-sm ${period === "week" ? "bg-chip font-medium" : "text-muted"}`}
        onClick={() => setBudgetPeriod("week")}
      >
        Week
      </button>
      <button
        type="button"
        className={`min-h-9 rounded-sm px-3 text-sm ${period === "month" ? "bg-chip font-medium" : "text-muted"}`}
        onClick={() => setBudgetPeriod("month")}
      >
        Month
      </button>
    </div>
  );
}

export function MonthSwitcher({ compact = false }: { compact?: boolean }) {
  const period = useBudgetStore((s) => s.profile.budgetPeriod);
  const activeMonth = useBudgetStore((s) => s.activeMonth);
  const activeWeek = useBudgetStore((s) => s.activeWeek);
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth);
  const setActiveWeek = useBudgetStore((s) => s.setActiveWeek);
  const transactions = useBudgetStore((s) => s.transactions);

  if (period === "week") {
    const weeks = weeksInData(transactions);
    const prev = shiftWeek(activeWeek, -1);
    const next = shiftWeek(activeWeek, 1);
    return (
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" aria-label="Previous week" onClick={() => setActiveWeek(prev)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className={compact ? "min-w-36 text-center font-display text-base font-semibold" : "min-w-44 text-center font-display text-lg font-semibold"}>
          {weekLabel(activeWeek)}
        </div>
        <Button variant="ghost" size="sm" aria-label="Next week" onClick={() => setActiveWeek(next)}>
          <ChevronRight className="size-4" />
        </Button>
        {weeks.length > 0 ? (
          <select
            aria-label="Jump to week"
            className="ml-1 hidden min-h-9 rounded-md border border-border bg-surface px-2 text-sm md:block"
            value={weeks.includes(activeWeek) ? activeWeek : ""}
            onChange={(e) => e.target.value && setActiveWeek(e.target.value)}
          >
            <option value="">Jump…</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {weekLabel(w)}
              </option>
            ))}
          </select>
        ) : null}
        <PeriodToggle />
      </div>
    );
  }

  const months = monthsInData(transactions);
  const prev = shiftMonth(activeMonth, -1);
  const next = shiftMonth(activeMonth, 1);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => setActiveMonth(prev)}>
        <ChevronLeft className="size-4" />
      </Button>
      <div className={compact ? "min-w-36 text-center font-display text-base font-semibold" : "min-w-44 text-center font-display text-lg font-semibold"}>
        {monthLabel(activeMonth)}
      </div>
      <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => setActiveMonth(next)}>
        <ChevronRight className="size-4" />
      </Button>
      {months.length > 0 ? (
        <select
          aria-label="Jump to month"
          className="ml-1 hidden min-h-9 rounded-md border border-border bg-surface px-2 text-sm md:block"
          value={months.includes(activeMonth) ? activeMonth : ""}
          onChange={(e) => e.target.value && setActiveMonth(e.target.value)}
        >
          <option value="">Jump…</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      ) : null}
      <PeriodToggle />
    </div>
  );
}
