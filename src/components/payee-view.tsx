import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/budget/money";
import { displayMerchant } from "@/lib/budget/merchant";
import { groupPayees, type PayeeGroup } from "@/lib/budget/payees";
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

  function keep(g: PayeeGroup) {
    if (filter === "open" && g.unassigned === 0 && g.categoryId && !g.mixed) return false;
    if (filter === "bills" && !g.likelyBill) return false;
    const needle = q.trim().toUpperCase();
    if (needle && !`${g.merchantKey} ${g.sample}`.toUpperCase().includes(needle)) return false;
    return true;
  }

  const income = groups.filter((g) => g.totalIn > 0 && keep(g));
  const expenses = groups.filter((g) => (g.totalOut > 0 || g.returned > 0) && keep(g));
  const openCount = groups.reduce((s, g) => s + g.unassigned, 0);
  const billCount = groups.filter((g) => g.likelyBill).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Merchants</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Money in and money out are separate. Changing a category updates every charge from that name. One row on the month page can still differ.
        </p>
      </div>
      {openCount > 0 ? (
        <p className="rounded-md border border-warn/40 bg-chip px-4 py-3 text-sm">
          {openCount} row{openCount === 1 ? "" : "s"} still need a category.
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
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <MerchantList
          title="Income"
          hint="Money that came in"
          rows={income}
          amount={(g) => formatMoney(g.totalIn)}
          categories={categories}
          onPick={(g, id) => {
            setMerchantCategory(g.merchantKey, id);
            setNotice(`Updated ${g.count} row${g.count === 1 ? "" : "s"} for ${displayMerchant(g.sample)}.`);
          }}
          empty={transactions.length ? "No income merchants match." : "Import a CSV to see who pays you."}
        />
        <MerchantList
          title="Expenses"
          hint="Money that went out"
          rows={expenses}
          amount={(g) => formatMoney(g.totalOut)}
          extra={(g) => (g.returned > 0 ? ` · ${formatMoney(g.returned)} given back` : "")}
          categories={categories}
          onPick={(g, id) => {
            setMerchantCategory(g.merchantKey, id);
            setNotice(`Updated ${g.count} row${g.count === 1 ? "" : "s"} for ${displayMerchant(g.sample)}.`);
          }}
          empty={transactions.length ? "No spending merchants match." : "Import a CSV to see where money went."}
        />
      </div>
    </div>
  );
}

function MerchantList({
  title,
  hint,
  rows,
  amount,
  extra,
  categories,
  onPick,
  empty,
}: {
  title: string;
  hint: string;
  rows: PayeeGroup[];
  amount: (g: PayeeGroup) => string;
  extra?: (g: PayeeGroup) => string;
  categories: ReturnType<typeof useBudgetStore.getState>["categories"];
  onPick: (g: PayeeGroup, id: string | null) => void;
  empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((g) => (
          <li key={`${title}-${g.merchantKey}`} className="grid gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{displayMerchant(g.sample)}</div>
                  {g.likelyBill ? <span className="rounded-full bg-chip px-2 py-0.5 text-xs text-muted">Likely bill</span> : null}
                </div>
                <div className="mt-1 text-sm text-muted">
                  {g.count} time{g.count === 1 ? "" : "s"}
                  {g.unassigned ? ` · ${g.unassigned} open` : ""}
                  {extra ? extra(g) : ""}
                </div>
              </div>
              <div className="tabular text-sm font-medium">{amount(g)}</div>
            </div>
            <CategorySelect
              categories={categories}
              value={g.categoryId}
              kind={title === "Income" ? "income" : "expense"}
              onChange={(id) => onPick(g, id)}
            />
          </li>
        ))}
        {rows.length === 0 ? <li className="p-6 text-sm text-muted">{empty}</li> : null}
      </ul>
    </section>
  );
}
