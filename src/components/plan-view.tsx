import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { bucketFunding } from "@/lib/budget/buckets";
import { TERMS } from "@/lib/copy/terms";
import { formatMoney } from "@/lib/budget/money";
import { newId } from "@/lib/budget/ids";
import { orderedCategories, planAmount, hasMonthOverride } from "@/lib/budget/plans";
import { incomeRows, spendingRows, type SideRow } from "@/lib/budget/readout";
import { categorySpent } from "@/lib/budget/carry";
import { shiftMonth } from "@/lib/budget/parse-date";
import { monthSeries } from "@/lib/budget/visual-data";
import type { BudgetStyle, Category, MonthBudget, Transaction } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { MonthSwitcher } from "./month-switcher";
import { EmptyArt } from "./visuals/empty-art";
import { MiniBars } from "./visuals/mini-bars";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

export function PlanView() {
  const style: BudgetStyle = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const setBudgetStyle = useBudgetStore((s) => s.setBudgetStyle);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Budget</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Rent, groceries, insurance, and eating out live here. A savings fund is separate and is not this budget.
          </p>
        </div>
        <MonthSwitcher compact />
      </div>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="How leftover spending works">
        <button
          type="button"
          aria-pressed={style === "monthly"}
          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm ${style === "monthly" ? "border-primary bg-chip" : "border-border bg-surface"}`}
          onClick={() => setBudgetStyle("monthly")}
        >
          <span className="font-medium">{TERMS.monthlyReset}</span>
          <span className="mt-1 block text-muted">Each spending category starts over.</span>
        </button>
        <button
          type="button"
          aria-pressed={style === "buckets"}
          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm ${style === "buckets" ? "border-primary bg-chip" : "border-border bg-surface"}`}
          onClick={() => setBudgetStyle("buckets")}
        >
          <span className="font-medium">{TERMS.carryOver}</span>
          <span className="mt-1 block text-muted">Leftover spending stays in that category.</span>
        </button>
      </div>
      <p className="text-sm text-muted">Income is not part of this choice. Pay changes, so it is compared with what usually comes in.</p>
      <BudgetSides style={style} />
    </div>
  );
}

