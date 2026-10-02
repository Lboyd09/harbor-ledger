import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useBudgetStore } from "@/store/budget-store";
import { Onboarding } from "./onboarding";
import { HarborMark } from "./harbor-mark";
import { Button } from "./ui/button";

export function WelcomeGate() {
  const loadSample = useBudgetStore((s) => s.loadSample);
  const restoreBackup = useBudgetStore((s) => s.restoreBackup);
  const navigate = useNavigate();
  const [setup, setSetup] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (setup) return <Onboarding initialStep={1} />;

  async function onRestore(file: File) {
    setRestoreError(null);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const result = restoreBackup(raw);
      if (!result.ok) setRestoreError(result.error);
    } catch {
      setRestoreError("That file is not valid JSON.");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8 md:py-12">
      <div className="flex items-center gap-2">
        <HarborMark className="size-5 text-primary" />
        <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
      </div>
      <h1 className="mt-4 font-display text-3xl font-semibold md:text-4xl">Your money, in two columns.</h1>
      <p className="mt-3 text-muted">
        A harbor is where you count what came in and what left. Income on one side. Expenses on the other. A bank CSV is
        enough. Nothing logs into a bank.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        <li>Divide one paycheck into two categories for that month. The overall category stays.</li>
        <li>Two charges with the same name can use different categories. Only that month changes.</li>
        <li>Payback lives at the bottom of the expense category list. The closest deposit is marked, and both leave the month.</li>
        <li>Plan holds the usual budget, a one-month change, and saving for a purchase.</li>
        <li>Account exports Excel and Google Sheets, and confirms your email. No paper code.</li>
      </ul>
      <div className="mt-8 flex flex-col gap-2">
        <Button className="w-full" onClick={() => void navigate({ to: "/login" })}>
          Sign in
        </Button>
        <Button variant="outline" className="w-full" onClick={() => loadSample()}>
          Try it out
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setSetup(true)}>
          Set up my household
        </Button>
      </div>
      <label className="mt-6 inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline-offset-2 hover:underline">
        Restore a backup JSON
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onRestore(f);
            e.target.value = "";
          }}
        />
      </label>
      {restoreError ? <p className="mt-2 text-sm text-danger">{restoreError}</p> : null}
    </div>
  );
}
