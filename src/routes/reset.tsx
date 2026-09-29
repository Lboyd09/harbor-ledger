import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { requestPasswordReset, resetPasswordWithToken } from "@/lib/budget/email-links";
import { resetPasswordWithCode } from "@/lib/budget/persist";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type ResetSearch = { token?: string };

export const Route = createFileRoute("/reset")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: Reset,
});

function Reset() {
  const { token } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await requestPasswordReset({ data: { email } });
      if (!result.ok || !result.configured) {
        setError("error" in result && result.error ? result.error : "Could not send a reset link.");
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a reset link.");
    } finally {
      setBusy(false);
    }
  }

  async function onToken(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const result = await resetPasswordWithToken({ data: { token, newPassword: password } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await resetPasswordWithCode({ data: { email, code, newPassword: password } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">Reset password</h1>
      {done ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">Password updated. Sign in with the new one.</p>
          <Link to="/login">
            <Button className="w-full">Back to sign in</Button>
          </Link>
        </div>
      ) : token ? (
        <form className="mt-6 space-y-3" onSubmit={onToken}>
          <p className="text-sm text-muted">Choose a new password for this email account.</p>
          <Field label="New password">
            <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Updating…" : "Set new password"}
          </Button>
        </form>
      ) : (
        <div className="mt-6 space-y-8">
          <form className="space-y-3" onSubmit={onEmail}>
            <p className="text-sm text-muted">
              Email yourself a link. It works for one hour. Google and X sign-in do not use a password.
            </p>
            {sent ? <p className="text-sm text-good">If that email uses a Harbor password, the link is on its way.</p> : null}
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Email me a reset link"}
            </Button>
          </form>
          <form className="space-y-3 border-t border-border pt-6" onSubmit={onCode}>
            <p className="text-sm text-muted">Or use the recovery code from when you created the account.</p>
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Recovery code">
              <Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="HARBOR-XXXX-XXXX" autoCapitalize="characters" />
            </Field>
            <Field label="New password">
              <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            <Button type="submit" variant="outline" className="w-full" disabled={busy}>
              {busy ? "Updating…" : "Set password with code"}
            </Button>
          </form>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Link to="/login" className="text-sm text-muted underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </div>
      )}
    </main>
  );
}
