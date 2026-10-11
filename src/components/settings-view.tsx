import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { authClient, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { emailStatus, sendConfirmationEmail, sendOwnResetLink } from "@/lib/budget/email-links";
import { deleteAccount, issueRecoveryCode } from "@/lib/budget/persist";
import { HOUSEHOLD_LABELS, HOUSING_LABELS, STAGE_LABELS } from "@/lib/budget/presets";
import { formatMoney } from "@/lib/budget/money";
import { CarryStartControl } from "./carry-start";
import type { DetailMode, HarborLook, HarborMotion, TextSize } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { ExportBar } from "./export-bar";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";

const LOOKS: { id: HarborLook; label: string; note: string }[] = [
  { id: "harbor", label: "Light", note: "Warm paper" },
  { id: "dusk", label: "Dark", note: "Night" },
  { id: "auto", label: "Automatic", note: "Follows this device" },
];

export function SettingsView() {
  const profile = useBudgetStore((s) => s.profile);
  const setBudgetPeriod = useBudgetStore((s) => s.setBudgetPeriod);
  const reopenSetup = useBudgetStore((s) => s.reopenSetup);
  const patchProfile = useBudgetStore((s) => s.patchProfile);
  const user = useCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-display text-3xl font-semibold">Settings</h1>

      <section id="look" className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Look</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LOOKS.map((look) => {
            const on = (profile.accent ?? "harbor") === look.id;
            return (
              <button
                key={look.id}
                type="button"
                onClick={() => patchProfile({ accent: look.id })}
                className={`look-swatch look-${look.id} min-h-16 rounded-md border px-2 py-2 text-left ${on ? "ring-2 ring-primary" : "border-border"}`}
              >
                <span className="block text-sm font-medium">{look.label}</span>
                <span className="block text-xs opacity-80">{look.note}</span>
              </button>
            );
          })}
        </div>
        <Field label="Text size">
          <Select value={profile.textSize ?? "normal"} onChange={(e) => patchProfile({ textSize: e.target.value as TextSize })}>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra large</option>
          </Select>
        </Field>
        <Field label="Motion">
          <Select value={profile.motion ?? "calm"} onChange={(e) => patchProfile({ motion: e.target.value as HarborMotion })}>
            <option value="calm">Calm</option>
            <option value="lively">Lively</option>
          </Select>
        </Field>
        <Field label="Advanced tools">
          <Select value={profile.detail === "nerd" ? "nerd" : "simple"} onChange={(e) => patchProfile({ detail: e.target.value as DetailMode, detailChosen: true })}>
            <option value="simple">Simple</option>
            <option value="nerd">Advanced</option>
          </Select>
        </Field>
        <p className="text-sm text-muted">Advanced shows the math.</p>
      </section>

      <section id="household" className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Household</h2>
        <Field label="Name">
          <Input value={profile.ledgerName} onChange={(e) => patchProfile({ ledgerName: e.target.value })} />
        </Field>
        <p className="text-sm">
          {HOUSEHOLD_LABELS[profile.household]} · {STAGE_LABELS[profile.lifeStage]} · {HOUSING_LABELS[profile.housing]}
          {profile.dependents ? ` · ${profile.dependents} dependent${profile.dependents === 1 ? "" : "s"}` : ""}
        </p>
        <p className="text-sm text-muted">Expected {formatMoney(profile.monthlyIncome)} / month</p>
        <Field label="Review period">
          <Select value={profile.budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value as "month" | "week")}>
            <option value="month">Month to month</option>
            <option value="week">Week to week</option>
          </Select>
        </Field>
        <LeftoverStyle />
        <Button variant="outline" onClick={() => reopenSetup()}>
          Reopen setup
        </Button>
      </section>

      <section id="data" className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Data and sign-in</h2>
        <AccountPanel signedIn={Boolean(user)} email={user?.primaryEmail ?? ""} />
        <ExportBar />
        <Link to="/privacy" className="inline-flex text-sm font-medium text-primary">
          Privacy
        </Link>
      </section>

      <DangerZone signedIn={Boolean(user)} />
    </div>
  );
}

function LeftoverStyle() {
  const profile = useBudgetStore((s) => s.profile);
  const setBudgetStyle = useBudgetStore((s) => s.setBudgetStyle);
  const style = profile.budgetStyle === "buckets" ? "buckets" : "monthly";
  return (
    <section className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Unused money rolls into next month: {style === "buckets" ? "On" : "Off"}</h2>
      <Button type="button" variant="outline" aria-pressed={style === "buckets"} onClick={() => setBudgetStyle(style === "buckets" ? "monthly" : "buckets")}>
        {style === "buckets" ? "On" : "Off"}
      </Button>
      <p className="text-sm text-muted">Switching never deletes anything.</p>
      {profile.detail === "nerd" ? (
        <div>
          <h3 className="text-sm font-medium">When leftovers start</h3>
          <CarryStartControl />
        </div>
      ) : null}
    </section>
  );
}

