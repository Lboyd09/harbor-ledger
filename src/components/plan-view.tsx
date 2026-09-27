import { formatMoney } from "@/lib/budget/money";
import { newId } from "@/lib/budget/ids";
import { periodNoun } from "@/lib/budget/period";
import { HOUSEHOLD_LABELS, HOUSING_LABELS, STAGE_LABELS } from "@/lib/budget/presets";
import { envelopeRows, plannedTotals } from "@/lib/budget/totals";
import { buildYearWorkbook } from "@/lib/budget/year";
import { useBudgetStore } from "@/store/budget-store";
import { MonthSwitcher } from "./month-switcher";
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
  const reopenSetup = useBudgetStore((s) => s.reopenSetup);
  const applyRecommendedPlans = useBudgetStore((s) => s.applyRecommendedPlans);
  const period = profile.budgetPeriod;
  const key = period === "week" ? wk : ym;
  const year = ym.slice(0, 4);
  const book = buildYearWorkbook(transactions, categories, year);
  const typicalById = new Map([...book.incomeRows, ...book.expenseRows].map((r) => [r.id, r.typical]));
  const catsForPlan = categories.map((c) => {
    const typical = typicalById.get(c.id) ?? 0;
    return { ...c, plannedMonthly: c.plannedMonthly > 0 ? c.plannedMonthly : typical };
  });
  const rows = envelopeRows(transactions, catsForPlan, period, key);
  const plan = plannedTotals(catsForPlan, period);
  const leftoverActual = rows
    .filter((r) => r.category.kind === "expense")
    .reduce((s, r) => s + r.remaining, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">{profile.ledgerName || "Your plan"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            These amounts are monthly. The Month page shows how one month compares. Income and expenses are listed
            separately. A blank plan uses the typical month from {year} until you type your own.
          </p>
        </div>
        <MonthSwitcher compact />
      </div>
      <div className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p>
          {HOUSEHOLD_LABELS[profile.household]} · {STAGE_LABELS[profile.lifeStage]} · {HOUSING_LABELS[profile.housing]}
          {profile.dependents ? ` · ${profile.dependents} dependent${profile.dependents === 1 ? "" : "s"}` : ""}
        </p>
        <p className="mt-1 text-muted">
          Typical take-home {formatMoney(profile.monthlyIncome)}
          {profile.incomeStreams?.length
            ? ` from ${profile.incomeStreams.map((s) => s.name || "Income").join(", ")}`
            : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => applyRecommendedPlans(year)}>
            Save typical {year} amounts as my plan
          </Button>
          <Button variant="ghost" size="sm" onClick={() => reopenSetup()}>
            Change household answers
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Ready to assign</div>
          <div className={`mt-1 font-display text-2xl tabular ${plan.leftover < 0 ? "text-danger" : "text-good"}`}>
            {formatMoney(plan.leftover, { signed: true })}
          </div>
          <p className="mt-1 text-xs text-muted">Planned income minus planned envelopes</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Left in envelopes</div>
          <div className={`mt-1 font-display text-2xl tabular ${leftoverActual < 0 ? "text-danger" : ""}`}>
            {formatMoney(leftoverActual, { signed: true })}
          </div>
          <p className="mt-1 text-xs text-muted">Unspent of this {periodNoun(period)}’s plans</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Expense plan</div>
          <div className="mt-1 font-display text-2xl tabular">{formatMoney(plan.expenses)}</div>
          <p className="mt-1 text-xs text-muted">Income plan {formatMoney(plan.income)}</p>
        </div>
      </div>
      {(["income", "expense"] as const).map((kind) => (
        <section key={kind}>
          <h2 className="font-display text-lg font-semibold capitalize">{kind}</h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
            {rows
              .filter((r) => r.category.kind === kind)
              .map((r) => {
                const c = categories.find((x) => x.id === r.category.id) ?? r.category;
                const over = r.over;
                const typical = typicalById.get(c.id) ?? 0;
                const pct = r.plan > 0 ? Math.min(100, Math.round((Math.max(0, r.actual) / r.plan) * 100)) : 0;
                return (
                  <li key={c.id} className="grid gap-2 p-3 md:grid-cols-5 md:items-center">
                    <Input value={c.name} onChange={(e) => updateCategory(c.id, { name: e.target.value })} />
                    <label className="text-xs text-muted">
                      Monthly budget
                      <Input
                        className="mt-1"
                        inputMode="decimal"
                        aria-label={`Monthly budget for ${c.name}`}
                        value={c.plannedMonthly ? String(c.plannedMonthly) : ""}
                        placeholder="Type an amount"
                        onChange={(e) => updateCategory(c.id, { plannedMonthly: Number(e.target.value) || 0 })}
                      />
                      {typical > 0 ? (
                        <button
                          type="button"
                          className="mt-1 block text-xs text-primary underline-offset-2 hover:underline"
                          onClick={() => updateCategory(c.id, { plannedMonthly: typical })}
                        >
                          Typical {formatMoney(typical)} / month
                        </button>
                      ) : (
                        <span className="mt-1 block">Stored as monthly {formatMoney(c.plannedMonthly)}</span>
                      )}
                    </label>
                    <div>
                      <div className="text-xs text-muted">Actual this {periodNoun(period)}</div>
                      <div className={`mt-2 tabular text-sm ${over ? "text-danger" : ""}`}>{formatMoney(r.actual)}</div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                        <div className={`h-full ${over ? "bg-danger" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">{kind === "expense" ? "Remaining" : "Vs plan"}</div>
                      <div className={`mt-2 tabular text-sm ${r.remaining < 0 ? "text-danger" : "text-good"}`}>
                        {formatMoney(r.remaining, { signed: true })}
                      </div>
                      <div className={`mt-1 text-xs ${over ? "text-danger" : "text-muted"}`}>
                        {over ? "Over" : r.plan > 0 ? "On track" : "No plan"}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeCategory(c.id)}>
                      Remove
                    </Button>
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
      ))}
    </div>
  );
}
