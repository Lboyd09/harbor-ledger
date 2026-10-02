import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SummaryCard({
  label,
  value,
  sentence,
  warn,
  tone,
  children,
}: {
  label: string;
  value: string;
  sentence: string;
  warn?: boolean;
  tone?: "in" | "out";
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={cn("rounded-lg border bg-surface p-4", tone === "in" ? "border-good/40" : tone === "out" ? "border-danger/30" : "border-border")}>
      <div className={cn("text-xs font-medium uppercase tracking-wide", tone === "in" ? "text-good" : tone === "out" ? "text-danger" : "text-muted")}>
        {label}
      </div>
      <div className={cn("mt-1 font-display text-3xl font-semibold tabular", warn && "text-danger", tone === "in" && !warn && "text-good")}>
        {value}
      </div>
      <p className="mt-1 text-sm text-muted">{sentence}</p>
      {children ? (
        <div className="mt-2">
          <button type="button" className="min-h-9 text-sm font-medium text-primary" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide details" : "Show details"}
          </button>
          {open ? <div className="detail-in mt-3 space-y-3">{children}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
