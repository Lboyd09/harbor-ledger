/** A jar that fills from the bottom. Overflow sits above the rim. A negative balance leaves it empty with a red rim. */
export function FillJar({ pct, negative = false, overflow = false }: { pct: number; negative?: boolean; overflow?: boolean }) {
  const p = negative ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-24 w-16 shrink-0" aria-hidden>
      {overflow ? <div className="goal-fill absolute inset-x-1 -top-1.5 z-10 h-2 rounded-full bg-primary/70" /> : null}
      <div
        className={`relative h-24 w-16 overflow-hidden rounded-b-xl rounded-t-md border-2 bg-chip ${negative ? "border-danger/70" : "border-primary/50"}`}
      >
        <div className="goal-fill absolute inset-x-0 bottom-0 bg-primary/75" style={{ height: `${p}%` }} />
        <div className="absolute inset-x-2 top-1 h-1.5 rounded-full border border-primary/40 bg-surface/80" />
      </div>
    </div>
  );
}

/** Spent versus the monthly amount. The bar is the picture; the words are next to it. */
export function SpendMeter({ spent, plan }: { spent: number; plan: number }) {
  const over = plan > 0 && spent > plan + 0.004;
  const pct = plan > 0 ? Math.min(100, Math.round((Math.max(0, spent) / plan) * 100)) : spent > 0 ? 100 : 0;
  return (
    <div className="h-3 overflow-hidden rounded-full bg-chip" aria-hidden>
      <div className={`h-full ${over ? "bg-danger" : "bg-primary"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
