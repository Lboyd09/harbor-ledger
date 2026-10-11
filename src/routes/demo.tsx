import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { HomeDashboard } from "@/components/home-dashboard";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useBudgetStore } from "@/store/budget-store";

export const Route = createFileRoute("/demo")({ component: DemoPage });

function DemoPage() {
  const { user, isPending } = useCurrentUserState();
  const loadSample = useBudgetStore((s) => s.loadSample);
  const loaded = useRef(false);
  const signedIn = Boolean(user && !user.isDevFallback);
  const [ask, setAsk] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (isPending || signedIn || loaded.current) return;
    const before = localStorage.getItem("harbor-ledger-v3");
    if (before != null && !confirmed) {
      setAsk(true);
      return;
    }
    loaded.current = true;
    loadSample();
    if (before != null) localStorage.setItem("harbor-ledger-v3", before);
    else localStorage.removeItem("harbor-ledger-v3");
  }, [isPending, signedIn, loadSample, confirmed]);

  if (isPending) return null;
  if (signedIn) {
    return (
      <div className="mx-auto max-w-xl px-5 py-12 text-center">
        <h1 className="font-display text-2xl font-semibold">Demo is for trying the app</h1>
        <p className="mt-3 text-muted">You're signed in. Your saved budget stays put.</p>
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center text-sm underline">
          Back to Today
        </Link>
      </div>
    );
  }
  if (ask && !confirmed) {
    return (
      <div className="mx-auto max-w-xl px-5 py-12 text-center">
        <h1 className="font-display text-2xl font-semibold">Replace your budget with the sample?</h1>
        <p className="mt-3 text-muted">You already have a budget on this device. The sample will only show for this visit.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" className="min-h-11 rounded-md bg-primary px-4 text-primary-fg" onClick={() => { setConfirmed(true); setAsk(false); }}>
            Show sample
          </button>
          <Link to="/" className="inline-flex min-h-11 items-center rounded-md border border-border px-4">
            Keep mine
          </Link>
        </div>
      </div>
    );
  }
  return <HomeDashboard />;
}
