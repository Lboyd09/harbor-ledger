import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useBudgetStore } from "@/store/budget-store";
import { Onboarding } from "./onboarding";
import { HarborMark } from "./harbor-mark";
import { Button } from "./ui/button";

export function WelcomeGate() {
  const loadSample = useBudgetStore((s) => s.loadSample);
  const restoreBackup = useBudgetStore((s) => s.restoreBackup);
  const patchProfile = useBudgetStore((s) => s.patchProfile);
  const chosen = useBudgetStore((s) => Boolean(s.profile.detailChosen));
  const detail = useBudgetStore((s) => s.profile.detail ?? "simple");
  const navigate = useNavigate();
  const [setup, setSetup] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (setup) return <Onboarding initialStep={0} />;

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

  function pick(mode: "simple" | "nerd") {
    patchProfile({ detail: mode, detailChosen: true });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8 md:py-12">
      <div className="flex items-center gap-2">
        <HarborMark className="size-5 text-primary" />
        <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
      </div>
      <h1 className="mt-4 font-display text-3xl font-semibold md:text-4xl">How much do you want to see?</h1>
      <p className="mt-3 text-muted">
        Setup walks you through the bank file, categories, and monthly amounts before the ledger opens. You can change this later in Account.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => pick("simple")}
          className={`feature-card min-h-24 rounded-lg border p-4 text-left ${chosen && detail !== "nerd" ? "border-primary bg-chip" : "border-border bg-surface"}`}
        >
          <div className="font-medium">Simple</div>
          <p className="mt-1 text-sm text-muted">One number, one sentence, and a short month-end note.</p>
        </button>
        <button
          type="button"
          onClick={() => pick("nerd")}
          className={`feature-card min-h-24 rounded-lg border p-4 text-left ${detail === "nerd" && chosen ? "border-primary bg-chip" : "border-border bg-surface"}`}
        >
          <div className="font-medium">More detail</div>
          <p className="mt-1 text-sm text-muted">The same ledger, plus extra charts and a sandbox that does not change your plan.</p>
        </button>
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        <li>Most categories start over each month. Keep leftovers is only for something you’re saving for.</li>
        <li>After a file is imported, Month walks you through anything without a category.</li>
        <li>Someone paid you back is a button on the charge, not a category.</li>
      </ul>
      <div className="mt-8 flex flex-col gap-2">
        <Button className="w-full" disabled={!chosen} onClick={() => setSetup(true)}>
          Set up my money
        </Button>
        <Button variant="outline" className="w-full" disabled={!chosen} onClick={() => void navigate({ to: "/login" })}>
          Sign in
        </Button>
        <Button variant="ghost" className="w-full" disabled={!chosen} onClick={() => loadSample()}>
          Try the demo
        </Button>
      </div>
      {!chosen ? <p className="mt-3 text-sm text-muted">Choose Simple or More detail first.</p> : null}
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
