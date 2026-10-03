/** A jar that fills from the bottom. Used for money that carries forward. */
export function FillJar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-b-xl rounded-t-md border-2 border-primary/50 bg-chip" aria-hidden>
      <div className="goal-fill absolute inset-x-0 bottom-0 bg-primary/75" style={{ height: `${p}%` }} />
      <div className="absolute inset-x-2 top-1 h-1.5 rounded-full border border-primary/40 bg-surface/80" />
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
