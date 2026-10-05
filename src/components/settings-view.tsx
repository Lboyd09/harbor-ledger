import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { authClient, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  ACCOUNT_KIND_OPTIONS,
  accountHasActivity,
  accountKindLabel,
  latestBalance,
  totalBalance,
} from "@/lib/budget/accounts";
import { emailStatus, sendConfirmationEmail, sendOwnResetLink } from "@/lib/budget/email-links";
import { deleteAccount, issueRecoveryCode } from "@/lib/budget/persist";
import { HOUSEHOLD_LABELS, HOUSING_LABELS, STAGE_LABELS } from "@/lib/budget/presets";
import { formatMoney } from "@/lib/budget/money";
import { DEFAULT_INFLATION, DEFAULT_RETIRE_AGE, DEFAULT_WITHDRAWAL, PLANNING_MARKET } from "@/lib/budget/reference";
import { TERMS } from "@/lib/copy/terms";
import { CarryStartControl } from "./carry-start";
import type { AccountKind, DetailMode, HarborLook, HarborMotion } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { ExportBar } from "./export-bar";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";

const LOOKS: { id: HarborLook; label: string; note: string }[] = [
  { id: "harbor", label: "Harbor", note: "Warm paper" },
  { id: "tide", label: "Tide", note: "Cool water" },
  { id: "brass", label: "Brass", note: "Lamp light" },
  { id: "dusk", label: "Dusk", note: "Night ledger" },
  { id: "meadow", label: "Meadow", note: "Soft green" },
  { id: "midnight", label: "Midnight", note: "Deep blue" },
];

export function SettingsView() {
  const profile = useBudgetStore((s) => s.profile);
  const setBudgetPeriod = useBudgetStore((s) => s.setBudgetPeriod);
  const reopenSetup = useBudgetStore((s) => s.reopenSetup);
  const patchProfile = useBudgetStore((s) => s.patchProfile);
  const user = useCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Account & settings</h1>
        <p className="mt-2 text-sm text-muted">
          Import, categories, how much detail to show, and the file for Excel or Google Sheets.
        </p>
        <YourAccounts />
        <YourNumbers />
        <LeftoverStyle />
        <section className="mt-4 space-y-2 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">Do this next</h2>
          <p className="text-sm text-muted">If a file is already in, start with categories. Then set monthly amounts.</p>
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/import" className="font-medium text-primary">Import a bank CSV</Link>
            <Link to="/" className="font-medium text-primary">Home — this month, merchants, and a bank file</Link>
            <Link to="/budget" className="font-medium text-primary">Budget — this month</Link>
            <Link to="/funds" className="font-medium text-primary">Funds — money that keeps what’s left</Link>
            <Link to="/rules" className="font-medium text-primary">Sorting rules — one category for a store</Link>
            <Link to="/grow" className="font-medium text-primary">Grow — debt, net worth, and calculators</Link>
          </div>
        </section>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <a href="#account" className="rounded-md border border-border bg-surface px-3 py-2">
            Account
          </a>
          <a href="#files" className="rounded-md border border-border bg-surface px-3 py-2">
            Excel & Sheets
          </a>
          <a href="#look" className="rounded-md border border-border bg-surface px-3 py-2">
            Look
          </a>
          <a href="#mode" className="rounded-md border border-border bg-surface px-3 py-2">
            Show advanced tools
          </a>
          <a href="#ledger" className="rounded-md border border-border bg-surface px-3 py-2">
            Ledger
          </a>
        </div>
      </div>

      <AccountPanel signedIn={Boolean(user)} email={user?.primaryEmail ?? ""} />

      <div id="files" className="space-y-3">
        <ExportBar />
        <Link to="/year" className="inline-flex text-sm font-medium text-primary">
          Look back at the calendar year
        </Link>
      </div>

      <section id="look" className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Look</h2>
        <p className="text-sm text-muted">The numbers stay the same. This only changes the paper.</p>
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
        <Field label="Motion">
          <Select
            value={profile.motion ?? "lively"}
            onChange={(e) => patchProfile({ motion: e.target.value as HarborMotion })}
          >
            <option value="lively">Lively — pages settle in</option>
            <option value="calm">Calm — almost still</option>
          </Select>
        </Field>
      </section>

      <section id="mode" className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Show advanced tools</h2>
        <p className="text-sm text-muted">
          Simple keeps the short notes. Advanced adds the workings. Payback, splits, merchants, and the year page stay available either way.
        </p>
        <Field label="Advanced tools">
          <Select
            value={profile.detail === "nerd" ? "nerd" : "simple"}
            onChange={(e) => patchProfile({ detail: e.target.value as DetailMode, detailChosen: true })}
          >
            <option value="simple">Simple</option>
            <option value="nerd">Advanced</option>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link to="/rules" className="font-medium text-primary">
            Merchants
          </Link>
          <Link to="/import" className="font-medium text-primary">
            Import a CSV
          </Link>
          <Link to="/grow" className="font-medium text-primary">
            Grow calculators
          </Link>
        </div>
      </section>

      <section id="ledger" className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Ledger</h2>
        <Field label="Name">
          <Input value={profile.ledgerName} onChange={(e) => patchProfile({ ledgerName: e.target.value })} />
        </Field>
        <p className="text-xs text-muted">The name saves as you type.</p>
        <Field label="Review period">
          <Select value={profile.budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value as "month" | "week")}>
            <option value="month">Month to month</option>
            <option value="week">Week to week</option>
          </Select>
        </Field>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Household</h2>
        <p className="text-sm">
          {HOUSEHOLD_LABELS[profile.household]} · {STAGE_LABELS[profile.lifeStage]} · {HOUSING_LABELS[profile.housing]}
          {profile.dependents ? ` · ${profile.dependents} dependent${profile.dependents === 1 ? "" : "s"}` : ""}
        </p>
        <p className="text-sm text-muted">Typical take-home {formatMoney(profile.monthlyIncome)} / month</p>
        <Button variant="outline" onClick={() => reopenSetup()}>
          Edit household answers
        </Button>
        <p className="text-xs text-muted">Opens the setup questions. Your transactions stay.</p>
        <Link to="/budget" className="inline-flex text-sm font-medium text-primary">
          Edit the monthly budget
        </Link>
      </section>
    </div>
  );
}

