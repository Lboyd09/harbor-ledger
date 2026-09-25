import { monthShort } from "@/lib/budget/parse-date";
import { statusLabel, type MonthStatus } from "@/lib/budget/year";
import { cn } from "@/lib/cn";

export function MonthRail({
  months,
  active,
  statusOf,
  onPick,
}: {
  months: string[];
  active: string;
  statusOf: (ym: string) => MonthStatus;
  onPick: (ym: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5 md:grid-cols-12" role="listbox" aria-label="Months">
      {months.map((ym) => {
        const status = statusOf(ym);
        const on = ym === active;
        return (
          <button
            key={ym}
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => onPick(ym)}
            className={cn(
              "tap min-h-12 rounded-md border px-1 py-1.5 text-center transition-colors duration-150",
              on ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface hover:bg-chip",
            )}
          >
            <div className="text-xs font-medium">{monthShort(ym)}</div>
            <div className={cn("mt-0.5 text-xs leading-none", on ? "text-primary-fg/80" : statusTone(status))}>
              {status === "empty" ? "—" : status === "over" ? "Over" : status === "on-track" ? "Ok" : statusLabel(status)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function statusTone(status: MonthStatus) {
  if (status === "over") return "text-danger";
  if (status === "on-track") return "text-good";
  return "text-muted";
}
