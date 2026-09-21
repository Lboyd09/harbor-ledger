import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/budget/money";
import { displayMerchant } from "@/lib/budget/merchant";
import { groupPayees } from "@/lib/budget/payees";
import { useBudgetStore } from "@/store/budget-store";
import { CategorySelect } from "./category-select";
import { Input } from "./ui/field";

type Filter = "all" | "open" | "bills";

export function PayeeView() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const setMerchantCategory = useBudgetStore((s) => s.setMerchantCategory);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState<string | null>(null);

  const groups = useMemo(() => groupPayees(transactions), [transactions]);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const rows = groups.filter((g) => {
    if (filter === "open" && g.unassigned === 0 && g.categoryId && !g.mixed) return false;
    if (filter === "bills" && !g.likelyBill) return false;
    const needle = q.trim().toUpperCase();
    if (needle && !`${g.merchantKey} ${g.sample}`.toUpperCase().includes(needle)) return false;
    return true;
  });
  const openCount = groups.reduce((s, g) => s + g.unassigned, 0);
  const billCount = groups.filter((g) => g.likelyBill).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Categories</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Most repeated merchants first. Change the category on a payee and every matching row updates — past imports
          and the next file of the same merchant.
        </p>
      </div>
      {openCount > 0 ? (
        <p className="rounded-md border border-warn/40 bg-chip px-4 py-3 text-sm">
          {openCount} row{openCount === 1 ? "" : "s"} still need a category. Start at the top — those merchants hit
          your ledger the most.
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-border bg-chip px-4 py-3 text-sm" role="status">
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="text-sm text-muted">Search</span>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Netflix, rent, employer…" />
        </label>
        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: "all", label: "All" },
              { id: "open", label: "Needs work" },
              { id: "bills", label: `Likely bills (${billCount})` },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`min-h-11 rounded-md px-3 text-sm ${
                filter === f.id ? "bg-primary text-primary-fg" : "border border-border bg-surface text-fg hover:bg-chip"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{rows.length} payees</p>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map((g) => (
          <li key={g.merchantKey} className="grid gap-3 p-4 md:grid-cols-[1fr_16rem] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium">{displayMerchant(g.sample)}</div>
                {g.likelyBill ? (
                  <span className="rounded-full bg-chip px-2 py-0.5 text-xs text-muted">Likely bill</span>
                ) : null}
              </div>
              <div className="mt-1 text-sm text-muted">
                {g.count} time{g.count === 1 ? "" : "s"}
                {g.totalOut > 0 ? ` · spent ${formatMoney(g.totalOut)}` : ""}
                {g.totalIn > 0 ? ` · received ${formatMoney(g.totalIn)}` : ""}
                {g.unassigned ? ` · ${g.unassigned} open` : ""}
                {g.mixed ? " · mixed categories until you pick one" : ""}
              </div>
              <div className="mt-1 truncate text-xs text-muted">{g.sample}</div>
            </div>
            <div>
              <CategorySelect
                categories={categories}
                value={g.categoryId}
                onChange={(id) => {
                  setMerchantCategory(g.merchantKey, id);
                  const name = id ? (catName.get(id) ?? "that category") : "Needs category";
                  setNotice(`Updated ${g.count} charge${g.count === 1 ? "" : "s"} for ${displayMerchant(g.sample)} to ${name}.`);
                }}
              />
              <p className="mt-1 text-xs text-muted">
                Updates {g.count} charge{g.count === 1 ? "" : "s"}
              </p>
            </div>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="p-6 text-sm text-muted">
            {transactions.length ? "No payees match that search." : "Import a CSV to group repeating merchants here."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
