import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, PiggyBank, Settings, Sprout, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { HarborMark } from "./harbor-mark";
import { Onboarding } from "./onboarding";
import { WelcomeGate } from "./welcome-gate";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/plan", label: "Budget", icon: Wallet },
  { to: "/funds", label: "Funds", icon: PiggyBank },
  { to: "/grow", label: "Grow", icon: Sprout },
  { to: "/settings", label: "Account", icon: Settings },
] as const;

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="h-8 w-24 animate-pulse rounded-full bg-chip" />;
  if (!user) {
    return (
      <Link
        to="/login"
        className="tap inline-flex min-h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium"
      >
        Sign in
      </Link>
    );
  }
  return <UserButton />;
}

function SavePill() {
  const saveState = useBudgetStore((s) => s.saveState);
  const { user } = useCurrentUserState();
  if (!user) return <span className="text-xs text-muted">On this device</span>;
  if (saveState === "saving") return <span className="text-xs text-muted">Saving</span>;
  if (saveState === "saved") return <span className="text-xs text-muted">Saved</span>;
  if (saveState === "error") return <span className="text-xs text-danger">Save failed</span>;
  return null;
}

function SetupEntry() {
  const txCount = useBudgetStore((s) => s.transactions.length);
  const catCount = useBudgetStore((s) => s.categories.length);
  const [fresh] = useState(() => txCount === 0 && catCount === 0);
  if (fresh) return <WelcomeGate />;
  return <Onboarding />;
}

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const hydrated = useBudgetStore((s) => s.hydrated);
  const loadRemote = useBudgetStore((s) => s.loadRemote);
  const hydrateLocal = useBudgetStore((s) => s.hydrateLocal);
  const done = useBudgetStore((s) => s.profile.completedOnboarding);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current =
    path === "/" || path === "/categories" || path === "/import"
      ? "Home"
      : path === "/funds"
        ? "Funds"
        : path === "/year"
          ? "Year"
          : (NAV.find((n) => n.to === path)?.label ?? "Harbor");
  const ledgerName = useBudgetStore((s) => s.profile.ledgerName);
  const accent = useBudgetStore((s) => s.profile.accent ?? "harbor");
  const motion = useBudgetStore((s) => s.profile.motion ?? "lively");
  const userId = user?.id ?? null;
  const publicAuth = path === "/login" || path === "/reset" || path === "/confirm";

  useEffect(() => {
    if (isPending) return;
    if (userId) {
      void loadRemote();
      return;
    }
    hydrateLocal();
  }, [userId, isPending, loadRemote, hydrateLocal]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    root.dataset.motion = motion;
  }, [accent, motion]);

  if (publicAuth) {
    return <Outlet />;
  }

  if (!hydrated || (isPending && !user)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bg px-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
        <p className="font-display text-2xl font-semibold">Opening Harbor…</p>
      </div>
    );
  }

  if (!done) {
    if (!user) return <SetupEntry />;
    return <Onboarding />;
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface md:flex">
        <div className="px-5 py-6">
          <div className="flex items-center gap-2">
            <HarborMark className="size-5 text-primary" />
            <div className="font-display text-xl font-semibold">Harbor</div>
          </div>
          <div className="truncate text-xs text-muted">{ledgerName || "Ledger"}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on =
              item.to === "/"
                ? path === "/" || path === "/categories" || path === "/import"
                : path === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm",
                  on ? "bg-chip text-fg" : "text-muted hover:bg-chip hover:text-fg",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 space-y-2 border-t border-border px-3 py-4">
          <SavePill />
          <AuthSlot />
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <HarborMark className="size-5 text-primary" />
          <div>
            <div className="font-display text-lg font-semibold">Harbor</div>
            <div className="text-xs text-muted">{current}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SavePill />
          <AuthSlot />
        </div>
      </header>

      <main className="px-4 pb-28 pt-4 md:ml-64 md:px-8 md:pb-10 md:pt-8">
        {!user ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-sm">This ledger stays on this device until you sign in.</p>
            <Link to="/login" className="text-sm font-medium text-primary">
              Sign in to save
            </Link>
          </div>
        ) : null}
        <Outlet />
      </main>

      <nav className="safe-nav fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border bg-surface md:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const on = item.to === "/" ? path === "/" || path === "/categories" || path === "/import" : path === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                on ? "text-primary" : "text-muted",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
