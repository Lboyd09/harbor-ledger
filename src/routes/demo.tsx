import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { HomeDashboard } from "@/components/home-dashboard";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useBudgetStore } from "@/store/budget-store";

export const Route = createFileRoute("/demo")({ component: DemoPage });

function DemoPage() {
  const { user, isPending } = useCurrentUserState();
  const loadSample = useBudgetStore((s) => s.loadSample);
  const loaded = useRef(false);
  const signedIn = Boolean(user && !user.isDevFallback);

  useEffect(() => {
    if (isPending || signedIn || loaded.current) return;
    loaded.current = true;
    const before = localStorage.getItem("harbor-ledger-v3");
    loadSample();
    if (before != null) localStorage.setItem("harbor-ledger-v3", before);
    else localStorage.removeItem("harbor-ledger-v3");
  }, [isPending, signedIn, loadSample]);

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
  return <HomeDashboard />;
}
