import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { issueRecoveryCode } from "@/lib/budget/persist";
import { formatMoney } from "@/lib/budget/money";
import { plannedTotals } from "@/lib/budget/totals";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type LoginSearch = { from?: string };

function grokBrokerAvailable() {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith(".grok-sandbox.com");
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  component: Login,
});

function Login() {
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const fromOnboarding = from === "onboarding";
  const { user } = useCurrentUserState();
  const profile = useBudgetStore((s) => s.profile);
  const categories = useBudgetStore((s) => s.categories);
  const reopenSetup = useBudgetStore((s) => s.reopenSetup);
  const [mode, setMode] = useState<"in" | "up">(fromOnboarding ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [hold, setHold] = useState(false);
  const plan = plannedTotals(categories, "month");
  const showBroker = grokBrokerAvailable();

  if (user && !recovery && !hold && !busy) return <Navigate to="/" />;

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        setHold(true);
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: email.trim().split("@")[0] || "Harbor",
        });
        if (err) throw new Error(err.message || "Could not create the account.");
        await authClient.getSession();
        const issued = await issueRecoveryCode();
        if (issued.ok) setRecovery(issued.code);
        else setError(issued.error);
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) throw new Error(err.message || "Could not sign in.");
        await authClient.getSession();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (recovery) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">Save this recovery code</h1>
        <p className="mt-3 text-sm text-muted">
          This app does not send reset emails. This code is the only way to set a new password if you forget it. Copy
          it somewhere private — it will not be shown again.
        </p>
        <p className="mt-6 rounded-lg border border-border bg-surface px-4 py-4 text-center font-display text-xl tracking-wide">
          {recovery}
        </p>
        <Button className="mt-6" onClick={() => navigator.clipboard.writeText(recovery)}>
          Copy code
        </Button>
        <Link to="/" className="mt-3">
          <Button variant="outline" className="w-full">
            I saved it — open the ledger
          </Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-bg text-fg md:grid md:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-border bg-surface px-12 py-12 md:flex">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
          <h1 className="mt-6 max-w-md font-display text-4xl font-semibold leading-tight">
            {fromOnboarding ? "Your outlook is ready. Keep it." : "A private ledger for the files your bank already gives you."}
          </h1>
          <p className="mt-4 max-w-md text-muted">
            {fromOnboarding
              ? "Create an account so this setup is not stuck on this phone. Then import a CSV whenever you want."
              : "Import a CSV, assign every dollar a job, and read the month and the year. Nothing logs into a bank."}
          </p>
          {fromOnboarding && profile.completedOnboarding ? (
            <dl className="mt-8 max-w-sm space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Ledger</dt>
                <dd className="font-medium">{profile.ledgerName || "My ledger"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Take-home</dt>
                <dd className="tabular">{formatMoney(profile.monthlyIncome)} / month</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Planned leftover</dt>
                <dd className="tabular">{formatMoney(plan.leftover, { signed: true })}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Review</dt>
                <dd>{profile.budgetPeriod === "week" ? "Week to week" : "Month to month"}</dd>
              </div>
            </dl>
          ) : null}
        </div>
        <ul className="max-w-sm space-y-3 text-sm text-muted">
          <li>Saved to your account after you sign up — not this browser alone.</li>
          <li>Keyword matching you can override — no model guessing.</li>
          <li>{showBroker ? "Google, X, or email. Recovery code instead of reset mail." : "Email and a recovery code. No reset emails."}</li>
        </ul>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 md:px-16">
        <p className="text-sm font-medium uppercase tracking-widest text-muted md:hidden">Harbor Ledger</p>
        {fromOnboarding ? (
          <p className="mt-2 rounded-md bg-chip px-3 py-2 text-sm md:hidden">
            {profile.ledgerName || "Your ledger"} is set up. Create an account to keep it.
          </p>
        ) : null}
        <h2 className="mt-2 font-display text-3xl font-semibold">
          {fromOnboarding ? (mode === "up" ? "Create your account" : "Sign in to keep it") : mode === "in" ? "Sign in" : "Create an account"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {fromOnboarding
            ? "Optional, but this is how the ledger follows you off this device."
            : mode === "in"
              ? "Your ledger stays on this account."
              : "Takes a minute. You will get a recovery code."}
        </p>

        {authEnabled && showBroker ? (
          <div className="mt-6 flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))}
          </div>
        ) : !authEnabled ? (
          <p className="mt-6 text-sm text-muted">Sign-in is disabled.</p>
        ) : null}

        {showBroker ? (
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
            <span className="h-px flex-1 bg-border" />
            or email
            <span className="h-px flex-1 bg-border" />
          </div>
        ) : (
          <div className="mt-6" />
        )}

        <form className="space-y-3" onSubmit={onEmail}>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy || !authEnabled}>
            {busy ? "Working…" : mode === "in" ? "Sign in with email" : "Create account and save ledger"}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            className="text-muted underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setError(null);
            }}
          >
            {mode === "in" ? "Need an account?" : "Already have an account?"}
          </button>
          <Link to="/reset" className="text-muted underline-offset-2 hover:underline">
            Forgot password
          </Link>
        </div>
        {fromOnboarding ? (
          <button
            type="button"
            className="mt-6 text-left text-sm text-muted underline-offset-2 hover:underline"
            onClick={() => {
              reopenSetup();
              void navigate({ to: "/" });
            }}
          >
            Change setup answers
          </button>
        ) : null}
      </section>
    </main>
  );
}
