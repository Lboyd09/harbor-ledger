import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { authClient, signOut } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { deleteAccount, issueRecoveryCode } from "@/lib/budget/persist";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ExportBar } from "@/components/export-bar";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  const user = useCurrentUser();
  const resetAll = useBudgetStore((s) => s.resetAll);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNote(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const client = authClient as typeof authClient & {
        changePassword: (opts: {
          currentPassword: string;
          newPassword: string;
          revokeOtherSessions?: boolean;
        }) => Promise<{ error: { message?: string } | null }>;
      };
      const { error: err } = await client.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (err) throw new Error(err.message || "Could not change password.");
      setCurrent("");
      setNext("");
      setNote("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  }

  async function onRecovery() {
    setError(null);
    setBusy(true);
    try {
      const issued = await issueRecoveryCode();
      if (!issued.ok) {
        setError(issued.error);
        return;
      }
      setRecovery(issued.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue a code.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await deleteAccount({ data: { confirm } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      resetAll();
      await signOut("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-muted">Account</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Your Harbor</h1>
          <p className="mt-2 text-sm text-muted">
            {user?.primaryEmail || user?.displayName || "Signed in"} · the ledger saves to this account.
          </p>
        </div>
        <UserButton />
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-semibold">Change password</h2>
        <p className="mt-1 text-sm text-muted">
          For email accounts. Google and X sign-in have no password here — use Forgot password only with a recovery
          code.
        </p>
        <form className="mt-4 space-y-3" onSubmit={onChangePassword}>
          <Field label="Current password">
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
          <Field label="New password">
            <Input type="password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={busy}>
            Update password
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-semibold">Recovery code</h2>
        <p className="mt-1 text-sm text-muted">
          Shown once. Issuing a new code retires the previous one. Store it offline.
        </p>
        {recovery ? (
          <p className="mt-4 rounded-md border border-border bg-chip px-4 py-3 text-center font-display text-lg tracking-wide">
            {recovery}
          </p>
        ) : null}
        <Button className="mt-4" variant="outline" disabled={busy} onClick={() => void onRecovery()}>
          Issue a new recovery code
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-semibold">Export</h2>
        <p className="mt-1 text-sm text-muted">Download a copy any time. Publishing to Vercel does not change this.</p>
        <div className="mt-3">
          <ExportBar />
        </div>
      </section>

      <section className="rounded-lg border border-danger/30 bg-surface p-5">
        <h2 className="font-display text-xl font-semibold text-danger">Delete account</h2>
        <p className="mt-1 text-sm text-muted">
          Permanently removes this sign-in and every transaction, category, and rule saved to it. Export first if you
          might want the file later.
        </p>
        <form className="mt-4 space-y-3" onSubmit={onDelete}>
          <Field label='Type DELETE to confirm'>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" variant="danger" disabled={busy || confirm.trim().toUpperCase() !== "DELETE"}>
            Delete account and ledger
          </Button>
        </form>
      </section>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {note ? <p className="text-sm text-good">{note}</p> : null}

      <Link to="/" className="inline-block text-sm text-muted underline-offset-2 hover:underline">
        Back to the ledger
      </Link>
    </div>
  );
}
