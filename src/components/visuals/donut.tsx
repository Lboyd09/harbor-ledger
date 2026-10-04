import { formatMoney } from "@/lib/budget/money";
import { topSlices, type SlicePart } from "@/lib/budget/visual-data";
import { ShowNumbers } from "./show-numbers";

const COLORS = ["var(--color-slice-1)", "var(--color-slice-2)", "var(--color-slice-3)", "var(--color-slice-4)", "var(--color-slice-5)", "var(--color-slice-6)", "var(--color-muted)"];

function slicePath(start: number, end: number) {
  const r = 16;
  const cx = 20;
  const cy = 20;
  const sweep = end - start;
  if (sweep >= Math.PI * 2 - 0.0001) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  }
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/** Up to six slices, then “Everything else”. The legend repeats every slice in words. */
export function Donut({
  parts,
  centerLabel,
  onPick,
}: {
  parts: SlicePart[];
  centerLabel: string;
  onPick?: (part: SlicePart) => void;
}) {
  const slices = topSlices(
    parts.filter((part) => part.value > 0.004),
    6,
  );
  const total = slices.reduce((sum, part) => sum + part.value, 0);
  let angle = -Math.PI / 2;
  const drawn = slices.map((part, index) => {
    const sweep = total > 0 ? (part.value / total) * Math.PI * 2 : 0;
    const start = angle;
    angle += sweep;
    return { part, start, end: angle, color: COLORS[index] ?? COLORS.at(-1)! };
  });
  const sentence = slices.length ? slices.map((part) => `${part.label} ${formatMoney(part.value)}`).join(". ") : "Nothing to show yet.";
  return (
    <figure>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <svg viewBox="0 0 40 40" className="size-36 shrink-0" role="img" aria-label={`${centerLabel}. ${sentence}`}>
          <circle cx="20" cy="20" r="16" fill="var(--color-chip)" />
          {drawn.map((slice) =>
            onPick ? (
              <path
                key={slice.part.label}
                d={slicePath(slice.start, slice.end)}
                fill={slice.color}
                className="cursor-pointer"
                onClick={() => onPick(slice.part)}
              >
                <title>{`${slice.part.label} ${formatMoney(slice.part.value)}`}</title>
              </path>
            ) : (
              <path key={slice.part.label} d={slicePath(slice.start, slice.end)} fill={slice.color}>
                <title>{`${slice.part.label} ${formatMoney(slice.part.value)}`}</title>
              </path>
            ),
          )}
          <circle cx="20" cy="20" r="9" fill="var(--color-surface)" />
          <text x="20" y="21" textAnchor="middle" fontSize="3.2" fill="var(--color-fg)">
            {centerLabel}
          </text>
        </svg>
        <ul className="w-full space-y-1 text-sm">
          {drawn.map((slice) => (
            <li key={slice.part.label}>
              {onPick ? (
                <button type="button" className="flex w-full min-h-11 items-center justify-between gap-2 text-left" onClick={() => onPick(slice.part)}>
                  <span className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-sm" style={{ background: slice.color }} aria-hidden />
                    {slice.part.label}
                  </span>
                  <span className="tabular">{formatMoney(slice.part.value)}</span>
                </button>
              ) : (
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-sm" style={{ background: slice.color }} aria-hidden />
                    {slice.part.label}
                  </span>
                  <span className="tabular">{formatMoney(slice.part.value)}</span>
                </span>
              )}
            </li>
          ))}
          {drawn.length === 0 ? <li className="text-muted">Nothing to show yet.</li> : null}
        </ul>
      </div>
      <ShowNumbers caption={sentence} columns={["Part", "Amount"]} rows={slices.map((part) => [part.label, formatMoney(part.value)])} />
    </figure>
  );
}
