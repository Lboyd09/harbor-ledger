import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type PageMenuItem = {
  label: string;
  current: boolean;
  to?: "/" | "/year" | "/import" | "/rules" | "/imports" | "/budget";
  search?: { page: "amounts" | "transactions" };
  onSelect?: () => void;
};

/** A page title that opens the subpages. Not a second row of tabs. */
export function PageMenu({ title, items }: { title: string; items: PageMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [undoFocus, setUndoFocus] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = items.find((item) => item.current) ?? items[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nodes = root.current?.querySelectorAll<HTMLElement>("[role='menuitem']");
    const marked = [...(nodes ?? [])].findIndex((node) => node.getAttribute("aria-current") === "page");
    nodes?.[marked >= 0 ? marked : 0]?.focus();
  }, [open, undoFocus]);

  function onKey(event: React.KeyboardEvent) {
    const nodes = [...(root.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [])];
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setUndoFocus((n) => n + 1);
        return;
      }
      const index = nodes.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "ArrowDown" ? (index + 1) % nodes.length : (index - 1 + nodes.length) % nodes.length;
      nodes[next]?.focus();
    }
  }

  return (
    <div ref={root} className="relative min-w-0" onKeyDown={onKey}>
      <button
        type="button"
        className="inline-flex max-w-full min-h-11 items-center gap-1 text-left"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="font-display text-2xl font-semibold md:text-3xl">{title}</span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted", open && "rotate-180")} aria-hidden />
        <span className="sr-only">{open ? "Close pages" : "Open pages"}</span>
      </button>
      {open ? (
        <ul id={menuId} role="menu" aria-label={title} className="absolute z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-1 shadow-lg">
          {items.map((item) => (
            <li key={item.label} role="none">
              {item.onSelect ? (
                <button
                  type="button"
                  role="menuitem"
                  aria-current={item.current ? "page" : undefined}
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-chip"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect?.();
                  }}
                >
                  {item.label}
                </button>
              ) : (
              <Link
                to={item.to ?? "/"}
                search={item.search}
                role="menuitem"
                aria-current={item.current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 text-sm",
                  item.current ? "bg-chip font-medium" : "hover:bg-chip",
                )}
                onClick={() => setOpen(false)}
              >
                {item.label}
                {item.current ? <span className="sr-only">, current page</span> : null}
              </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="sr-only">
          {current?.label}. {items.map((item) => item.label).join(", ")}.
        </p>
      )}
    </div>
  );
}

export function SectionTabs({ label, items }: { label: string; items: PageMenuItem[] }) {
  return (
    <nav className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1" aria-label={label}>
      {items.map((item) => {
        const className = cn(
          "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm",
          item.current ? "border-primary bg-chip font-medium text-fg" : "border-border bg-surface text-muted hover:text-fg",
        );
        if (item.onSelect) {
          return (
            <button key={item.label} type="button" className={className} aria-current={item.current ? "page" : undefined} onClick={item.onSelect}>
              {item.label}
            </button>
          );
        }
        return (
          <Link key={item.label} to={item.to ?? "/"} search={item.search} className={className} aria-current={item.current ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HomeMenu({ current, onAccounts }: { current: "overview" | "year" | "import" | "rules" | "imports"; onAccounts?: () => void }) {
  if (current === "overview") return null;
  return <BudgetMenu page={current} onAccounts={onAccounts} />;
}

export function BudgetMenu({
  page,
  onAccounts,
}: {
  page: "month" | "amounts" | "transactions" | "year" | "import" | "rules" | "imports";
  onAccounts?: () => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <h1 className="font-display text-2xl font-semibold md:text-3xl">Budget</h1>
      <p className="text-sm text-muted">This month, the charges, and a bank file.</p>
      <SectionTabs
        label="Budget"
        items={[
          { to: "/budget", label: "This month", current: page === "month" || page === "amounts" },
          { to: "/budget", search: { page: "transactions" }, label: "Transactions", current: page === "transactions" },
          { to: "/import", label: "Import", current: page === "import" },
          ...(onAccounts ? [{ label: "Accounts", current: false, onSelect: onAccounts }] : []),
        ]}
      />
      <details>
        <summary className="min-h-11 cursor-pointer text-sm text-muted">More: year, sorting, past imports</summary>
        <SectionTabs
          label="More budget pages"
          items={[
            { to: "/year", label: "Year", current: page === "year" },
            { to: "/rules", label: "Sorting", current: page === "rules" },
            { to: "/imports", label: "Past imports", current: page === "imports" },
          ]}
        />
      </details>
    </div>
  );
}
