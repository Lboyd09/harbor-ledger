import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ACCOUNT_KIND_OPTIONS,
  accountAcceptsFile,
  accountKindLabel,
  defaultImportAccount,
  creditFileSignLooksWrong,
  storedFileBalance,
} from "@/lib/budget/accounts";
import { parseCsvText, remapPreview } from "@/lib/budget/csv";
import { fileChecklist, guessAccountKind, inferIncomeStreams, type IncomeSuggestion } from "@/lib/budget/file-inference";
import { formatMoney } from "@/lib/budget/money";
import type { Account, AccountKind, Category, ColumnRole, CsvPreview, ImportBatch, IncomeCadence, Profile } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { ImportReview } from "./import-review";
import { HomeMenu } from "./page-menu";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";

const ROLES: { value: ColumnRole; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "description", label: "Description" },
  { value: "memo", label: "Memo" },
  { value: "category", label: "Category" },
  { value: "amount", label: "Amount" },
  { value: "debit", label: "Money out" },
  { value: "credit", label: "Money in" },
  { value: "direction", label: "Money in or out" },
  { value: "balance", label: "Balance" },
  { value: "ignore", label: "Ignore" },
];

function todayInput() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function defaultAccountId(accounts: Account[], imports: ImportBatch[]): string {
  const recent = imports.find((batch) => batch.accountId && accounts.some((account) => account.id === batch.accountId));
  return defaultImportAccount(accounts, recent?.accountId ?? null);
}

