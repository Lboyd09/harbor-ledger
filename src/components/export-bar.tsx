import { useState } from "react";
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
  const resetAll = useBudgetStore((s) => s.resetAll);
  const restoreBackup = useBudgetStore((s) => s.restoreBackup);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function exportCsv() {
    downloadText("harbor-ledger.csv", ledgerCsv(transactions, categories), "text/csv;charset=utf-8");
    setNote("Downloaded harbor-ledger.csv. Excel opens it. In Google Sheets: File → Import → Upload.");
  }

  function exportWorkbook() {
    setBusy(true);
    setNote(null);
    try {
      const bytes = buildHarborWorkbook({ profile, categories, transactions, monthBudgets });
      downloadBytes(
        "harbor-ledger.xlsx",
        bytes,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      setNote(
        "Downloaded harbor-ledger.xlsx. Excel opens the sheets and the charts. In Google Sheets: File → Import → Upload → Replace spreadsheet. Every Harbor list is a tab: months, plan, month budgets, splits, transactions, and merchants.",
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not build the workbook.");
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
        <p className="text-sm text-muted">
          The workbook is the ledger: overview, every month, categories and splits, the usual plan, month-only budgets,
          every transaction, income merchants, spending merchants, and two charts.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={exportWorkbook} disabled={!transactions.length || busy}>
            {busy ? "Building…" : "Download Excel workbook"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!transactions.length}>
            Download CSV
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Other files</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!transactions.length}
            onClick={() =>
              downloadText("harbor-ledger-transactions.csv", transactionsCsv(transactions, categories), "text/csv;charset=utf-8")
            }
          >
            Transactions CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!transactions.length}
            onClick={() =>
              downloadText("harbor-ledger-ynab.csv", similarAppCsv(transactions, categories), "text/csv;charset=utf-8")
            }
          >
            Date / payee / amount CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadText(
                "harbor-ledger-backup.json",
                JSON.stringify({ profile, categories, transactions, merchantRules, monthBudgets }, null, 2),
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Erase this browser’s ledger? This does not touch your bank.")) resetAll();
            }}
          >
            Reset this device
          </Button>
        </div>
      </section>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </div>
  );
}
