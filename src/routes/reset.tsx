import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { resetPasswordWithCode } from "@/lib/budget/persist";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export const Route = createFileRoute("/reset")({ component: Reset });

function Reset() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await resetPasswordWithCode({
        data: { email, code, newPassword: password },
      });
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
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">
            Use the recovery code shown when you created the email account. Harbor does not send reset emails. Google
            and X sign-in do not use a password.
          </p>
          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Recovery code">
              <Input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="HARBOR-XXXX-XXXX"
                autoCapitalize="characters"
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Updating…" : "Set new password"}
            </Button>
          </form>
          <Link to="/login" className="mt-4 text-sm text-muted underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </>
      )}
    </main>
  );
}