function YourNumbers() {
  const profile = useBudgetStore((s) => s.profile);
  const patchProfile = useBudgetStore((s) => s.patchProfile);
  const year = new Date().getFullYear();
  const age = profile.birthYear != null ? year - profile.birthYear : null;
  const [ageText, setAgeText] = useState(age == null ? "" : String(age));
  useEffect(() => {
    setAgeText(age == null ? "" : String(age));
  }, [age]);
  const retire = profile.retireAge ?? DEFAULT_RETIRE_AGE;
  const inflation = Math.round((profile.plannerInflation ?? DEFAULT_INFLATION) * 1000) / 10;
  const withdrawal = Math.round((profile.withdrawalRate ?? DEFAULT_WITHDRAWAL) * 1000) / 10;
  const band = profile.returnBand ?? PLANNING_MARKET;
  return (
    <section className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Your numbers</h2>
      <p className="text-sm text-muted">Retirement starts from these. Reset puts a number back to its default. A blank age is left unset.</p>
      <Field label={`Age (default: not set). Birth year ${profile.birthYear ?? "not saved"}.`}>
        <Input
          inputMode="numeric"
          aria-label="Age"
          value={ageText}
          onChange={(e) => {
            setAgeText(e.target.value);
            const raw = e.target.value.trim();
            if (raw === "") {
              patchProfile({ birthYear: undefined });
              return;
            }
            const nextAge = Math.round(Number(raw));
            if (Number.isFinite(nextAge) && nextAge >= 0 && nextAge <= 120) patchProfile({ birthYear: year - nextAge });
          }}
        />
      </Field>
      <NumberRow
        label="Retire-at age"
        fallback={DEFAULT_RETIRE_AGE}
        value={retire}
        onChange={(value) => patchProfile({ retireAge: value })}
        onReset={() => patchProfile({ retireAge: DEFAULT_RETIRE_AGE })}
      />
      <NumberRow
        label="Inflation %"
        fallback={DEFAULT_INFLATION * 100}
        value={inflation}
        onChange={(value) => patchProfile({ plannerInflation: value / 100 })}
        onReset={() => patchProfile({ plannerInflation: DEFAULT_INFLATION })}
      />
      <NumberRow
        label="Withdrawal %"
        fallback={DEFAULT_WITHDRAWAL * 100}
        value={withdrawal}
        onChange={(value) => patchProfile({ withdrawalRate: value / 100 })}
        onReset={() => patchProfile({ withdrawalRate: DEFAULT_WITHDRAWAL })}
      />
      <p className="text-sm">Return range {Math.round(band.conservative * 1000) / 10}% to {Math.round(band.optimistic * 1000) / 10}%, middle {Math.round(band.expected * 1000) / 10}%. The planning range needs checking.</p>
      <Button variant="outline" onClick={() => patchProfile({ returnBand: { ...PLANNING_MARKET } })}>
        Reset return range
      </Button>
    </section>
  );
}

function NumberRow({
  label,
  value,
  fallback,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  fallback: number;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={`${label} (default ${fallback})`}>
        <Input inputMode="decimal" aria-label={label} value={String(value)} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      </Field>
      <Button variant="outline" onClick={onReset}>Reset</Button>
    </div>
  );
}

