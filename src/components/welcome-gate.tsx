import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useBudgetStore } from "@/store/budget-store";
import { Onboarding } from "./onboarding";
import { HarborMark } from "./harbor-mark";
import { Button } from "./ui/button";

export function WelcomeGate() {
  const loadSample = useBudgetStore((s) => s.loadSample);
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);

  if (started) return <Onboarding onExit={() => setStarted(false)} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8 md:py-12">
      <div className="flex items-center gap-2">
        <HarborMark className="size-5 text-primary" />
        <p className="text-sm font-medium uppercase tracking-widest text-muted">BudgetFlow</p>
      </div>
      <div className="ml-auto">
        <button type="button" className="min-h-11 text-sm text-muted" onClick={() => void navigate({ to: "/login" })}>
          Sign in
        </button>
      </div>
      <h1 className="mt-4 font-display text-3xl font-semibold md:text-4xl">Know what's safe to spend. No bank login.</h1>
      <p className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-border px-3 py-1">No bank login</span>
        <span className="rounded-full border border-border px-3 py-1">Works with any bank's file</span>
        <span className="rounded-full border border-border px-3 py-1">Delete anytime</span>
      </p>
      <div className="mt-8">
        <Button className="w-full" onClick={() => setStarted(true)}>
          Start my budget
        </Button>
      </div>
      <div className="mt-6 flex flex-col items-start gap-2 text-sm">
        <button type="button" className="min-h-11 text-muted underline-offset-2 hover:underline" onClick={() => loadSample()}>
          Just look around with sample data
        </button>
        <a href="/privacy" className="min-h-11 text-muted underline-offset-2 hover:underline">
          Privacy
        </a>
      </div>
    </div>
  );
}