export function ImportWizard() {
  const importPreview = useBudgetStore((s) => s.importPreview);
  const addAccount = useBudgetStore((s) => s.addAccount);
  const addBalance = useBudgetStore((s) => s.addBalance);
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const batches = useBudgetStore((s) => s.imports);
  const categories = useBudgetStore((s) => s.categories);
  const profile = useBudgetStore((s) => s.profile);
  const adoptIncomeStreams = useBudgetStore((s) => s.adoptIncomeStreams);
  const [accountId, setAccountId] = useState("");
  const [touched, setTouched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [newKind, setNewKind] = useState<AccountKind>("checking");
  const [kindTouched, setKindTouched] = useState(false);
  const [kindReason, setKindReason] = useState<string | null>(null);
  const [dismissedPay, setDismissedPay] = useState<string[]>([]);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [flip, setFlip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardBalance, setCardBalance] = useState("");
  const [result, setResult] = useState<{
    addedIds: string[];
    skipped: number;
    needsBalance: boolean;
    accountId: string | null;
  } | null>(null);
  const [typedBalance, setTypedBalance] = useState("");
  const [typedDate, setTypedDate] = useState(todayInput);
  const [balanceSaved, setBalanceSaved] = useState<string | null>(null);

  const showNew = accounts.length === 0 || adding;
  const selected = accounts.find((account) => account.id === accountId) ?? null;
  const fileAccount = selected && accountAcceptsFile(selected.kind) ? selected : null;
  const manualAccount = selected && !accountAcceptsFile(selected.kind) ? selected : null;

  useEffect(() => {
    if (touched || accountId || accounts.length === 0) return;
    const id = defaultAccountId(accounts, batches);
    if (id) setAccountId(id);
  }, [accounts, batches, touched, accountId]);

  useEffect(() => {
    if (!preview || touched) return;
    const match = accounts.find(
      (account) => account.name.trim().toLowerCase() === preview.guessedSource.trim().toLowerCase(),
    );
    if (match) setAccountId(match.id);
  }, [preview, accounts, touched]);

  useEffect(() => {
    if (!preview || kindTouched) return;
    const guess = guessAccountKind(
      preview.rows.map((row) => ({ description: row.description, amount: row.amount })),
      preview.endingBalance?.amount ?? null,
    );
    setNewKind(guess.kind);
    setKindReason(guess.reason);
  }, [preview, kindTouched]);

  useEffect(() => {
    if (!preview || nameTouched || !showNew) return;
    setNewName(preview.guessedSource);
  }, [preview, nameTouched, showNew]);

  useEffect(() => {
    if (!preview?.endingBalance || !selected || !creditFileSignLooksWrong(selected.kind, preview.endingBalance.amount)) {
      return;
    }
    setCardBalance(String(storedFileBalance(selected.kind, preview.endingBalance.amount)));
  }, [preview, selected]);

  async function onFile(file: File) {
    setError(null);
    setResult(null);
    setBalanceSaved(null);
    const text = await file.text();
    if (!text.trim()) {
      setError("That file was empty.");
      return;
    }
    const parsed = parseCsvText(text, file.name);
    setPreview(parsed);
    setFlip(false);
  }

  function saveNewAccount() {
    const id = addAccount({ name: newName, kind: newKind });
    if (!id) {
      setError("Give the account a name.");
      return;
    }
    setError(null);
    setAccountId(id);
    setAdding(false);
    setTouched(true);
    setNewName("");
    setNameTouched(false);
    setNewKind("checking");
  }

  function confirm() {
    if (!preview || !fileAccount) return;
    const wrong = preview.endingBalance && creditFileSignLooksWrong(fileAccount.kind, preview.endingBalance.amount);
    let balanceAmount: number | null = null;
    if (wrong) {
      const next = Number(cardBalance);
      if (!Number.isFinite(next)) {
        setError("Enter the card balance before importing.");
        return;
      }
      balanceAmount = next;
    }
    const imported = importPreview(preview, flip, fileAccount.id, balanceAmount);
    setResult(imported);
    setPreview(null);
    setTypedBalance("");
    setTypedDate(todayInput());
  }

  function saveTypedBalance(id: string) {
    const amount = Number(typedBalance);
    if (!Number.isFinite(amount) || typedBalance.trim() === "") {
      setError("Enter the balance, or skip it.");
      return;
    }
    addBalance(id, amount, typedDate);
    setError(null);
    setBalanceSaved("Saved.");
    setTypedBalance("");
  }

  const signWrong = Boolean(
    fileAccount && preview?.endingBalance && creditFileSignLooksWrong(fileAccount.kind, preview.endingBalance.amount),
  );

  return (
    <div className="space-y-6">
      <HomeMenu current="import" />
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Import a bank file</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          BudgetFlow reads a file you download from the bank. It does not log in. Each file belongs to one account.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Which account is this file from?</h2>
        {accounts.length > 0 ? (
          <Select
            aria-label="Which account is this file from?"
            value={adding ? "new" : accountId}
            onChange={(e) => {
              setTouched(true);
              setBalanceSaved(null);
              if (e.target.value === "new") {
                setAdding(true);
                return;
              }
              setAdding(false);
              setAccountId(e.target.value);
            }}
          >
            <option value="">Choose an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {accountKindLabel(account.kind)}
              </option>
            ))}
            <option value="new">Add a new account</option>
          </Select>
        ) : (
          <p className="text-sm text-muted">Add the account this file belongs to.</p>
        )}

        {showNew ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={newName}
                onChange={(e) => {
                  setNameTouched(true);
                  setNewName(e.target.value);
                }}
              />
            </Field>
            <Field label="Kind">
              <Select
                value={newKind}
                onChange={(e) => {
                  setKindTouched(true);
                  setNewKind(e.target.value as AccountKind);
                }}
              >
                {ACCOUNT_KIND_OPTIONS.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.label}
                  </option>
                ))}
              </Select>
            </Field>
            {kindReason ? <p className="text-sm text-muted sm:col-span-2">{kindReason} You can change it.</p> : null}
            <Button className="sm:col-span-2 sm:w-fit" onClick={saveNewAccount}>
              Save account
            </Button>
          </div>
        ) : null}
      </section>

      {manualAccount ? (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">What is the balance now?</h2>
          <p className="text-sm text-muted">
            {manualAccount.name} does not use a bank file. Type the balance when it changes.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Balance">
              <Input
                inputMode="decimal"
                value={typedBalance}
                onChange={(e) => setTypedBalance(e.target.value)}
              />
            </Field>
            <Field label="Date">
              <Input type="date" value={typedDate} onChange={(e) => setTypedDate(e.target.value)} />
            </Field>
          </div>
          <Button onClick={() => saveTypedBalance(manualAccount.id)}>Save balance</Button>
          {balanceSaved ? <p className="text-sm text-muted">{balanceSaved}</p> : null}
        </section>
      ) : null}

      {!manualAccount ? (
        <>
          <CsvHelp />
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface px-4 text-center">
            <span className="font-medium">Drop a .csv here, or tap to choose</span>
            <span className="mt-1 text-sm text-muted">One account per file. Columns can be fixed after the preview.</span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {preview && fileAccount ? (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{preview.fileName}</h2>
            <span className="text-sm text-muted">
              {preview.guessedSource} · {preview.rows.length} rows · {fileAccount.name}
            </span>
          </div>
          {preview.issues.length ? (
            <ul className="list-disc pl-5 text-sm text-warn">
              {preview.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          {preview.issues.length ? (
            <ColumnTools preview={preview} flip={flip} setFlip={setFlip} setPreview={setPreview} />
          ) : (
            <details className="rounded-md border border-border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Something look wrong?</summary>
              <div className="mt-3">
                <ColumnTools preview={preview} flip={flip} setFlip={setFlip} setPreview={setPreview} />
              </div>
            </details>
          )}
          {signWrong && preview.endingBalance ? (
            <Field label="Card balance to save">
              <p className="text-sm text-muted">
                This file says the balance is {formatMoney(preview.endingBalance.amount)}. A card is saved as what you
                owe, a negative number. Change it if that sign looks wrong.
              </p>
              <Input inputMode="decimal" value={cardBalance} onChange={(e) => setCardBalance(e.target.value)} />
            </Field>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  {preview.rows.some((row) => row.bankCategory) ? (
                    <th className="py-2 pr-3 font-medium">Category</th>
                  ) : null}
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((row, i) => {
                  const amt = row.amount == null ? null : flip ? -row.amount : row.amount;
                  return (
                    <tr key={i} className="border-b border-border/70">
                      <td className="py-2 pr-3 tabular">{row.date ?? "—"}</td>
                      <td className="max-w-xs truncate py-2 pr-3">{row.description || "—"}</td>
                      {preview.rows.some((item) => item.bankCategory) ? (
                        <td className="max-w-xs truncate py-2 pr-3 text-muted">{row.bankCategory || "—"}</td>
                      ) : null}
                      <td className="py-2 text-right tabular">{amt == null ? "—" : formatMoney(amt, { signed: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <FileRead
            preview={preview}
            flip={flip}
            categories={categories}
            profile={profile}
            dismissed={dismissedPay}
            onDismiss={(key) => setDismissedPay((list) => [...list, key])}
            onAdopt={(suggestion) => adoptIncomeStreams([suggestion])}
          />
          <div className="flex gap-2">
            <Button onClick={confirm} disabled={!fileAccount}>
              Import these rows
            </Button>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {preview && !fileAccount ? (
        <p className="text-sm text-muted">Choose the account, then import {preview.fileName}.</p>
      ) : null}

      {result?.needsBalance && result.accountId && !balanceSaved ? (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">What is the balance in this account now?</h2>
          <p className="text-sm text-muted">The file did not include one. You can skip this.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={accounts.find((a) => a.id === result.accountId)?.kind === "credit" ? "What you owe" : "Balance"}>
              <Input inputMode="decimal" value={typedBalance} onChange={(e) => setTypedBalance(e.target.value)} />
            </Field>
            <Field label="Date">
              <Input type="date" value={typedDate} onChange={(e) => setTypedDate(e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveTypedBalance(result.accountId as string)}>Save balance</Button>
            <Button variant="ghost" onClick={() => setBalanceSaved("Skipped.")}>
              Skip
            </Button>
          </div>
        </section>
      ) : null}

      {result ? <ImportReview addedIds={result.addedIds} skipped={result.skipped} /> : null}

      {batches.length ? (
        <div>
          <h2 className="font-display text-lg font-semibold">Past imports</h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
            {batches.map((batch) => {
              const name = accounts.find((account) => account.id === batch.accountId)?.name;
              return (
                <li key={batch.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    {batch.fileName}
                    {name ? ` · ${name}` : ""} · {batch.sourceLabel}
                  </span>
                  <span className="text-muted">
                    +{batch.added} · skipped {batch.skippedDuplicates}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ColumnTools({
  preview,
  flip,
  setFlip,
  setPreview,
}: {
  preview: CsvPreview;
  flip: boolean;
  setFlip: (value: boolean) => void;
  setPreview: (preview: CsvPreview) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{preview.amountNote}</p>
      <div>
        <h3 className="text-sm font-medium">Columns</h3>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {preview.columns.map((col) => (
            <li key={col.index} className="flex items-center gap-2">
              <span className="w-28 truncate text-sm text-muted" title={col.header}>
                {col.header}
              </span>
              <Select
                aria-label={`Column ${col.header}`}
                value={col.role}
                onChange={(e) =>
                  setPreview(
                    remapPreview(
                      preview,
                      preview.columns.map((item) =>
                        item.index === col.index ? { ...item, role: e.target.value as ColumnRole } : item,
                      ),
                    ),
                  )
                }
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} />
        Flip the signs if money out came in as positive
      </label>
    </div>
  );
}

function CsvHelp() {
  return (
    <p>
      <Link to="/help" hash="csv" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
        How to get your bank file →
      </Link>
    </p>
  );
}

function cadenceWords(cadence: IncomeCadence): string {
  if (cadence === "weekly") return "every week";
  if (cadence === "biweekly") return "every two weeks";
  if (cadence === "twice-monthly") return "twice a month";
  if (cadence === "monthly") return "every month";
  return "on an uneven schedule";
}

function FileRead({
  preview,
  flip,
  categories,
  profile,
  dismissed,
  onDismiss,
  onAdopt,
}: {
  preview: CsvPreview;
  flip: boolean;
  categories: Category[];
  profile: Profile;
  dismissed: string[];
  onDismiss: (key: string) => void;
  onAdopt: (suggestion: IncomeSuggestion) => void;
}) {
  const rows = preview.rows.map((row) => ({
    ...row,
    amount: row.amount == null || !flip ? row.amount : -row.amount,
  }));
  const lines = fileChecklist({
    rows,
    categories,
    profile,
    endingBalance: preview.endingBalance,
  });
  const drafts = rows
    .filter((row) => row.date && row.amount != null && row.description)
    .map((row) => ({ date: row.date as string, description: row.description, amount: row.amount as number }));
  const pay = inferIncomeStreams(drafts, categories, profile).filter((item) => !dismissed.includes(item.merchantKey));
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium">What we read from your file</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {lines.map((line) => (
            <li key={line.label} className="rounded-full border border-border px-3 py-1 text-sm">
              <span className="tabular font-medium">{line.value}</span> <span className="text-muted">{line.label}</span>
            </li>
          ))}
        </ul>
      </div>
      {pay.map((item) => (
        <div key={item.merchantKey} className="rounded-md border border-border p-3">
          <p className="text-sm">
            We found {formatMoney(item.amount)} {cadenceWords(item.cadence)} from {item.name}. Add it as income?
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => onAdopt(item)}>
              Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDismiss(item.merchantKey)}>
              Not now
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
