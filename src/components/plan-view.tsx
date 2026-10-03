import { useState } from "react";
import { bucketBalance, bucketFunding } from "@/lib/budget/buckets";
import { formatMoney } from "@/lib/budget/money";
import { newId } from "@/lib/budget/ids";
import { orderedCategories, planAmount, hasMonthOverride } from "@/lib/budget/plans";
import { currentMonthKey } from "@/lib/budget/parse-date";
import { envelopeRows, plannedTotals } from "@/lib/budget/totals";
import { useBudgetStore } from "@/store/budget-store";
import { FillJar, SpendMeter } from "./money-visual";
import { MonthSwitcher } from "./month-switcher";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

export function PlanView() {
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const transactions = useBudgetStore((s) => s.transactions);
  const profile = useBudgetStore((s) => s.profile);
  const updateCategory = useBudgetStore((s) => s.updateCategory);
  const addCategory = useBudgetStore((s) => s.addCategory);
  const removeCategory = useBudgetStore((s) => s.removeCategory);
  const setMonthPlan = useBudgetStore((s) => s.setMonthPlan);
  const setKeepsLeftovers = useBudgetStore((s) => s.setKeepsLeftovers);
  const updateBucket = useBudgetStore((s) => s.updateBucket);
  const addBucket = useBudgetStore((s) => s.addBucket);
  const removeBucket = useBudgetStore((s) => s.removeBucket);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const rows = envelopeRows(transactions, categories, "month", ym);
  const plan = plannedTotals(categories, "month");
  const funding = bucketFunding(moneyBuckets, ym);
  const ready = plan.leftover - funding;
  const incomeWidth = plan.income > 0 ? Math.min(100, Math.round((Math.max(0, plan.expenses + funding) / plan.income) * 100)) : 0;
  const jars = moneyBuckets.filter((b) => b.categoryIds.length === 0);
  const [goalName, setGoalName] = useState("");
  const [goalMonthly, setGoalMonthly] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Give every dollar a job</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Set what each category gets this month. Most categories start over next month. Turn on Keep leftovers when you are saving for something — a car, a trip — and what you don’t spend stays there.
          </p>
        </div>
        <MonthSwitcher compact />
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Still to place</div>
        <div className={`mt-1 font-display text-3xl tabular ${ready < 0 ? "text-danger" : "text-good"}`}>
          {formatMoney(ready, { signed: true })}
        </div>
        <p className="mt-1 text-sm text-muted">
          {ready < 0
            ? "The monthly amounts add up to more than the income you planned. Lower one, or raise income."
            : ready === 0
              ? "Every planned dollar has a category."
              : "This is income you planned that is not in a category yet. Add it to one below."}
        </p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-chip">
          <div className={`h-full ${incomeWidth > 100 ? "bg-danger" : "bg-primary"}`} style={{ width: `${Math.min(100, incomeWidth)}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          The bar is planned spending and savings against {formatMoney(plan.income)} of planned income.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Spending</h2>
        <ul className="space-y-3">
          {orderedCategories(categories, "expense").map((c) => {
            const bucket = moneyBuckets.find((b) => b.categoryIds.includes(c.id));
            const row = rows.find((r) => r.category.id === c.id);
            const spent = Math.max(0, row?.actual ?? 0);
            const monthAmount = planAmount(c, ym, monthBudgets);
            const custom = hasMonthOverride(c.id, ym, monthBudgets);
            const child = Boolean(c.parentId);
            return (
              <li key={c.id} className={`rounded-lg border border-border bg-surface p-4 ${child ? "ml-4" : ""}`}>
                <div className="flex items-start gap-3">
                  {bucket ? (
                    <FillJar
                      pct={
                        bucket.target && bucket.target > 0
                          ? (bucketBalance(bucket, ym, transactions, categories, moves) / bucket.target) * 100
                          : bucket.monthly > 0
                            ? (bucketBalance(bucket, ym, transactions, categories, moves) / (bucket.monthly * 6)) * 100
                            : 0
                      }
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <Input aria-label={`Name for ${c.name}`} value={c.name} onChange={(e) => updateCategory(c.id, { name: e.target.value })} />
                    {bucket ? (
                      <>
                        <div className="mt-2 font-display text-2xl tabular">
                          {formatMoney(bucketBalance(bucket, ym, transactions, categories, moves))}
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          Saved here. {formatMoney(bucket.monthly)} goes in every month, and spending in this category comes out. It does not also have a monthly limit, so it is not counted twice.
                        </p>
                        <label className="mt-2 block text-xs text-muted">
                          Add each month
                          <Input
                            className="mt-1"
                            inputMode="decimal"
                            aria-label={`Monthly add for ${c.name}`}
                            value={bucket.monthly ? String(bucket.monthly) : ""}
                            onChange={(e) => updateBucket(bucket.id, { monthly: Number(e.target.value) || 0 })}
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <div className="mt-3">
                          <SpendMeter spent={spent} plan={monthAmount} />
                        </div>
                        <p className="mt-2 text-sm">
                          {formatMoney(spent)} spent
                          {monthAmount > 0 ? ` of ${formatMoney(monthAmount)}` : ""}.{" "}
                          {monthAmount > 0 ? (
                            <span className={spent > monthAmount ? "text-danger" : "text-muted"}>
                              {spent > monthAmount
                                ? `${formatMoney(spent - monthAmount)} over.`
                                : `${formatMoney(monthAmount - spent)} left this month.`}
                            </span>
                          ) : (
                            <span className="text-muted">No monthly amount yet.</span>
                          )}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
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
                      </>
                    )}
                    <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(bucket)}
                        onChange={(e) => setKeepsLeftovers(c.id, e.target.checked)}
                      />
                      Keep leftovers
                    </label>
                    <p className="text-xs text-muted">
                      {bucket
                        ? "On. Unspent money stays in the jar. Next month does not reset it."
                        : "Off. Next month starts again at the monthly amount. Unspent money does not carry."}
                    </p>
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
                  </div>
                </div>
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
        <h2 className="font-display text-lg font-semibold">Saving for something</h2>
        <p className="text-sm text-muted">
          This is not a bill. Harbor adds the monthly amount and keeps it. It is not income and it is not spending. Tie it to a category above with Keep leftovers if purchases should come out of it.
        </p>
        <ul className="space-y-3">
          {jars.map((b) => {
            const balance = bucketBalance(b, ym, transactions, categories, moves);
            const pct = b.target && b.target > 0 ? (balance / b.target) * 100 : b.monthly > 0 ? (balance / (b.monthly * 12)) * 100 : 0;
            return (
              <li key={b.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
                <FillJar pct={pct} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{b.name}</div>
                  <div className="font-display text-2xl tabular">{formatMoney(balance)}</div>
                  <p className="text-sm text-muted">
                    {b.target ? `${formatMoney(balance)} of ${formatMoney(b.target)}. ` : ""}
                    {formatMoney(b.monthly)} added each month since {b.startMonth}.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs text-muted">
                      Each month
                      <Input className="mt-1" inputMode="decimal" value={String(b.monthly)} onChange={(e) => updateBucket(b.id, { monthly: Number(e.target.value) || 0 })} />
                    </label>
                    <label className="text-xs text-muted">
                      Goal
                      <Input
                        className="mt-1"
                        inputMode="decimal"
                        value={b.target ? String(b.target) : ""}
                        placeholder="Optional"
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          updateBucket(b.id, { target: Number.isFinite(n) && n > 0 ? n : null });
                        }}
                      />
                    </label>
                  </div>
                  <Button className="mt-2" variant="ghost" size="sm" onClick={() => removeBucket(b.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input aria-label="Saving name" placeholder="Car, trip, emergency" value={goalName} onChange={(e) => setGoalName(e.target.value)} />
          <Input aria-label="Each month" inputMode="decimal" placeholder="Each month" value={goalMonthly} onChange={(e) => setGoalMonthly(e.target.value)} />
          <Input aria-label="Goal amount" inputMode="decimal" placeholder="Goal, optional" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!goalName.trim() || !(Number(goalMonthly) > 0)}
          onClick={() => {
            addBucket({
              name: goalName.trim(),
              monthly: Number(goalMonthly) || 0,
              yearly: null,
              categoryIds: [],
              target: Number(goalTarget) > 0 ? Number(goalTarget) : null,
              by: null,
              startMonth: ym || currentMonthKey(),
              opening: 0,
            });
            setGoalName("");
            setGoalMonthly("");
            setGoalTarget("");
          }}
        >
          Start saving
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Money you expect</h2>
        <p className="text-sm text-muted">What usually comes in. The bar compares this month’s deposits to that amount.</p>
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
