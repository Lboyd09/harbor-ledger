import { createFileRoute, Link } from "@tanstack/react-router";
import { ImportWizard } from "@/components/import-wizard";

export const Route = createFileRoute("/import")({ component: ImportPage });

function ImportPage() {
  return (
    <div className="space-y-8">
      <ImportWizard />
      <p className="text-sm text-muted">
        Download for Excel or Sheets in <Link to="/settings" className="text-primary">Settings</Link>.
      </p>
    </div>
  );
}
