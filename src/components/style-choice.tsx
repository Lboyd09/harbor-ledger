import type { BudgetStyle } from "@/lib/budget/types";
import { FillJar, SpendMeter } from "./money-visual";

export function StyleChoice({ value, onChange }: { value: BudgetStyle | null; onChange: (next: BudgetStyle) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={`min-h-36 rounded-lg border p-4 text-left ${value === "monthly" ? "border-primary bg-chip" : "border-border bg-surface"}`}
      >
        <div className="font-medium">Monthly budgets</div>
        <p className="mt-1 text-sm text-muted">Resets every month. A bar shows what you spent of the amount you allowed.</p>
        <div className="mt-3">
          <SpendMeter spent={40} plan={100} />
        </div>
      </button>
      <button
        type="button"
        onClick={() => onChange("buckets")}
        className={`flex min-h-36 gap-3 rounded-lg border p-4 text-left ${value === "buckets" ? "border-primary bg-chip" : "border-border bg-surface"}`}
      >
        <FillJar pct={55} />
        <div>
          <div className="font-medium">Buckets</div>
          <p className="mt-1 text-sm text-muted">Keeps what you don’t spend. The jar fills as the money stays.</p>
        </div>
      </button>
    </div>
  );
}
