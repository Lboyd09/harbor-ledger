import { useLivelyMotion } from "../use-lively-motion";

const TONE = {
  primary: "var(--color-primary)",
  good: "var(--color-good)",
  warn: "var(--color-warn)",
  danger: "var(--color-danger)",
} as const;

/** A ring that fills from empty on first view when motion is lively. */
export function ProgressRing({
  pct,
  label,
  tone = "primary",
}: {
  pct: number;
  label: string;
  tone?: keyof typeof TONE;
}) {
  const lively = useLivelyMotion();
  const p = Math.max(0, Math.min(100, pct));
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - p / 100);
  return (
    <figure className="inline-flex flex-col items-center gap-1">
      <svg viewBox="0 0 40 40" className="size-16" role="img" aria-label={label}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-chip)" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={TONE[tone]}
          strokeWidth="4"
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
          strokeDasharray={c}
          className={lively ? "ring-draw" : undefined}
          style={{
            strokeDashoffset: offset,
            ["--ring-from" as string]: c,
            ["--ring-to" as string]: offset,
          }}
        />
      </svg>
      <figcaption className="max-w-36 text-center text-xs text-muted">{label}</figcaption>
    </figure>
  );
}
