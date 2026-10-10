import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/calculators/")({ component: CalculatorsIndex });

const PAGES = [
  ["debt-payoff", "Debt payoff"],
  ["retirement", "Retirement"],
  ["loan", "Loan"],
  ["savings-goal", "Savings goal"],
  ["compound-growth", "Compound growth"],
  ["emergency-fund", "Emergency fund"],
] as const;

function CalculatorsIndex() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl font-semibold">Calculators</h1>
      <ul className="space-y-2 text-sm">
        {PAGES.map(([id, label]) => (
          <li key={id}>
            <Link to="/calculators/$name" params={{ name: id }} className="font-medium text-primary">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
