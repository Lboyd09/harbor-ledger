import { formatMoney } from "@/lib/budget/money";
import { ShowNumbers } from "./show-numbers";

export type StackPart = { label: string; value: number; tone?: "primary" | "good" | "warn" | "danger" | "muted" };

const FILL = {
  primary: "bg-primary",
  good: "bg-good",
  warn: "bg-warn",
  danger: "bg-danger",
  muted: "bg-line",
} as const;

/** One bar made of named parts. The list under it repeats the picture in words. */
export function StackedBar({ parts }: { parts: StackPart[] }) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  const sentence = parts.map((part) => `${part.label} ${formatMoney(part.value)}`).join(". ");
  return (
    <figure>
      <div className="flex h-4 overflow-hidden rounded-full bg-chip" role="img" aria-label={sentence || "Nothing to show"}>
        {parts.map((part) =>
          part.value > 0 && total > 0 ? (
            <span
              key={part.label}
              className={FILL[part.tone ?? "primary"]}
              style={{ width: `${(Math.max(0, part.value) / total) * 100}%` }}
              title={`${part.label} ${formatMoney(part.value)}`}
            />
          ) : null,
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {parts.map((part) => (
          <span key={part.label}>
            {part.label}: {formatMoney(part.value)}
          </span>
        ))}
      </figcaption>
      <ShowNumbers caption={sentence || "Nothing to show."} columns={["Part", "Amount"]} rows={parts.map((part) => [part.label, formatMoney(part.value)])} />
    </figure>
  );
}