function todayInput() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function prettyDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function YourAccounts() {
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const transactions = useBudgetStore((s) => s.transactions);
  const imports = useBudgetStore((s) => s.imports ?? []);
  const addAccount = useBudgetStore((s) => s.addAccount);
  const updateAccount = useBudgetStore((s) => s.updateAccount);
  const removeAccount = useBudgetStore((s) => s.removeAccount);
  const addBalance = useBudgetStore((s) => s.addBalance);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("checking");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<AccountKind>("checking");
  const [balanceId, setBalanceId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInput);

  return (
    <section className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Your accounts</h2>
      {accounts.length === 0 ? <p className="text-sm text-muted">No accounts yet.</p> : null}
      <ul className="space-y-3">
        {accounts.map((account) => {
          const latest = latestBalance(account.id, balances);
          const blocked = accountHasActivity(account.id, transactions, imports);
          return (
            <li key={account.id} className="rounded-md border border-border px-3 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {account.name} <span className="text-sm font-normal text-muted">· {accountKindLabel(account.kind)}</span>
                </p>
                <p className="text-sm tabular">
                  {latest ? (
                    <>
                      {formatMoney(latest.amount)} <span className="text-muted">as of {prettyDate(latest.date)}</span>
                    </>
                  ) : (
                    <span className="text-muted">No balance yet</span>
                  )}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBalanceId(balanceId === account.id ? null : account.id);
                    setEditId(null);
                    setAmount("");
                    setDate(todayInput());
                  }}
                >
                  Update balance
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditId(editId === account.id ? null : account.id);
                    setBalanceId(null);
                    setEditName(account.name);
                    setEditKind(account.kind);
                  }}
                >
                  Edit
                </Button>
              </div>
              {blocked ? <p className="mt-2 text-sm text-muted">This one has imports.</p> : (
                <Button className="mt-2" variant="ghost" size="sm" onClick={() => removeAccount(account.id)}>
                  Remove
                </Button>
              )}
              {balanceId === account.id ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={account.kind === "credit" ? "What you owe" : "Balance"}>
                    <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </Field>
                  <Field label="Date">
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </Field>
                  <Button
                    className="sm:col-span-2 sm:w-fit"
                    onClick={() => {
                      const next = Number(amount);
                      if (!Number.isFinite(next) || amount.trim() === "") return;
                      addBalance(account.id, next, date);
                      setBalanceId(null);
                      setAmount("");
                    }}
                  >
                    Save balance
                  </Button>
                </div>
              ) : null}
              {editId === account.id ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </Field>
                  <Field label="Kind">
                    <Select value={editKind} onChange={(e) => setEditKind(e.target.value as AccountKind)}>
                      {ACCOUNT_KIND_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button
                    className="sm:col-span-2 sm:w-fit"
                    onClick={() => {
                      updateAccount(account.id, { name: editName, kind: editKind });
                      setEditId(null);
                    }}
                  >
                    Save
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-sm">All accounts together: {formatMoney(totalBalance(accounts, balances))}</p>
      {adding ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {ACCOUNT_KIND_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              onClick={() => {
                const id = addAccount({ name, kind });
                if (!id) return;
                setAdding(false);
                setName("");
                setKind("checking");
              }}
            >
              Save account
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          Add account
        </Button>
      )}
    </section>
  );
}

function LeftoverStyle() {
  const profile = useBudgetStore((s) => s.profile);
  const setBudgetStyle = useBudgetStore((s) => s.setBudgetStyle);
  const style = profile.budgetStyle === "buckets" ? "buckets" : "monthly";
  return (
    <section className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">How leftover money works</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          aria-pressed={style === "monthly"}
          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm ${style === "monthly" ? "border-primary bg-chip" : "border-border bg-surface"}`}
          onClick={() => setBudgetStyle("monthly")}
        >
          {TERMS.monthlyReset}
        </button>
        <button
          type="button"
          aria-pressed={style === "buckets"}
          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm ${style === "buckets" ? "border-primary bg-chip" : "border-border bg-surface"}`}
          onClick={() => setBudgetStyle("buckets")}
        >
          {TERMS.carryOver}
        </button>
      </div>
      <p className="text-sm text-muted">
        This is only for spending categories, such as rent, groceries, and eating out. Income is compared with what usually comes in and is not carried over. A fund is extra savings, not this choice. One category can do the opposite on the Budget page. Switching never deletes the amount, a one-month amount, or a charge.
      </p>
      <CarryStartControl />
    </section>
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
        setNote("Mail is not connected yet, so the confirmation link is here. Open it on this device. After you add Resend, this button emails it instead.");
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
        setNote("Mail is not connected yet, so the reset link is here. It only works for this account. After you add Resend, this button emails it instead.");
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
        <p className="text-sm text-muted">This ledger stays on this device until you sign in. Then it follows the account.</p>
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
            : "Mail is not connected yet. Ask for a confirmation or reset link and it will show on this page until you add RESEND_API_KEY and HARBOR_FROM_EMAIL (Resend)."}
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
          <p className="text-sm text-muted">For email accounts. Google and X do not have a password here.</p>
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
        <p className="mt-3 text-sm text-muted">
          You do not need this. Email confirmation and the reset link are the way back in. A backup code is only if mail
          stays disconnected. It is shown once. A new code retires the old one.
        </p>
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
        <p className="text-sm text-muted">Removes this sign-in and the ledger saved to it. Download a file first if you might want it.</p>
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
