import { createFileRoute, Link } from "@tanstack/react-router";
import { useBudgetStore } from "@/store/budget-store";
import { HomeMenu } from "@/components/page-menu";

export const Route = createFileRoute("/imports")({ component: PastImports });

function PastImports() {
  const imports = useBudgetStore((s) => s.imports ?? []);
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  return (
    <div className="space-y-6">
      <HomeMenu current="imports" />
      <p className="max-w-xl text-sm text-muted">Your imported files</p>
      {imports.length === 0 ? (
        <p className="text-sm">
          No files yet.{" "}
          <Link to="/import" className="font-medium text-primary">
            Import a file
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {imports.map((batch) => {
            const account = accounts.find((row) => row.id === batch.accountId);
            return (
              <li key={batch.id} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <p className="font-medium">{batch.fileName}</p>
                <p className="text-muted">
                  {batch.added} added · {batch.skippedDuplicates} already in the ledger
                  {account ? ` · ${account.name}` : ""}
                  {batch.sourceLabel ? ` · ${batch.sourceLabel}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
