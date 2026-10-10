import { createFileRoute, Link } from "@tanstack/react-router";
import { simulatePayoff } from "@/lib/budget/grow-math";
import { formatMoney } from "@/lib/budget/money";
import { projectRetirement, retirementInputFrom } from "@/lib/budget/retirement";

export const Route = createFileRoute("/calculators/$name")({ component: PublicCalc });

const NAMES: Record<string, { title: string; example: string }> = {
  "debt-payoff": { title: "Debt payoff", example: "" },
  retirement: { title: "Retirement", example: "" },
  loan: { title: "Loan", example: "A $300,000 mortgage at 6.5% for 30 years is $1,896.20 a month." },
  "savings-goal": { title: "Savings goal", example: "$12,000 with $6,200 saved over 24 months is $241.67 a month." },
  "compound-growth": { title: "Compound growth", example: "$10,000 plus $200 a month at 7% for 10 years is $54,713.58." },
  "emergency-fund": { title: "Emergency fund", example: "$6,130 savings plus a $1,000 cushion fund over a $4,065 plan is 1.75 months." },
};

function PublicCalc() {
  const name = Route.useParams().name;
  const meta = NAMES[name] ?? { title: "Calculator", example: "Use your real numbers in BudgetFlow." };
  let example = meta.example;
  if (name === "debt-payoff") {
    const plan = simulatePayoff(
      [
        { id: "v", name: "Visa", balance: 1240, apr: 24.99, minimum: 40 },
        { id: "s", name: "Student loan", balance: 18500, apr: 5.5, minimum: 280 },
      ],
      150,
      "avalanche",
    );
    example = `Extra $150 a month: ${plan.months} months, ${formatMoney(plan.interest)} interest.`;
  }
  if (name === "retirement") {
    const read = retirementInputFrom({
      age: "29",
      retireAge: "67",
      saved: "18300",
      monthlySaving: "500",
      employerMatchPercent: "0",
      low: "4",
      mid: "7",
      high: "10",
      inflation: "2.5",
      incomeWantedYearly: "13521",
      socialSecurityMonthly: "",
      withdrawal: "4",
    });
    if (read.ok) {
      const likely = projectRetirement(read.input).paths[1];
      example = `Likely in today's dollars: ${formatMoney(likely.real)}.`;
    }
  }
  return (
    <div className="mx-auto max-w-lg space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl font-semibold">{meta.title}</h1>
      <p className="text-sm">{example}</p>
      <p className="text-sm text-muted">These pages do not read your saved budget.</p>
      <Link to="/" className="font-medium text-primary">
        Use your real numbers → Start my budget
      </Link>
    </div>
  );
}
