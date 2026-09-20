import { createFileRoute } from "@tanstack/react-router";
import { ExportBar } from "@/components/export-bar";
import { ImportWizard } from "@/components/import-wizard";

export const Route = createFileRoute("/import")({ component: ImportPage });

function ImportPage() {
  return (
    <div className="space-y-8">
      <ImportWizard />
      <div>
        <h2 className="font-display text-xl font-semibold">Take the numbers elsewhere</h2>
        <p className="mt-1 mb-3 max-w-2xl text-sm text-muted">
          Optional. The live ledger stays in your Harbor account. If you want the same numbers in Google Sheets, Excel,
          Numbers, or another budget app, download a file below.
        </p>
        <ExportBar />
      </div>
    </div>
  );
}