function BudgetSides({ style }: { style: BudgetStyle }) {
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const transactions = useBudgetStore((s) => s.transactions);
  const updateCategory = useBudgetStore((s) => s.updateCategory);
  const addCategory = useBudgetStore((s) => s.addCategory);
  const removeCategory = useBudgetStore((s) => s.removeCategory);
  const setMonthPlan = useBudgetStore((s) => s.setMonthPlan);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const carryStart = useBudgetStore((s) => s.profile.carryStartMonth);
  const [openId, setOpenId] = useState<string | null>(null);
  const income = incomeRows({ transactions, categories, ym, budgets: monthBudgets });
  const spending = spendingRows({
    transactions,
    categories,
    ym,
    budgets: monthBudgets,
    style,
    carryStartMonth: carryStart,
  });
  const funding = bucketFunding(moneyBuckets, ym);
  const expenses = orderedCategories(categories, "expense");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Money in</h2>
        <p className="text-sm text-muted">What arrived, next to what usually arrives. Nothing rolls into next month.</p>
        <ul className="space-y-3">
          {income.map((row) => {
            const category = categories.find((item) => item.id === row.id);
            if (!category) return null;
            return (
              <li key={row.id} className="rounded-lg border border-border bg-surface p-4">
                <SideHead row={row} />
                <label className="mt-3 block text-xs text-muted">
                  Usual amount, if you want one
                  <Input
                    className="mt-1 max-w-xs"
                    inputMode="decimal"
                    aria-label={`Usual amount for ${category.name}`}
                    value={category.plannedMonthly ? String(category.plannedMonthly) : ""}
                    placeholder="0"
                    onChange={(e) => updateCategory(category.id, { plannedMonthly: Number(e.target.value) || 0, name: category.name })}
                  />
                </label>
                <label className="mt-2 block text-xs text-muted">
                  Name
                  <Input className="mt-1" aria-label={`Name for ${category.name}`} value={category.name} onChange={(e) => updateCategory(category.id, { name: e.target.value })} />
                </label>
              </li>
            );
          })}
        </ul>
        <Button variant="outline" size="sm" onClick={() => addCategory({ slug: `income-${newId("s")}`, name: "Other income", kind: "income", plannedMonthly: 0 })}>
          Add income
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Money out</h2>
        <p className="text-sm text-muted">
          {style === "buckets"
            ? "What’s left stays in the category. The bar is that leftover, full at three months of the amount."
            : "The bar is what you spent against this month’s amount. Next month starts over."}
        </p>
        {expenses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
            <EmptyArt kind="budget" />
            <p className="text-sm">No spending categories yet. Add one below.</p>
          </div>
        ) : null}
        <ul className="space-y-3">
          {expenses.map((category) => {
            const row = spending.find((item) => item.id === category.id);
            if (!row) return null;
            const open = openId === category.id;
            const child = Boolean(category.parentId);
            const monthAmount = planAmount(category, ym, monthBudgets);
            const custom = hasMonthOverride(category.id, ym, monthBudgets);
            const history = monthSeries(ym, spendHistory(category, ym, transactions, categories, monthBudgets));
            return (
              <li key={category.id} className={`rounded-lg border border-border bg-surface p-4 ${child ? "ml-4" : ""}`}>
                <button type="button" className="w-full text-left" aria-expanded={open} onClick={() => setOpenId(open ? null : category.id)}>
                  <SideHead row={row} />
                </button>
                {open ? (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <MiniBars months={history} aLabel="Amount" bLabel="Spent" />
                    <label className="block text-xs text-muted">
                      Name
                      <Input className="mt-1" aria-label={`Name for ${category.name}`} value={category.name} onChange={(e) => updateCategory(category.id, { name: e.target.value })} />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted">
                        Usual amount
                        <Input
                          className="mt-1"
                          inputMode="decimal"
                          aria-label={`Monthly amount for ${category.name}`}
                          value={category.plannedMonthly ? String(category.plannedMonthly) : ""}
                          placeholder="0"
                          onChange={(e) => updateCategory(category.id, { plannedMonthly: Number(e.target.value) || 0 })}
                        />
                      </label>
                      <label className="text-xs text-muted">
                        This month only
                        <Input
                          className="mt-1"
                          inputMode="decimal"
                          aria-label={`This month for ${category.name}`}
                          value={custom ? String(monthAmount) : ""}
                          placeholder="Same"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            setMonthPlan(category.id, ym, raw ? Number(raw) || 0 : null);
                          }}
                        />
                      </label>
                    </div>
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
                                name: `${category.name} part`,
                                kind: "expense",
                                plannedMonthly: 0,
                                parentId: category.id,
                              })
                            }
                          >
                            Add a part
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => removeCategory(category.id)}>
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
        <Button variant="outline" size="sm" onClick={() => addCategory({ slug: `custom-${newId("s")}`, name: "New category", kind: "expense", plannedMonthly: 0 })}>
          Add a spending category
        </Button>
        {funding > 0 ? (
          <p className="text-sm text-muted">
            {formatMoney(funding)} is set aside in funds this month. That is extra savings, not these categories.{" "}
            <Link to="/funds" className="font-medium text-primary">
              Funds
            </Link>
          </p>
        ) : (
          <p className="text-sm text-muted">
            Saving for one purchase is a fund, not a category.{" "}
            <Link to="/funds" className="font-medium text-primary">
              Funds
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

function SideHead({ row }: { row: SideRow }) {
  const width = Math.max(0, Math.min(100, row.fill));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{row.name}</p>
        <p className={`text-sm tabular ${row.tone === "danger" ? "text-danger" : row.tone === "warn" ? "text-warn" : row.tone === "good" ? "text-good" : ""}`}>
          {row.primary}
        </p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-chip" aria-hidden>
        <div className={`h-full ${row.tone === "danger" ? "bg-danger" : "bg-primary"}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">{row.detail}</p>
    </div>
  );
}

function spendHistory(
  category: Category,
  ym: string,
  transactions: Transaction[],
  categories: Category[],
  budgets: MonthBudget[],
) {
  const rows: { ym: string; a: number; b: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const month = shiftMonth(ym, -i);
    rows.push({
      ym: month,
      a: planAmount(category, month, budgets),
      b: categorySpent(transactions, categories, category.id, month),
    });
  }
  return rows;
}
