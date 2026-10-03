import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { bucketFunding } from "@/lib/budget/buckets";
import { formatMoney } from "@/lib/budget/money";
import { newId } from "@/lib/budget/ids";
import { orderedCategories, planAmount, hasMonthOverride } from "@/lib/budget/plans";
import { envelopeRows, plannedTotals } from "@/lib/budget/totals";
import { useBudgetStore } from "@/store/budget-store";
import { queueFundWizard } from "./fund-wizard";
import { SpendMeter } from "./money-visual";
import { MonthSwitcher } from "./month-switcher";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

export function PlanView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Budget</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">These amounts start over every month. A fund, on its own tab, keeps what you don’t spend.</p>
        </div>
        <MonthSwitcher compact />
      </div>
      <BudgetList />
    </div>
  );
}

function BudgetList() {
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const transactions = useBudgetStore((s) => s.transactions);
  const updateCategory = useBudgetStore((s) => s.updateCategory);
  const addCategory = useBudgetStore((s) => s.addCategory);
  const removeCategory = useBudgetStore((s) => s.removeCategory);
  const setMonthPlan = useBudgetStore((s) => s.setMonthPlan);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const linked = new Set(moneyBuckets.flatMap((b) => b.categoryIds));
  const rows = envelopeRows(transactions, categories, "month", ym);
  const plan = plannedTotals(
    categories.filter((c) => !linked.has(c.id)),
    "month",
  );
  const funding = bucketFunding(moneyBuckets, ym);
  const ready = plan.leftover - funding;
  const incomeWidth = plan.income > 0 ? Math.min(100, Math.round((Math.max(0, plan.expenses + funding) / plan.income) * 100)) : 0;
  const expenses = orderedCategories(categories, "expense").filter((c) => !linked.has(c.id));

  function keepInFund(categoryId: string) {
    queueFundWizard(categoryId);
    void navigate({ to: "/funds" });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Not given a job yet</div>
        <div className={`mt-1 font-display text-3xl tabular ${ready < 0 ? "text-danger" : "text-good"}`}>
          {formatMoney(ready, { signed: true })}
        </div>
        <p className="mt-1 text-sm text-muted">
          {ready < 0
            ? "The monthly amounts and funds add up to more than the income you planned."
            : ready === 0
              ? "Every planned dollar has a job."
              : "This is planned income that is not in a monthly amount or a fund yet."}
        </p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-chip">
          <div className={`h-full ${incomeWidth > 100 ? "bg-danger" : "bg-primary"}`} style={{ width: `${Math.min(100, incomeWidth)}%` }} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Starts over every month</h2>
        <p className="text-sm text-muted">The bar is what you spent against this month’s amount. Next month starts over. Tap a row to change it.</p>
        <ul className="space-y-3">
          {expenses.map((c) => {
            const row = rows.find((r) => r.category.id === c.id);
            const spent = Math.max(0, row?.actual ?? 0);
            const monthAmount = planAmount(c, ym, monthBudgets);
            const custom = hasMonthOverride(c.id, ym, monthBudgets);
            const child = Boolean(c.parentId);
            const open = openId === c.id;
            const left = monthAmount - spent;
            return (
              <li key={c.id} className={`rounded-lg border border-border bg-surface p-4 ${child ? "ml-4" : ""}`}>
                <button type="button" className="w-full text-left" aria-expanded={open} onClick={() => setOpenId(open ? null : c.id)}>
                  <div className="font-medium">{c.name}</div>
                  <div className="mt-3">
                    <SpendMeter spent={spent} plan={monthAmount} />
                  </div>
                  <p className="mt-2 text-sm">
                    {monthAmount > 0 ? (
                      <span className={left < -0.004 ? "text-danger" : ""}>
                        {left < -0.004 ? `${formatMoney(Math.abs(left))} over` : `${formatMoney(left)} left this month`}
                      </span>
                    ) : (
                      <span className="text-muted">{formatMoney(spent)} spent. No monthly amount yet.</span>
                    )}
                  </p>
                </button>
                {open ? (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <label className="block text-xs text-muted">
                      Name
                      <Input className="mt-1" aria-label={`Name for ${c.name}`} value={c.name} onChange={(e) => updateCategory(c.id, { name: e.target.value })} />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted">
                        Every month
                        <Input
                          className="mt-1"
                          inputMode="decimal"
                          aria-label={`Monthly amount for ${c.name}`}
                          value={c.plannedMonthly ? String(c.plannedMonthly) : ""}
                          placeholder="0"
                          onChange={(e) => updateCategory(c.id, { plannedMonthly: Number(e.target.value) || 0 })}
                        />
                      </label>
                      <label className="text-xs text-muted">
                        This month only
                        <Input
                          className="mt-1"
                          inputMode="decimal"
                          aria-label={`This month for ${c.name}`}
                          value={custom ? String(monthAmount) : ""}
                          placeholder="Same"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            setMonthPlan(c.id, ym, raw ? Number(raw) || 0 : null);
                          }}
                        />
                      </label>
                    </div>
                    {!child ? (
                      <div>
                        <p className="text-sm font-medium">When the month ends</p>
                        <p className="mt-1 text-xs text-muted">Start over means next month begins again. A fund keeps what you don’t spend.</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <button type="button" className="min-h-11 rounded-md border border-primary bg-chip px-3 text-left text-sm" aria-pressed="true">
                            Start over
                          </button>
                          <button type="button" className="min-h-11 rounded-md border border-border bg-surface px-3 text-left text-sm" onClick={() => keepInFund(c.id)}>
                            Keep what’s left in a Fund
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <details>
                      <summary className="cursor-pointer text-sm text-muted">More</summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!child ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              addCategory({
                                slug: `split-${newId("s")}`,
                                name: `${c.name} part`,
                                kind: "expense",
                                plannedMonthly: 0,
                                parentId: c.id,
                              })
                            }
                          >
                            Add a part
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => removeCategory(c.id)}>
                          Remove
                        </Button>
                      </div>
                    </details>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addCategory({ slug: `custom-${newId("s")}`, name: "New category", kind: "expense", plannedMonthly: 0 })}
        >
          Add a spending category
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Money coming in</h2>
        <p className="text-sm text-muted">What usually comes in. The bar is this month’s deposits against that amount.</p>
        <ul className="space-y-3">
          {orderedCategories(categories, "income").map((c) => {
            const row = rows.find((r) => r.category.id === c.id);
            const got = Math.max(0, row?.actual ?? 0);
            return (
              <li key={c.id} className="rounded-lg border border-border bg-surface p-4">
                <Input aria-label={`Name for ${c.name}`} value={c.name} onChange={(e) => updateCategory(c.id, { name: e.target.value })} />
                <div className="mt-3">
                  <SpendMeter spent={got} plan={c.plannedMonthly} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {formatMoney(got)} in this month. You planned {formatMoney(c.plannedMonthly)}.
                </p>
                <label className="mt-2 block text-xs text-muted">
                  Every month
                  <Input
                    className="mt-1 max-w-xs"
                    inputMode="decimal"
                    value={c.plannedMonthly ? String(c.plannedMonthly) : ""}
                    onChange={(e) => updateCategory(c.id, { plannedMonthly: Number(e.target.value) || 0 })}
                  />
                </label>
              </li>
            );
          })}
        </ul>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addCategory({ slug: `income-${newId("s")}`, name: "Other income", kind: "income", plannedMonthly: 0 })}
        >
          Add income
        </Button>
      </section>
    </div>
  );
}
