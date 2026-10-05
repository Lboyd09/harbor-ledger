import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/budget/money";
import { displayMerchant } from "@/lib/budget/merchant";
import { openCategoryPanel } from "./category-panel";
import { currentMonthKey, monthShort, shiftMonth } from "@/lib/budget/parse-date";
import { reviewQueue } from "@/lib/budget/review-queue";
import { previewChange, ruleFor, sideOf, type CategoryUndo, type Side } from "@/lib/budget/sorting";
import type { Transaction } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { CategorySelect } from "./category-select";
import { HomeMenu } from "./page-menu";
import { SortQueue } from "./sort-queue";
import { Button } from "./ui/button";
import { Input } from "./ui/field";
import { EmptyArt } from "./visuals/empty-art";

type Filter = "all" | "open" | "bills";

type SortRow = {
  merchantKey: string;
  sample: string;
  count: number;
  total12: number;
  pinned: Transaction[];
  open: number;
  likelyBill: boolean;
  defaultId: string | null;
  shownId: string | null;
  check: boolean;
};

function windowStart() {
  return `${shiftMonth(currentMonthKey(), -11)}-01`;
}

function buildRows(transactions: Transaction[], side: Side, rules: { merchantKey: string; categoryId: string; side?: "in" | "out" }[]): SortRow[] {
  const start = windowStart();
  const map = new Map<string, SortRow & { last: string }>();
  for (const t of transactions) {
    if (t.excluded || sideOf(t) !== side) continue;
    const cur = map.get(t.merchantKey) ?? {
      merchantKey: t.merchantKey,
      sample: t.description,
      count: 0,
      total12: 0,
      pinned: [],
      open: 0,
      likelyBill: false,
      defaultId: ruleFor(rules, t.merchantKey, side)?.categoryId ?? null,
      shownId: null as string | null,
      check: false,
      last: "",
    };
    cur.count += 1;
    if (t.date >= start) cur.total12 += Math.abs(t.amount);
    if (t.auto?.provisional) cur.check = true;
    if (t.date >= cur.last) {
      cur.last = t.date;
      cur.sample = t.description;
    }
    if (t.pinned === "charge" || t.pinned === "month") cur.pinned.push(t);
    if (!t.categoryId) cur.open += 1;
    else if (cur.shownId == null) cur.shownId = t.categoryId;
    else if (cur.shownId !== t.categoryId) cur.shownId = "";
    map.set(t.merchantKey, cur);
  }
  return [...map.values()]
    .map(({ last: _last, ...row }) => ({
      ...row,
      shownId: row.shownId || null,
      likelyBill: row.count >= 3,
      total12: Math.round(row.total12 * 100) / 100,
    }))
    .sort((a, b) => Number(Boolean(a.defaultId)) - Number(Boolean(b.defaultId)) || b.count - a.count || b.total12 - a.total12);
}