function DangerZone({ signedIn }: { signedIn: boolean }) {
  const resetAll = useBudgetStore((s) => s.resetAll);
  const [arm, setArm] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <details className="rounded-lg border border-danger/30 bg-surface p-4">
      <summary className="min-h-11 cursor-pointer font-display text-xl font-semibold text-danger">Danger zone</summary>
      <p className="mt-3 text-sm">Download a backup first.</p>
      {arm ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm">Type RESET to erase this device. Your bank is not touched.</span>
          <Input aria-label="Type RESET to confirm" value={word} onChange={(e) => setWord(e.target.value)} />
          <Button
            variant="danger"
            size="sm"
            disabled={busy || word !== "RESET"}
            onClick={() => {
              setBusy(true);
              void resetAll()
                .then(() => {
                  setArm(false);
                  setNote("This device is cleared.");
                })
                .catch((err: unknown) => setNote(err instanceof Error ? err.message : "Could not reset this device."))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Erasing…" : "Erase ledger"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setArm(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button className="mt-3" variant="danger" size="sm" onClick={() => setArm(true)}>
          Reset this device
        </Button>
      )}
      {signedIn ? <p className="mt-3 text-sm">Delete account is with your sign-in, and it asks you to type DELETE.</p> : null}
      {note ? <p className="mt-2 text-sm">{note}</p> : null}
    </details>
  );
}

function AccountPanel({ signedIn, email }: { signedIn: boolean; email: string }) {
  const resetAll = useBudgetStore((s) => s.resetAll);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [mail, setMail] = useState<{ configured: boolean; verified: boolean } | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let cancel = false;
    void emailStatus()
      .then((status) => {
        if (!cancel) setMail({ configured: status.configured, verified: status.verified });
      })
      .catch(() => {
        if (!cancel) setMail(null);
      });
    return () => {
      cancel = true;
    };
  }, [signedIn]);

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

  async function onConfirm() {
    setError(null);
    setNote(null);
    setPreviewLink(null);
    setBusy(true);
    try {
      const result = await sendConfirmationEmail();
      if (result.previewLink) {
        setPreviewLink(result.previewLink);
        setNote("Your link:");
        return;
      }
      if (!result.configured) {
        setError(result.error ?? "Email is not connected yet.");
        return;
      }
      if (!result.sent) {
        setError(result.error ?? "Could not send the confirmation.");
        return;
      }
      setNote(`Confirmation link sent to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the confirmation.");
    } finally {
      setBusy(false);
    }
  }

  async function onResetLink() {
    setError(null);
    setNote(null);
    setPreviewLink(null);
    setBusy(true);
    try {
      const result = await sendOwnResetLink();
      if (result.previewLink) {
        setPreviewLink(result.previewLink);
        setNote("Your link:");
        return;
      }
      if (!result.ok || !result.configured) {
        setError(result.error ?? "Could not send the reset.");
        return;
      }
      setNote("If this email uses a password, a reset link is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset.");
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
      await resetAll();
      await signOut("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the account.");
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <section id="account" className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Account</h2>
        <p className="text-sm text-muted">Saved on this device. Sign in to sync.</p>
        <Link to="/login">
          <Button>Sign in or create an account</Button>
        </Link>
      </section>
    );
  }

  return (
    <section id="account" className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Account</h2>
        <p className="mt-1 text-sm text-muted">{email || "Signed in"} · the ledger saves here.</p>
        <p className="mt-2 text-sm">
          Email {mail?.verified ? "confirmed." : "not confirmed yet."}{" "}
          {mail?.configured
            ? "Mail is connected."
            : "Email isn't available yet. The link shows on this page."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void onConfirm()}>
            Email a confirmation link
          </Button>
          <Button variant="outline" size="sm" disabled={busy || !email} onClick={() => void onResetLink()}>
            Email a password reset link
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void signOut("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer font-display text-xl font-semibold">Change password</summary>
        <form className="mt-3 space-y-3" onSubmit={onChangePassword}>
          <p className="text-sm text-muted">Email sign-in only.</p>
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
      </details>

      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer font-display text-xl font-semibold">Optional backup code</summary>
        <p className="mt-3 text-sm text-muted">Optional. Shown once.</p>
        {recovery ? (
          <p className="mt-4 rounded-md border border-border bg-chip px-4 py-3 text-center font-display text-lg tracking-wide">
            {recovery}
          </p>
        ) : null}
        <Button className="mt-4" variant="outline" disabled={busy} onClick={() => void onRecovery()}>
          Issue a backup code
        </Button>
      </details>

      <form className="space-y-3 rounded-lg border border-danger/30 bg-surface p-4" onSubmit={onDelete}>
        <h2 className="font-display text-xl font-semibold text-danger">Delete account</h2>
        <p className="text-sm text-muted">Deletes your account and budget. Download first.</p>
        <Field label="Type DELETE to confirm">
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" variant="danger" disabled={busy || confirm.trim().toUpperCase() !== "DELETE"}>
          Delete account and ledger
        </Button>
      </form>

      {previewLink ? (
        <p className="break-all rounded-md border border-border bg-chip px-3 py-3 text-sm">
          <a href={previewLink} className="text-primary">
            {previewLink}
          </a>
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {note ? <p className="text-sm text-good">{note}</p> : null}
    </section>
  );
}
