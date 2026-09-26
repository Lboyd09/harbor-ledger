import { Link } from "@tanstack/react-router";
import { useBudgetStore } from "@/store/budget-store";
import { Onboarding } from "./onboarding";
import { Button } from "./ui/button";
import { useState } from "react";

export function WelcomeGate() {
  const loadSample = useBudgetStore((s) => s.loadSample);
  const restoreBackup = useBudgetStore((s) => s.restoreBackup);
  const [setup, setSetup] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (setup) return <Onboarding />;

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
      <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
      <h1 className="mt-4 font-display text-3xl font-semibold md:text-4xl">Your money, in two columns.</h1>
      <p className="mt-3 text-muted">
        Income on one side. Expenses on the other. Import a bank CSV. Nothing logs into a bank.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        <li>Sign in if you already saved a ledger — you will not redo setup.</li>
        <li>Try it out loads sample charges so you can click around.</li>
        <li>Set up asks a few household questions, then opens the ledger on this device.</li>
      </ul>
      <div className="mt-8 flex flex-col gap-2">
        <Link to="/login">
          <Button className="w-full">Sign in</Button>
        </Link>
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
