import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";

const TABS = [
  { to: "/", label: "This month", id: "month" },
  { to: "/categories", label: "Merchants", id: "merchants" },
  { to: "/import", label: "Import a file", id: "import" },
] as const;

export function LedgerTabs({ page }: { page: "month" | "merchants" | "import" }) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Month sections">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          role="tab"
          aria-selected={page === tab.id}
          className={cn(
            "inline-flex min-h-11 items-center rounded-md px-3 text-sm",
            page === tab.id ? "bg-primary text-primary-fg" : "border border-border bg-surface",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
