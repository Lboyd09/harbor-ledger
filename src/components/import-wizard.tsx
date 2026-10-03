import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { parseCsvText, remapPreview } from "@/lib/budget/csv";
import { formatMoney } from "@/lib/budget/money";
import type { ColumnRole, CsvPreview } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";
import { Select } from "./ui/field";

const ROLES: { value: ColumnRole; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "description", label: "Description" },
  { value: "amount", label: "Amount (signed)" },
  { value: "debit", label: "Debit / withdrawal" },
  { value: "credit", label: "Credit / deposit" },
  { value: "direction", label: "In / out marker" },
  { value: "ignore", label: "Ignore" },
];

export function ImportWizard() {
  const importPreview = useBudgetStore((s) => s.importPreview);
  const batches = useBudgetStore((s) => s.imports);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [flip, setFlip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    added: number;
    skipped: number;
    categorized: number;
    uncategorized: number;
  } | null>(null);

  async function onFile(file: File) {
    setError(null);
    setResult(null);
    const text = await file.text();
    if (!text.trim()) {
      setError("That file was empty.");
      return;
    }
    const p = parseCsvText(text, file.name);
    setPreview(p);
    setFlip(false);
  }

  function confirm() {
    if (!preview) return;
    const r = importPreview(preview, flip);
    setResult(r);
    setPreview(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Import a bank CSV</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Banks already let you download activity as a spreadsheet. Harbor reads that file. It does not log into any
          bank. After import, rows save to your account.
        </p>
      </div>

      <CsvHelp />

      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface px-4 text-center">
        <span className="font-medium">Drop a .csv here, or tap to choose</span>
        <span className="mt-1 text-sm text-muted">OFX/QFX is not read yet — CSV only. Columns can be remapped after preview.</span>
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

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {preview ? (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{preview.fileName}</h2>
            <span className="text-sm text-muted">
              {preview.guessedSource} · {preview.rows.length} rows
            </span>
          </div>
          <p className="text-sm text-muted">{preview.amountNote}</p>
          {preview.issues.length ? (
            <ul className="list-disc pl-5 text-sm text-warn">
              {preview.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}

          <div>
            <h3 className="text-sm font-medium">Column map</h3>
            <p className="mb-2 text-xs text-muted">Fix a wrong guess before importing. Extra columns stay ignored.</p>
            <ul className="grid gap-2 md:grid-cols-2">
              {preview.columns.map((col) => (
                <li key={col.index} className="flex items-center gap-2">
                  <span className="w-28 truncate text-sm text-muted" title={col.header}>
                    {col.header}
                  </span>
                  <Select
                    value={col.role}
                    onChange={(e) =>
                      setPreview(
                        remapPreview(
                          preview,
                          preview.columns.map((c) =>
                            c.index === col.index ? { ...c, role: e.target.value as ColumnRole } : c,
                          ),
                        ),
                      )
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
          </div>

          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} />
            Flip all signs (use if expenses imported as positive)
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((r, i) => {
                  const amt = r.amount == null ? null : flip ? -r.amount : r.amount;
                  return (
                    <tr key={i} className="border-b border-border/70">
                      <td className="py-2 pr-3 tabular">{r.date ?? "—"}</td>
                      <td className="max-w-xs truncate py-2 pr-3">{r.description || "—"}</td>
                      <td className="py-2 text-right tabular">{amt == null ? "—" : formatMoney(amt, { signed: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button onClick={confirm}>Import these rows</Button>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-md bg-chip px-3 py-3 text-sm">
          <p>
            Added {result.added} new transaction{result.added === 1 ? "" : "s"} ({result.categorized} auto-categorized,{" "}
            {result.uncategorized} still open). Skipped {result.skipped} duplicate or unreadable row
            {result.skipped === 1 ? "" : "s"}.
          </p>
          <div className="flex flex-wrap gap-3">
            {result.uncategorized > 0 ? (
              <Link
                to="/"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  try {
                    sessionStorage.setItem("harbor-open-categorize", "1");
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Categorize them now
              </Link>
            ) : null}
            <Link to="/" className="text-primary underline-offset-2 hover:underline">
              Open this month
            </Link>
            <Link to="/year" className="text-primary underline-offset-2 hover:underline">
              See the year
            </Link>
          </div>
        </div>
      ) : null}

      {batches.length ? (
        <div>
          <h2 className="font-display text-lg font-semibold">Past imports</h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {b.fileName} · {b.sourceLabel}
                </span>
                <span className="text-muted">
                  +{b.added} · skipped {b.skippedDuplicates}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const BANK_STEPS: { bank: string; steps: string[] }[] = [
  {
    bank: "Chase",
    steps: [
      "Sign in on chase.com (the download is more reliable there than in the app).",
      "Open the account → See all activity or Account activity.",
      "Choose Download, pick CSV, set a date range, download.",
      "The file often starts with Details, Posting Date, Description, Amount. Harbor ignores Details as a direction marker.",
    ],
  },
  {
    bank: "Bank of America",
    steps: [
      "Sign in → Activity → Download.",
      "Pick CSV (not QFX/OFX or PDF).",
      "Date, Description, Amount columns are enough.",
    ],
  },
  {
    bank: "Wells Fargo",
    steps: [
      "Account → Activity → Download. CSV may have no header row — Harbor still reads date, amount, description.",
    ],
  },
  {
    bank: "Capital One / Citi / Ally / most credit cards",
    steps: [
      "Look for Download, Export, or Spreadsheet in account activity.",
      "Prefer CSV. If the file has Debit and Credit columns instead of a signed Amount, leave the column map as-is — Harbor uses both.",
    ],
  },
];

function CsvHelp() {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <h2 className="font-display text-lg font-semibold">How to get a CSV from your bank</h2>
        <span className="text-sm text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-4 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>Sign in on the bank or card website.</li>
            <li>Open one account’s activity or transactions.</li>
            <li>Find Download, Export, or Spreadsheet — not Print, not PDF.</li>
            <li>Choose CSV (sometimes called comma separated or Excel CSV).</li>
            <li>Pick a date range. A month is a good first import; you can add more later. Duplicates are skipped.</li>
            <li>Save the file, then drop it in the box below. Do not open and re-save it in a way that changes the columns if you can avoid it.</li>
          </ol>
          <p>
            Harbor needs a date, a description, and an amount. Signed amounts (expenses negative) are best. Debit/Credit
            columns and an in/out marker also work. After the preview you can remap any column.
          </p>
          {BANK_STEPS.map((b) => (
            <div key={b.bank}>
              <h3 className="font-medium">{b.bank}</h3>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {b.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-muted">
            Credit-card payments and moving money between your own accounts are left out, so a card bill is not
            spending twice. A Zelle or Venmo deposit counts as income. If someone paid you back for a purchase, use Paid
            back on that charge — it cancels the purchase and does not count as income.
          </p>
        </div>
      ) : null}
    </section>
  );
}
