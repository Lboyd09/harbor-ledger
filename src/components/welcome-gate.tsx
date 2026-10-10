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
  const [started, setStarted] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (started) return <Onboarding onExit={() => setStarted(false)} />;

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
        <p className="text-sm font-medium uppercase tracking-widest text-muted">BudgetFlow</p>
      </div>
      <h1 className="mt-4 font-display text-3xl font-semibold md:text-4xl">Let's set up your budget</h1>
      <p className="mt-3 text-muted">
        5 minutes. No bank login.
      </p>
      <div className="mt-8">
        <Button className="w-full" onClick={() => setStarted(true)}>
          Get started
        </Button>
      </div>
      <div className="mt-6 flex flex-col items-start gap-2 text-sm">
        <button type="button" className="min-h-11 text-muted underline-offset-2 hover:underline" onClick={() => loadSample()}>
          Try the demo
        </button>
        <button type="button" className="min-h-11 text-muted underline-offset-2 hover:underline" onClick={() => void navigate({ to: "/login" })}>
          Sign in
        </button>
        <label className="flex min-h-11 cursor-pointer items-center text-muted underline-offset-2 hover:underline">
          Restore a backup
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
        {restoreError ? <p className="text-sm text-danger">{restoreError}</p> : null}
      </div>
    </div>
  );
}
