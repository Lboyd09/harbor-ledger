import { useState } from "react";
import { ledgerBackup } from "@/lib/budget/backup";
import { ledgerCsv, similarAppCsv, transactionsCsv } from "@/lib/budget/export-workbook";
import { downloadBytes, downloadText } from "@/lib/budget/download";
import { buildHarborWorkbook } from "@/lib/budget/xlsx-book";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";

export function ExportBar() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const profile = useBudgetStore((s) => s.profile);
  const merchantRules = useBudgetStore((s) => s.merchantRules);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const savingsGoals = useBudgetStore((s) => s.savingsGoals) ?? [];
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const bucketMoves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const netWorth = useBudgetStore((s) => s.netWorth) ?? [];
  const debts = useBudgetStore((s) => s.debts) ?? [];
  const ira = useBudgetStore((s) => s.ira);
  const accounts = useBudgetStore((s) => s.accounts) ?? [];
  const balances = useBudgetStore((s) => s.balances) ?? [];
  const setAsides = useBudgetStore((s) => s.setAsides) ?? [];
  const resetAll = useBudgetStore((s) => s.resetAll);
  const restoreBackup = useBudgetStore((s) => s.restoreBackup);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armReset, setArmReset] = useState(false);
  const [resetWord, setResetWord] = useState("");
  const [ready, setReady] = useState<{ name: string; href: string } | null>(null);

  function publish(filename: string, bytes: Uint8Array, type: string) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type });
    const href = URL.createObjectURL(blob);
    setReady((prev) => {
      if (prev) URL.revokeObjectURL(prev.href);
      return { name: filename, href };
    });
    downloadBytes(filename, bytes, type);
  }

  const pack = { profile, categories, transactions, monthBudgets, savingsGoals, moneyBuckets, bucketMoves, netWorth, debts, ira, accounts, balances, setAsides, merchantRules };

  function exportCsv() {
    downloadText("budgetflow.csv", ledgerCsv(transactions, categories), "text/csv;charset=utf-8");
    setNote("CSV downloaded. Excel opens it. Google Sheets: File, Import, Upload.");
  }

  function exportWorkbook() {
    setBusy(true);
    setNote(null);
    try {
      publish("budgetflow.xlsx", buildHarborWorkbook(pack), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      setNote("Excel file downloaded. Google Sheets: File, Import, Upload, Replace spreadsheet.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not build the workbook.");
    } finally {
      setBusy(false);
    }
  }

  function exportSheets() {
    setBusy(true);
    setNote(null);
    try {
      publish("budgetflow-google-sheets.xlsx", buildHarborWorkbook(pack), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      setNote("Same workbook. In Google Sheets: File, Import, Upload, Replace spreadsheet.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not build the Google Sheets file.");
    } finally {
      setBusy(false);
    }
  }

  async function onRestore(file: File) {
    setNote(null);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const result = restoreBackup(raw);
      if (!result.ok) {
        setNote(result.error);
        return;
      }
      setNote(`Restored ${result.count} transaction${result.count === 1 ? "" : "s"}.`);
    } catch {
      setNote("That file is not valid JSON.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Google Sheets and Excel</h2>
        <p className="text-sm text-muted">Excel / Sheets workbook, plus CSV</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={exportWorkbook} disabled={busy}>
            {busy ? "Building…" : "Excel"}
          </Button>
          <Button size="sm" variant="outline" onClick={exportSheets} disabled={busy}>
            Google Sheets
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            Download CSV
          </Button>
        </div>
        {ready ? (
          <p className="text-sm">
            <a className="font-medium text-primary underline-offset-2 hover:underline" href={ready.href} download={ready.name}>
              {ready.name} is ready. Download it again.
            </a>
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Other files</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!transactions.length}
            onClick={() =>
              downloadText("budgetflow-transactions.csv", transactionsCsv(transactions, categories), "text/csv;charset=utf-8")
            }
          >
            Transactions CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!transactions.length}
            onClick={() =>
              downloadText("budgetflow-ynab.csv", similarAppCsv(transactions, categories), "text/csv;charset=utf-8")
            }
          >
            Date / payee / amount CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadText(
                "budgetflow-backup.json",
                JSON.stringify(
                  ledgerBackup({
                    profile,
                    categories,
                    transactions,
                    merchantRules,
                    imports: [],
                    monthBudgets,
                    savingsGoals,
                    moneyBuckets,
                    bucketMoves,
                    netWorth,
                    debts,
                    ira,
                    accounts,
                    balances,
                    activeMonth: "",
                    activeWeek: "",
                  }),
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            Download backup
          </Button>
          <label className="inline-flex min-h-9 cursor-pointer items-center rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-chip">
            Restore backup
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onRestore(f);
                e.target.value = "";
              }}
            />
          </label>
          {armReset ? (
            <span className="inline-flex flex-wrap items-center gap-2 rounded-md border border-danger/40 bg-danger/10 p-2">
              <span className="text-sm">Type RESET to erase this device. Your bank is not touched.</span>
              <input
                aria-label="Type RESET to confirm"
                className="min-h-11 rounded-md border border-border bg-surface px-2 text-sm"
                value={resetWord}
                onChange={(e) => setResetWord(e.target.value)}
              />
              <Button
                variant="danger"
                size="sm"
                disabled={busy || resetWord !== "RESET"}
                onClick={() => {
                  setBusy(true);
                  setNote(null);
                  void resetAll()
                    .then(() => {
                      setArmReset(false);
                      setNote("This device is cleared.");
                    })
                    .catch((err: unknown) => {
                      setNote(err instanceof Error ? err.message : "Could not reset this device.");
                    })
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Erasing…" : "Erase ledger"}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setArmReset(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setArmReset(true)}>
              Reset this device
            </Button>
          )}
        </div>
      </section>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </div>
  );
}
