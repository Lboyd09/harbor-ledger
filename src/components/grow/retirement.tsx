import { assumptionLines } from "@/lib/budget/reference";
import { tipsFor } from "@/lib/budget/tips";
import { RetirementCard } from "../retirement-card";
import { useGrow } from "./grow-context";

export function RetirementPage() {
  const { tipFacts } = useGrow();
  const tips = tipsFor("retirement", tipFacts);
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold">Where do you stand for retirement?</h2>
      <RetirementCard />
      <section>
        <h3 className="text-sm font-medium">Tips</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {tips.map((tip) => (
            <li key={tip.id}>
              {tip.text} <span className="text-xs text-muted">{tip.status}.</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-muted">Not personal advice.</p>
      <details className="rounded-lg border border-border bg-surface p-3">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">Assumptions</summary>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {assumptionLines(["withdrawal", "inflation", "market-expected", "ss-full"]).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
