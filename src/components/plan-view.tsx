import { useState } from "react";
import { bucketFunding } from "@/lib/budget/buckets";
import { formatMoney } from "@/lib/budget/money";
import { newId } from "@/lib/budget/ids";
import { periodNoun } from "@/lib/budget/period";
import { hasMonthOverride, orderedCategories, planAmount } from "@/lib/budget/plans";
import { HOUSEHOLD_LABELS, HOUSING_LABELS, STAGE_LABELS } from "@/lib/budget/presets";
import { envelopeRows, plannedTotals } from "@/lib/budget/totals";
import { buildYearWorkbook } from "@/lib/budget/year";
import { cn } from "@/lib/cn";
import { useBudgetStore } from "@/store/budget-store";
import { BucketsPanel } from "./buckets-panel";
import { MonthSwitcher } from "./month-switcher";
import { SummaryCard } from "./summary-card";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

export function PlanView() {
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const wk = useBudgetStore((s) => s.activeWeek);
  const transactions = useBudgetStore((s) => s.transactions);
  const profile = useBudgetStore((s) => s.profile);
  const updateCategory = useBudgetStore((s) => s.updateCategory);
  const addCategory = useBudgetStore((s) => s.addCategory);
  const removeCategory = useBudgetStore((s) => s.removeCategory);
  const setMonthPlan = useBudgetStore((s) => s.setMonthPlan);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const reopenSetup = useBudgetStore((s) => s.reopenSetup);
  const applyRecommendedPlans = useBudgetStore((s) => s.applyRecommendedPlans);
  const period = profile.budgetPeriod;
  const key = period === "week" ? wk : ym;
  const year = ym.slice(0, 4);
  const book = buildYearWorkbook(transactions, categories, year);
  const typicalById = new Map([...book.incomeRows, ...book.expenseRows].map((r) => [r.id, r.typical]));
  const catsForPlan = categories.map((c) => {
    const typical = typicalById.get(c.id) ?? 0;
    const usual = c.plannedMonthly > 0 ? c.plannedMonthly : typical;
    const amount =
      period === "month" && hasMonthOverride(c.id, ym, monthBudgets) ? planAmount(c, ym, monthBudgets) : usual;
    return { ...c, plannedMonthly: amount };
  });
  const rows = envelopeRows(transactions, catsForPlan, period, key);
  const plan = plannedTotals(catsForPlan, period);
  const funding = period === "month" ? bucketFunding(moneyBuckets, ym) : 0;
  const ready = plan.leftover - funding;
  const leftoverActual = rows
    .filter((r) => r.category.kind === "expense")
    .reduce((s, r) => s + r.remaining, 0);
  const [pane, setPane] = useState<"budget" | "buckets">("budget");
  const linkedTo = new Map<string, string>();
  for (const bucket of moneyBuckets) {
    for (const id of bucket.categoryIds) linkedTo.set(id, bucket.name);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">{profile.ledgerName || "Your plan"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Categories reset every month. Buckets keep what you don't spend. A split is a second category under the same group.
          </p>
        </div>
        <MonthSwitcher compact />
      </div>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["budget", "Budget"],
            ["buckets", "Buckets"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={cn("min-h-11 rounded-md px-3 text-sm", pane === id ? "bg-primary text-primary-fg" : "border border-border bg-surface")}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Ready to assign"
          value={formatMoney(ready, { signed: true })}
          sentence="Planned income, minus category plans and this month’s bucket funding."
          warn={ready < 0}
        >
          <p>
            {HOUSEHOLD_LABELS[profile.household]} · {STAGE_LABELS[profile.lifeStage]} · {HOUSING_LABELS[profile.housing]}
            {profile.dependents ? ` · ${profile.dependents} dependent${profile.dependents === 1 ? "" : "s"}` : ""}
          </p>
          <p className="text-muted">
            Typical take-home {formatMoney(profile.monthlyIncome)}
            {profile.incomeStreams?.length ? ` from ${profile.incomeStreams.map((s) => s.name || "Income").join(", ")}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => applyRecommendedPlans(year)}>
              Save typical {year} amounts as my plan
            </Button>
            <Button variant="ghost" size="sm" onClick={() => reopenSetup()}>
              Change household answers
            </Button>
          </div>
        </SummaryCard>
        <SummaryCard
          label="Left in envelopes"
          value={formatMoney(leftoverActual, { signed: true })}
          sentence={`Unspent of this ${periodNoun(period)}’s category plans. Bucket balances are on the other tab.`}
          warn={leftoverActual < 0}
        />
        <SummaryCard
          label="Expense plan"
          value={formatMoney(plan.expenses)}
          sentence={`Income plan ${formatMoney(plan.income)}. Bucket funding this month is ${formatMoney(funding)}, and it is not spending.`}
        />
      </div>
      {pane === "buckets" ? <BucketsPanel /> : null}
      {pane === "budget"
        ? (["income", "expense"] as const).map((kind) => (
        <section key={kind}>
          <h2 className="font-display text-lg font-semibold capitalize">{kind}</h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
            {orderedCategories(categories, kind)
              .filter((c) => rows.some((r) => r.category.id === c.id) || true)
              .map((c) => {
                const r = rows.find((row) => row.category.id === c.id);
                const over = r?.over ?? false;
                const typical = typicalById.get(c.id) ?? 0;
                const actual = r?.actual ?? 0;
                const remaining = r?.remaining ?? 0;
                const monthAmount = planAmount(c, period === "month" ? ym : null, monthBudgets);
                const custom = period === "month" && hasMonthOverride(c.id, ym, monthBudgets);
                const pct = (r?.plan ?? 0) > 0 ? Math.min(100, Math.round((Math.max(0, actual) / (r?.plan ?? 1)) * 100)) : 0;
                const child = Boolean(c.parentId);
                const bucketName = linkedTo.get(c.id);
                return (
                  <li key={c.id} className={`space-y-3 border-b border-border p-3 last:border-0 ${child ? "bg-chip/40" : ""}`}>
                    <Input
                      value={c.name}
                      aria-label={`Name for ${c.name}`}
                      onChange={(e) => updateCategory(c.id, { name: e.target.value })}
                    />
                    {bucketName ? (
                      <p className="text-sm text-muted">
                        This feeds the {bucketName} bucket, so it has no monthly budget. Categories reset every month. Buckets keep what you don't spend.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-muted">
                          Usual plan
                          <Input
                            className="mt-1"
                            inputMode="decimal"
                            aria-label={`Usual plan for ${c.name}`}
                            value={c.plannedMonthly ? String(c.plannedMonthly) : ""}
                            placeholder="Every month"
                            onChange={(e) => updateCategory(c.id, { plannedMonthly: Number(e.target.value) || 0 })}
                          />
                          {typical > 0 ? (
                            <button
                              type="button"
                              className="mt-1 block min-h-9 text-left text-xs text-primary underline-offset-2 hover:underline"
                              onClick={() => updateCategory(c.id, { plannedMonthly: typical })}
                            >
                              Typical {formatMoney(typical)}
                            </button>
                          ) : (
                            <span className="mt-1 block">Standing budget</span>
                          )}
                        </label>
                        <label className="text-xs text-muted">
                          {period === "month" ? "This month" : "This week uses the usual plan"}
                          {period === "month" ? (
                            <Input
                              className="mt-1"
                              inputMode="decimal"
                              aria-label={`This month for ${c.name}`}
                              value={custom ? String(monthAmount) : ""}
                              placeholder="Same as usual"
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                setMonthPlan(c.id, ym, raw ? Number(raw) || 0 : null);
                              }}
                            />
                          ) : (
                            <span className="mt-2 block text-sm">{formatMoney(monthAmount)}</span>
                          )}
                        </label>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-muted">Actual this {periodNoun(period)}</div>
                        <div className={`mt-1 tabular text-sm ${over ? "text-danger" : ""}`}>{formatMoney(actual)}</div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                          <div className={`h-full ${over ? "bg-danger" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">{kind === "expense" ? "Remaining" : "Vs plan"}</div>
                        <div className={`mt-1 tabular text-sm ${remaining < 0 ? "text-danger" : "text-good"}`}>
                          {formatMoney(remaining, { signed: true })}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!child ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            addCategory({
                              slug: `split-${newId("s")}`,
                              name: "Split",
                              kind,
                              plannedMonthly: 0,
                              parentId: c.id,
                            })
                          }
                        >
                          Add a split
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => removeCategory(c.id)}>
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
          </ul>
          <Button
            className="mt-2"
            variant="outline"
            size="sm"
            onClick={() =>
              addCategory({
                slug: `custom-${newId("s")}`,
                name: kind === "income" ? "New income" : "New expense",
                kind,
                plannedMonthly: 0,
              })
            }
          >
            Add {kind} category
          </Button>
        </section>
        ))
      : null}
    </div>
  );
}
