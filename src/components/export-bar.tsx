import { useState } from "react";
import { ledgerCsv, similarAppCsv, spreadsheetXml, transactionsCsv } from "@/lib/budget/export-workbook";
import { downloadText } from "@/lib/budget/download";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";

export function ExportBar() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const profile = useBudgetStore((s) => s.profile);
  const merchantRules = useBudgetStore((s) => s.merchantRules);
  const resetAll = useBudgetStore((s) => s.resetAll);
  const restoreBackup = useBudgetStore((s) => s.restoreBackup);
  const [note, setNote] = useState<string | null>(null);

  function exportCsv() {
    downloadText("harbor-ledger.csv", ledgerCsv(transactions, categories), "text/csv;charset=utf-8");
    setNote("Downloaded harbor-ledger.csv. Excel opens it directly. In Google Sheets: File → Import → Upload, then choose that file.");
  }

  function exportWorkbook() {
    downloadText(
      "harbor-ledger.xls",
      spreadsheetXml({ profile, categories, transactions }),
      "application/vnd.ms-excel",
    );
    setNote("Downloaded harbor-ledger.xls with separate tabs. If a program shows a blank sheet, use the CSV instead.");
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
        <h2 className="font-display text-lg font-semibold">Google Sheets, Excel, Numbers</h2>
        <p className="text-sm text-muted">
          Download a CSV and open it in Excel, or in Google Sheets choose File → Import → Upload. The CSV has a row
          for every charge, with income and expenses in separate columns. The Excel file adds tabs for the year grid
          and the plan.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={exportCsv} disabled={!transactions.length}>
            Download CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportWorkbook} disabled={!transactions.length}>
            Download Excel workbook
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
                JSON.stringify({ profile, categories, transactions, merchantRules }, null, 2),
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
