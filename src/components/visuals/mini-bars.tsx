import { formatMoney } from "@/lib/budget/money";
import { ShowNumbers } from "./show-numbers";

function barHeight(value: number, max: number) {
  if (value === 0) return 0;
  return Math.max(4, (Math.abs(value) / max) * 100);
}

export type MiniMonth = { label: string; a: number; b: number };

/** Two bars per month. Words name each bar so color is not the only clue. */
export function MiniBars({
  months,
  aLabel,
  bLabel,
  onSelect,
}: {
  months: MiniMonth[];
  aLabel: string;
  bLabel: string;
  onSelect?: (index: number) => void;
}) {
  const max = Math.max(1, ...months.flatMap((month) => [Math.abs(month.a), Math.abs(month.b)]));
  const sentence = `${aLabel} is the first bar. ${bLabel} is the second.`;
  return (
    <figure>
      <div className="flex items-end gap-1" role="img" aria-label={sentence}>
        {months.map((month, index) => {
          const body = (
            <>
              <div className="flex h-16 w-full items-end gap-0.5">
                <span className="w-1/2 rounded-sm bg-primary/80" style={{ height: `${barHeight(month.a, max)}%` }} />
                <span className="w-1/2 rounded-sm bg-warn/80" style={{ height: `${barHeight(month.b, max)}%` }} />
              </div>
              <span className="text-[10px] text-muted">{month.label}</span>
            </>
          );
          const label = `${month.label}. ${aLabel} ${formatMoney(month.a)}. ${bLabel} ${formatMoney(month.b)}.`;
          if (!onSelect) {
            return (
              <div key={`${month.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={label}>
                {body}
              </div>
            );
          }
          return (
            <button key={`${month.label}-${index}`} type="button" className="flex min-w-0 flex-1 flex-col items-center gap-1" aria-label={label} onClick={() => onSelect(index)}>
              {body}
            </button>
          );
        })}
      </div>
      <figcaption className="mt-1 text-xs text-muted">
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-primary/80" aria-hidden /> {aLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-warn/80" aria-hidden /> {bLabel}
        </span>
      </figcaption>
      <ShowNumbers
        caption={sentence}
        columns={["Month", aLabel, bLabel]}
        rows={months.map((month) => [month.label, formatMoney(month.a), formatMoney(month.b)])}
      />
    </figure>
  );
}
