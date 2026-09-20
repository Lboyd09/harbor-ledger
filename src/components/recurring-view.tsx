import { formatMoney } from "@/lib/budget/money";
import { displayMerchant } from "@/lib/budget/merchant";
import { findRecurringAll } from "@/lib/budget/recurring";
import { useBudgetStore } from "@/store/budget-store";
import { CategorySelect } from "./category-select";
import { Button } from "./ui/button";

const INTERVAL_COPY = {
  weekly: "About weekly",
  biweekly: "About every two weeks",
  monthly: "About monthly",
  irregular: "Repeats, uneven spacing",
};

export function RecurringView() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const groups = findRecurringAll(transactions);
  const incoming = groups.filter((g) => g.direction === "in");
  const outgoing = groups.filter((g) => g.direction === "out");

  function assignAll(merchantKey: string, categoryId: string | null) {
    const txs = transactions.filter((t) => t.merchantKey === merchantKey);
    const last = txs[0];
    if (!last) return;
    setTransactionCategory(last.id, categoryId, true);
  }

  function Block({ title, items }: { title: string; items: typeof groups }) {
    return (
      <section>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
          {items.map((g) => (
            <li key={`${g.direction}-${g.merchantKey}`} className="grid gap-3 p-4 md:grid-cols-2">
              <div>
                <div className="font-medium">{displayMerchant(g.sampleDescription)}</div>
                <div className="text-sm text-muted">
                  {INTERVAL_COPY[g.interval]} · {g.count} times · {g.firstDate} → {g.lastDate} · typical{" "}
                  {formatMoney(g.avgAmount)}
                </div>
                <div className="mt-1 truncate text-xs text-muted">{g.sampleDescription}</div>
              </div>
              <div className="space-y-2">
                <CategorySelect
                  categories={categories}
                  value={g.categoryId}
                  onChange={(id) => assignAll(g.merchantKey, id)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!g.categoryId}
                  onClick={() => assignAll(g.merchantKey, g.categoryId)}
                >
                  Apply to all of this merchant
                </Button>
              </div>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="p-6 text-sm text-muted">Need at least two similar amounts for this direction.</li>
          ) : null}
        </ul>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Repeating money</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Paychecks and bills both show here when the merchant repeats. Interval is the median gap: weekly 5–9 days,
          biweekly 12–17, monthly 26–36. Amounts may differ by up to 35%.
        </p>
      </div>
      <Block title="Coming in" items={incoming} />
      <Block title="Going out" items={outgoing} />
    </div>
  );
}
