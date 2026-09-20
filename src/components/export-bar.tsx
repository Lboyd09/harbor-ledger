import { useState } from "react";
import {
  similarAppCsv,
  sheetsTsv,
  spreadsheetXml,
  transactionsCsv,
} from "@/lib/budget/export-workbook";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportBar() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const profile = useBudgetStore((s) => s.profile);
  const merchantRules = useBudgetStore((s) => s.merchantRules);
  const resetAll = useBudgetStore((s) => s.resetAll);
  const restoreBackup = useBudgetStore((s) => s.restoreBackup);
  const [note, setNote] = useState<string | null>(null);

  function exportWorkbook() {
    download(
      "harbor-ledger.xls",
      spreadsheetXml({ profile, categories, transactions }),
      "application/vnd.ms-excel",
    );
    setNote("Workbook downloaded. In Google Sheets: File → Import → Upload, then choose that file.");
  }

  async function copySheets() {
    try {
      await navigator.clipboard.writeText(sheetsTsv(transactions, categories));
      setNote("Copied. In Google Sheets or Excel, click A1 and paste. Columns: date, description, amount, category, merchant.");
    } catch {
      setNote("Clipboard is blocked in this browser. Download the workbook instead.");
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
        <h2 className="font-display text-lg font-semibold">Google Sheets, Excel, Numbers</h2>
        <p className="text-sm text-muted">
          Optional. The workbook has tabs for overview, category-by-month, transactions, plan, and repeating
          charges. Google Sheets: open a blank sheet at sheets.new, then File → Import → Upload. Excel and Apple
          Numbers open the same file.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={exportWorkbook} disabled={!transactions.length}>
            Download workbook
          </Button>
          <Button variant="outline" size="sm" onClick={() => copySheets()} disabled={!transactions.length}>
            Copy table to paste
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://sheets.new", "_blank", "noopener,noreferrer")}
          >
            Open Google Sheets
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
              download("harbor-ledger-transactions.csv", transactionsCsv(transactions, categories), "text/csv")
            }
          >
            Transactions CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!transactions.length}
            onClick={() =>
              download("harbor-ledger-ynab.csv", similarAppCsv(transactions, categories), "text/csv")
            }
          >
            Date / payee / amount CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              download(
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
