import { Link } from "@tanstack/react-router";
import { monthEndForecast } from "@/lib/budget/analytics";
import { amountDraft, usualAmountCommit } from "@/lib/budget/amount-input";
import { incomeStability, typicalMonth } from "@/lib/budget/analytics-depth";
import { monthLedger } from "@/lib/budget/ledger-month";
import { TERMS } from "@/lib/copy/terms";
import { formatMoney } from "@/lib/budget/money";
import { newId } from "@/lib/budget/ids";
import { orderedCategories, planAmount } from "@/lib/budget/plans";
import { incomeRows, spendingRows, type SideRow } from "@/lib/budget/readout";
import { budgetLead, categoryStory, dueLabel, forecastChip, orderSpending, splitFixedFlexible, suggestAmounts } from "@/lib/budget/screen-plan";
import { categoryCarries } from "@/lib/budget/style";
import type { BudgetStyle } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { EmptyArt } from "./visuals/empty-art";
import { AmountField } from "./amount-field";
import { FillJar, SpendMeter } from "./money-visual";
import { openCategoryPanel } from "./category-panel";
import { SideSwitch, useMoneySide } from "./side-switch";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

export function AmountsPage({ showStyle = true }: { showStyle?: boolean }) {
  const style: BudgetStyle = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const setBudgetStyle = useBudgetStore((s) => s.setBudgetStyle);
  return (
    <div className="space-y-6">
      {showStyle ? (
        <>
          <p className="max-w-xl text-sm text-muted">
            Rent, groceries, insurance, and eating out live here. A savings fund is separate and is not this budget.
          </p>
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
        </>
      ) : null}
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
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const carryStart = useBudgetStore((s) => s.profile.carryStartMonth);
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const setAsides = useBudgetStore((s) => s.setAsides) ?? [];
  const profile = useBudgetStore((s) => s.profile);
  const ledger = monthLedger(
    { transactions, categories, budgets: monthBudgets, buckets: moneyBuckets, moves, setAsides, style, carryStartMonth: carryStart, profile },
    ym,
  );
  const income = incomeRows({ transactions, categories, ym, budgets: monthBudgets, profile });
  const spending = spendingRows({
    transactions,
    categories,
    ym,
    budgets: monthBudgets,
    style,
    carryStartMonth: carryStart,
    setAsides,
  });
  const funding = ledger.totals.savedToFunds;
  const expenses = orderedCategories(categories, "expense");
  const streams = useBudgetStore((s) => s.profile.incomeStreams ?? []);
  const [side, setSide] = useMoneySide();
  const today = todayIso();
  const forecast = monthEndForecast({ transactions, categories, ym, today, budgets: monthBudgets });
  const typical = typicalMonth(transactions, categories);
  const steady = incomeStability(transactions, categories);
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
    const line = ledger.spending.find((entry) => entry.id === category.id);
    const story = line ? categoryStory(line) : null;
    const carries = line?.carries ?? categoryCarries(category, style);
    const linked = moneyBuckets.find((fund) => fund.categoryIds.includes(category.id));
    const big = line ? formatMoney(line.left, { signed: true }) : row.primary;
    const child = Boolean(category.parentId);
    return (
      <li key={category.id} className={`rounded-lg border border-border bg-surface p-3 ${child ? "ml-4" : ""}`}>
        <button type="button" className="flex w-full min-w-0 items-center gap-3 text-left" onClick={() => openCategoryPanel(category.id, ym)}>
          <span className="w-16 shrink-0">
            {carries ? (
              <FillJar pct={row.fill} negative={row.tone === "danger"} overflow={row.fill > 100} />
            ) : (
              <SpendMeter spent={line?.spent ?? row.amount} plan={line?.planned ?? row.mark} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{category.name}</span>
          </span>
          <span className="font-display text-2xl tabular">{big}</span>
          {story ? <span className="shrink-0 rounded-full bg-chip px-2 py-1 text-xs">{story.headline}</span> : null}
        </button>
        {linked ? (
          <a href={`/funds#fund-${linked.id}`} className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-primary">
            In {linked.name}
          </a>
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
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <section className={`min-w-0 space-y-3 ${side === "in" ? "block" : "hidden"} lg:block`}>
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
                  <AmountField
                    className="mt-1 max-w-xs"
                    aria-label={`Usual amount for ${category.name}`}
                    value={amountDraft(category.plannedMonthly)}
                    placeholder="0"
                    onCommit={(draft) => {
                      const next = usualAmountCommit(draft, category.plannedMonthly || 0);
                      if (next != null) updateCategory(category.id, { plannedMonthly: next });
                    }}
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

      <section className={`min-w-0 space-y-3 ${side === "out" ? "block" : "hidden"} lg:block`}>
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
            {formatMoney(funding)} is set aside in funds this month. That is part of this month, not these categories.{" "}
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