export function SortingView() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const rules = useBudgetStore((s) => s.merchantRules);
  const setMerchantDefault = useBudgetStore((s) => s.setMerchantDefault);
  const resetChargeToDefault = useBudgetStore((s) => s.resetChargeToDefault);
  const restoreCategories = useBudgetStore((s) => s.restoreCategories);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<{ key: string; side: Side; categoryId: string | null } | null>(null);
  const [hands, setHands] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ sentence: string; undo: CategoryUndo } | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const openNames = useMemo(
    () =>
      reviewQueue(transactions, categories).filter((group) =>
        group.ids.some((id) => transactions.some((row) => row.id === id && !row.categoryId)),
      ).length,
    [transactions, categories],
  );

  const income = useMemo(() => buildRows(transactions, "in", rules), [transactions, rules]);
  const expenses = useMemo(() => buildRows(transactions, "out", rules), [transactions, rules]);
  const billCount = [...income, ...expenses].filter((row) => row.likelyBill).length;

  function keep(row: SortRow) {
    if (filter === "open" && row.defaultId && row.open === 0 && row.pinned.length === 0) return false;
    if (filter === "bills" && !row.likelyBill) return false;
    const needle = q.trim().toUpperCase();
    if (needle && !`${row.merchantKey} ${row.sample}`.toUpperCase().includes(needle)) return false;
    return true;
  }

  function confirm(row: SortRow, side: Side, includePinned: boolean) {
    if (!pending || pending.key !== row.merchantKey || pending.side !== side) return;
    const preview = previewChange({
      transactions,
      merchantKey: row.merchantKey,
      side,
      categoryId: pending.categoryId,
      scope: "default",
      includePinned,
    });
    const next = setMerchantDefault(row.merchantKey, side, pending.categoryId, { includePinned });
    const count = includePinned ? preview.changes + preview.keptByHand : preview.changes;
    const hand = !includePinned && preview.keptByHand ? ` ${preview.keptByHand} you set by hand ${preview.keptByHand === 1 ? "stays" : "stay"} as ${preview.keptByHand === 1 ? "it is" : "they are"}.` : "";
    setUndo({
      sentence: `This changes ${count} charge${count === 1 ? "" : "s"}.${hand}`,
      undo: next,
    });
    setPending(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Sorting</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Each name has one default category. Those categories are the budget: rent, groceries, insurance, eating out. Changing a name here changes every month, except charges you set by hand.
        </p>
      </div>
      <HomeMenu current="rules" />
      {openNames > 0 ? (
        <button type="button" className="w-full rounded-lg border border-primary/40 bg-surface p-4 text-left" onClick={() => setQueueOpen(true)}>
          <div className="font-display text-xl font-semibold">{openNames} {openNames === 1 ? "name" : "names"} still to sort</div>
          <p className="mt-1 text-sm text-muted">Opens the same sort screen used everywhere else.</p>
        </button>
      ) : null}
      {queueOpen ? <SortQueue onDone={() => setQueueOpen(false)} /> : null}
      {!transactions.length ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
          <EmptyArt kind="sorting" />
          <p className="text-sm">No names yet. A bank file is how they show up.</p>
          <Link to="/import" className="mt-3 inline-flex">
            <Button>Add your first bank file</Button>
          </Link>
        </div>
      ) : null}
      {undo ? (
        <p className="flex flex-wrap items-center gap-3 rounded-md bg-chip px-4 py-3 text-sm" role="status">
          <span>{undo.sentence}</span>
          <Button size="sm" variant="outline" onClick={() => { restoreCategories(undo.undo); setUndo(null); }}>Undo</Button>
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
          ).map((item) => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`min-h-11 rounded-md px-3 text-sm ${filter === item.id ? "bg-primary text-primary-fg" : "border border-border bg-surface"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SortList title="Money in" hint="Money that came in" side="in" rows={income.filter(keep)} categories={categories} pending={pending} hands={hands} transactions={transactions} onPending={setPending} onHands={setHands} onConfirm={confirm} onReset={resetChargeToDefault} onUndo={setUndo} empty={transactions.length ? "No income names match." : "Import a CSV to see who pays you."} />
        <SortList title="Money out" hint="Money that went out" side="out" rows={expenses.filter(keep)} categories={categories} pending={pending} hands={hands} transactions={transactions} onPending={setPending} onHands={setHands} onConfirm={confirm} onReset={resetChargeToDefault} onUndo={setUndo} empty={transactions.length ? "No spending names match." : "Import a CSV to see where money went."} />
      </div>
    </div>
  );
}

function SortList({
  title,
  hint,
  side,
  rows,
  categories,
  pending,
  hands,
  transactions,
  onPending,
  onHands,
  onConfirm,
  onReset,
  onUndo,
  empty,
}: {
  title: string;
  hint: string;
  side: Side;
  rows: SortRow[];
  categories: ReturnType<typeof useBudgetStore.getState>["categories"];
  pending: { key: string; side: Side; categoryId: string | null } | null;
  hands: string | null;
  transactions: Transaction[];
  onPending: (next: { key: string; side: Side; categoryId: string | null } | null) => void;
  onHands: (id: string | null) => void;
  onConfirm: (row: SortRow, side: Side, includePinned: boolean) => void;
  onReset: (id: string) => CategoryUndo | null;
  onUndo: (next: { sentence: string; undo: CategoryUndo } | null) => void;
  empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const name = displayMerchant(row.sample);
          const asking = pending?.key === row.merchantKey && pending.side === side;
          const preview = asking
            ? previewChange({ transactions, merchantKey: row.merchantKey, side, categoryId: pending.categoryId, scope: "default" })
            : null;
          const open = hands === `${side}:${row.merchantKey}`;
          const openId = row.defaultId || row.shownId;
          return (
            <li key={`${side}-${row.merchantKey}`} className="grid gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {name}
                    {row.check ? <span className="ml-2 rounded bg-chip px-1.5 py-0.5 text-xs font-medium">Check</span> : null}
                  </div>
                  {openId ? (
                    <button type="button" className="mt-1 text-sm font-medium text-primary" onClick={() => openCategoryPanel(openId)}>
                      Open {categories.find((item) => item.id === openId)?.name ?? "category"}
                    </button>
                  ) : null}
                  <p className="mt-1 text-sm text-muted">
                    {row.count} charge{row.count === 1 ? "" : "s"} · {formatMoney(row.total12)} in the last 12 months
                    {row.likelyBill ? " · Likely bill" : ""}
                  </p>
                </div>
              </div>
              {!row.defaultId && !asking ? <p className="text-sm font-medium">Pick a category</p> : null}
              <CategorySelect
                categories={categories}
                kind={side === "in" ? "income" : "expense"}
                value={asking ? pending.categoryId : row.defaultId}
                emptyLabel="Pick a category"
                onChange={(id) => onPending({ key: row.merchantKey, side, categoryId: id })}
              />
              {preview ? (
                <div className="space-y-2 text-sm">
                  <p>
                    This changes {preview.changes} charge{preview.changes === 1 ? "" : "s"}.
                    {preview.keptByHand ? ` ${preview.keptByHand} you set by hand ${preview.keptByHand === 1 ? "stays" : "stay"} as ${preview.keptByHand === 1 ? "it is" : "they are"}.` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onConfirm(row, side, false)} disabled={preview.changes === 0 && preview.keptByHand === 0}>
                      Change them
                    </Button>
                    {preview.keptByHand > 0 ? (
                      <Button size="sm" variant="outline" onClick={() => onConfirm(row, side, true)}>
                        Change all {preview.changes + preview.keptByHand} instead
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => onPending(null)}>Cancel</Button>
                  </div>
                </div>
              ) : null}
              {row.pinned.length ? (
                <div>
                  <button type="button" className="min-h-9 text-sm font-medium text-primary" onClick={() => onHands(open ? null : `${side}:${row.merchantKey}`)}>
                    {row.pinned.length} set differently
                  </button>
                  {open ? (
                    <ul className="mt-2 space-y-2">
                      {row.pinned.map((t) => (
                        <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>
                            {displayMerchant(t.description)} · {monthShort(t.date.slice(0, 7))} {Number(t.date.slice(8, 10))} · {formatMoney(t.amount, { signed: true })}
                          </span>
                          <Button size="sm" variant="ghost" onClick={() => {
                            const next = onReset(t.id);
                            if (next) onUndo({ sentence: `Put this ${name} charge back on its default.`, undo: next });
                          }}>
                            Back to default
                          </Button>
                        </li>
                      ))}
                      <li>
                        <Button size="sm" variant="outline" onClick={() => {
                          const collected: CategoryUndo = { rows: [], rules: null };
                          for (const t of row.pinned) {
                            const next = onReset(t.id);
                            if (next) collected.rows.push(...next.rows);
                          }
                          if (collected.rows.length) onUndo({ sentence: `Put ${collected.rows.length} charges back on the default.`, undo: collected });
                        }}>
                          Back to default for all
                        </Button>
                      </li>
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
        {rows.length === 0 ? <li className="p-6 text-sm text-muted">{empty}</li> : null}
      </ul>
    </section>
  );
}
