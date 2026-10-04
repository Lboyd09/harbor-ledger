import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { monthEndForecast } from "@/lib/budget/analytics";
import { categoryTrends, incomeStability, recurringBills, typicalMonth } from "@/lib/budget/analytics-depth";
import { bucketFunding } from "@/lib/budget/buckets";
import { TERMS } from "@/lib/copy/terms";
import { formatMoney } from "@/lib/budget/money";
import { newId } from "@/lib/budget/ids";
import { orderedCategories, planAmount, hasMonthOverride } from "@/lib/budget/plans";
import { incomeRows, spendingRows, type SideRow } from "@/lib/budget/readout";
import { categorySpent } from "@/lib/budget/carry";
import { categoryCarries } from "@/lib/budget/style";
import { shiftMonth } from "@/lib/budget/parse-date";
import { budgetLead, carryConsequence, dueLabel, forecastChip, orderSpending, splitFixedFlexible, suggestAmounts } from "@/lib/budget/screen-plan";
import { monthSeries } from "@/lib/budget/visual-data";
import type { BudgetStyle, Category, MonthBudget, Transaction } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { MonthSwitcher } from "./month-switcher";
import { EmptyArt } from "./visuals/empty-art";
import { MiniBars } from "./visuals/mini-bars";
import { FillJar } from "./money-visual";
import { SideSwitch, useMoneySide } from "./side-switch";
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
      <p className="text-sm text-muted">
        Income is not part of this choice. Pay changes, so it is compared with what usually comes in. One category can do the other. Open it and switch. Nothing already saved is deleted.
      </p>
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
  const patchProfile = useBudgetStore((s) => s.patchProfile);
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
  const detail = useBudgetStore((s) => s.profile.detail);
  const streams = useBudgetStore((s) => s.profile.incomeStreams ?? []);
  const [side, setSide] = useMoneySide();
  const today = todayIso();
  const forecast = monthEndForecast({ transactions, categories, ym, today, budgets: monthBudgets });
  const typical = typicalMonth(transactions, categories);
  const steady = incomeStability(transactions, categories);
  const bills = recurringBills(transactions, categories, today);
  const trends = categoryTrends(transactions, categories, ym);
  const plannedSpend = expenses.reduce((sum, category) => sum + planAmount(category, ym, monthBudgets), 0);
  const usualIncome = income.reduce((sum, row) => sum + row.mark, 0);
  const lead = budgetLead({
    plannedSpend,
    usualIncome,
    typicalSpend: typical?.moneyOut ?? null,
    typicalMonths: typical?.months ?? 0,
  });
  const ideas = suggestAmounts(categories, transactions, ym).slice(0, 3);
  const chip = forecast ? forecastChip(forecast.projectedSpend, forecast.planned) : null;
  const ranked = orderSpending(
    expenses
      .map((category) => {
        const row = spending.find((item) => item.id === category.id);
        if (!row) return null;
        return {
          id: category.id,
          name: category.name,
          over: row.tone === "danger",
          risk: row.tone === "warn",
          size: Math.max(row.amount, row.mark),
          category,
          row,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  );
  const groups = typical ? splitFixedFlexible(ranked, typical.fixed.map((item) => item.id), typical.flexible.map((item) => item.id)) : null;

  type SpendItem = (typeof ranked)[number];

  function usualOf(id: string) {
    return [...(typical?.fixed ?? []), ...(typical?.flexible ?? [])].find((item) => item.id === id) ?? null;
  }

  function groupTotal(items: SpendItem[]) {
    const amounts = items.map((item) => usualOf(item.id)?.typical).filter((n): n is number => n != null);
    if (!amounts.length) return null;
    return amounts.reduce((sum, amount) => sum + amount, 0);
  }

  function spendRow(item: SpendItem) {
    const { category, row } = item;
    const open = openId === category.id;
    const child = Boolean(category.parentId);
    const monthAmount = planAmount(category, ym, monthBudgets);
    const custom = hasMonthOverride(category.id, ym, monthBudgets);
    const history = monthSeries(ym, spendHistory(category, ym, transactions, categories, monthBudgets));
    const carries = categoryCarries(category, style);
    const rowChip = forecast ? (row.tone === "danger" ? "Likely over by month end" : row.tone === "warn" ? "Close" : "Fine") : null;
    const groupLabel = typical?.fixed.some((entry) => entry.id === category.id)
      ? "Fixed bill"
      : typical?.flexible.some((entry) => entry.id === category.id)
        ? "Everyday spending"
        : null;
    const trend = trends?.find((entry) => entry.id === category.id);
    const usual = usualOf(category.id);
    return (
      <li key={category.id} className={`rounded-lg border border-border bg-surface p-4 ${child ? "ml-4" : ""}`}>
        <button type="button" className="flex w-full items-start gap-3 text-left" aria-expanded={open} onClick={() => setOpenId(open ? null : category.id)}>
          {carries ? <FillJar pct={row.fill} negative={row.tone === "danger"} overflow={row.fill > 100} /> : null}
          <div className="min-w-0 flex-1">
            <SideHead row={row} showBar={!carries} />
            <p className="mt-1 text-xs text-muted">
              {carries ? "Carries over" : "Starts fresh"}
              {category.carry == null ? " · following your default" : ""}
              {groupLabel ? ` · ${groupLabel}` : ""}
              {rowChip ? ` · ${rowChip}` : ""}
            </p>
          </div>
        </button>
        {open ? (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            <MiniBars months={history} aLabel="Amount" bLabel="Spent" />
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
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Carry over for ${category.name}`}>
              <button
                type="button"
                aria-pressed={category.carry === false}
                className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm ${category.carry === false ? "border-primary bg-chip" : "border-border"}`}
                onClick={() => updateCategory(category.id, { carry: false })}
              >
                This one starts fresh
              </button>
              <button
                type="button"
                aria-pressed={category.carry === true}
                className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm ${category.carry === true ? "border-primary bg-chip" : "border-border"}`}
                onClick={() => {
                  updateCategory(category.id, { carry: true });
                  if (!carryStart) patchProfile({ carryStartMonth: ym });
                }}
              >
                This one carries over
              </button>
            </div>
            {category.carry == null ? (
              <p className="text-xs text-muted">
                This one follows the choice at the top
                {categoryCarries(category, style) ? " and keeps what is left" : " and starts over"}. Switching it keeps the amount and the charges.
              </p>
            ) : (
              <button
                type="button"
                className="min-h-11 text-left text-sm text-muted underline-offset-2 hover:underline"
                onClick={() => updateCategory(category.id, { carry: null })}
              >
                Use the budget’s choice instead. The amount and the charges stay.
              </button>
            )}
            <p className="text-sm">{carryConsequence(row.mark - row.amount, carries)}</p>
            {trend ? (
              <p className="text-sm text-muted">
                {trend.name} is {trend.direction} {Math.abs(trend.percent)} percent versus the earlier months. Based on the last 3 months against the earlier average.
              </p>
            ) : null}
            {bills?.filter((bill) => bill.categoryId === category.id).slice(0, 3).map((bill) => (
              <p key={bill.merchantKey} className="text-sm text-muted">
                {bill.description} usually {formatMoney(bill.usual)}
                {bill.nextDate ? `, next ${bill.nextDate}` : ""}. About {formatMoney(bill.yearly)} a year.
              </p>
            ))}
            {detail === "nerd" ? (
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Numbers behind {category.name}</caption>
                <tbody>
                  <tr><th className="py-1 pr-3 font-medium">This month</th><td className="tabular">{formatMoney(row.amount)}</td></tr>
                  <tr><th className="py-1 pr-3 font-medium">Plan</th><td className="tabular">{formatMoney(row.mark)}</td></tr>
                  <tr><th className="py-1 pr-3 font-medium">Left</th><td className="tabular">{formatMoney(row.mark - row.amount, { signed: true })}</td></tr>
                  {usual ? <tr><th className="py-1 pr-3 font-medium">Typical</th><td className="tabular">{formatMoney(usual.typical)}</td></tr> : null}
                  {groupLabel ? <tr><th className="py-1 pr-3 font-medium">Kind</th><td>{groupLabel}</td></tr> : null}
                  {trend ? <tr><th className="py-1 pr-3 font-medium">Trend</th><td>{trend.percent}%</td></tr> : null}
                </tbody>
              </table>
            ) : null}
            <details>
              <summary className="cursor-pointer text-sm text-muted">More</summary>
              <label className="mt-2 block text-xs text-muted">
                Name
                <Input className="mt-1" aria-label={`Name for ${category.name}`} value={category.name} onChange={(e) => updateCategory(category.id, { name: e.target.value })} />
              </label>
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
  }

  function spendSection(title: string, items: SpendItem[], total: number | null) {
    if (!items.length) return null;
    return (
      <li key={title} className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          {total != null ? <p className="text-sm text-muted">{formatMoney(total)} in a typical month</p> : null}
        </div>
        <ul className="space-y-3">{items.map(spendRow)}</ul>
      </li>
    );
  }

  function renderSpendGroups() {
    if (!groups) return ranked.map(spendRow);
    const hot = new Set(ranked.filter((item) => item.over || item.risk).map((item) => item.id));
    const attention = ranked.filter((item) => hot.has(item.id));
    const fixed = groups.fixed.filter((item) => !hot.has(item.id));
    const flexible = groups.flexible.filter((item) => !hot.has(item.id));
    const rest = groups.rest.filter((item) => !hot.has(item.id));
    return (
      <>
        {spendSection("Over or at risk", attention, null)}
        {spendSection("Fixed bills", fixed, groupTotal(fixed))}
        {spendSection("Everyday spending", flexible, groupTotal(flexible))}
        {spendSection("Other spending", rest, null)}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <p className="font-display text-xl font-semibold">{lead.sentence}</p>
        {lead.cover ? <p className="mt-1 text-sm text-muted">{lead.cover}</p> : null}
        {chip ? <p className="mt-2 text-sm">{chip}. {forecast?.sentence}</p> : null}
        {ideas.map((idea) => (
          <div key={idea.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span>{idea.sentence}</span>
            {idea.suggested != null ? (
              <Button size="sm" variant="outline" onClick={() => updateCategory(idea.id, { plannedMonthly: idea.suggested as number })}>
                Add {formatMoney(idea.suggested)}
              </Button>
            ) : null}
          </div>
        ))}
      </section>
      <SideSwitch side={side} onChange={setSide} />
      <div className="grid gap-6 lg:grid-cols-2">
      <section className={`space-y-3 ${side === "in" ? "block" : "hidden"} lg:block`}>
        <h2 className="font-display text-lg font-semibold">Money in</h2>
        <p className="text-sm text-muted">What arrived, next to what usually arrives. Nothing rolls into next month.</p>
        {steady ? <p className="text-sm text-muted">Pay has ranged from {formatMoney(steady.low)} to {formatMoney(steady.high)}. {steady.sentence}</p> : null}
        <ul className="space-y-3">
          {income.map((row) => {
            const category = categories.find((item) => item.id === row.id);
            if (!category) return null;
            const stream = streams.find((item) => item.categoryId === category.id);
            const due = stream ? dueLabel(stream.matchHints ?? [], stream.cadence, transactions, ym, row.amount) : null;
            return (
              <li key={row.id} className="rounded-lg border border-border bg-surface p-4">
                <SideHead row={row} />
                {due ? <p className="mt-2 text-sm font-medium">{due}</p> : null}
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

      <section className={`space-y-3 ${side === "out" ? "block" : "hidden"} lg:block`}>
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
          {renderSpendGroups()}
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
    </div>
  );
}

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function SideHead({ row, showBar = true }: { row: SideRow; showBar?: boolean }) {
  const width = Math.max(0, Math.min(100, row.fill));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{row.name}</p>
        <p className={`text-sm tabular ${row.tone === "danger" ? "text-danger" : row.tone === "warn" ? "text-warn" : row.tone === "good" ? "text-good" : ""}`}>
          {row.primary}
        </p>
      </div>
      {showBar ? (
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-chip" aria-hidden>
          <div className={`h-full ${row.tone === "danger" ? "bg-danger" : "bg-primary"}`} style={{ width: `${width}%` }} />
        </div>
      ) : null}
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
