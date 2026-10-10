import { createFileRoute, Navigate } from "@tanstack/react-router";
import { WelcomeGate } from "@/components/welcome-gate";
import { useBudgetStore } from "@/store/budget-store";

export const Route = createFileRoute("/welcome")({ component: WelcomePage });

function WelcomePage() {
  const ready = useBudgetStore((s) => s.profile.completedOnboarding);
  if (ready) return <Navigate to="/" />;
  return <WelcomeGate />;
}
