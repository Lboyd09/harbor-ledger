import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { amountDraft, monthAmountCommit, usualAmountCommit } from "@/lib/budget/amount-input";
import { earliestDataMonth, monthLedger, type LedgerSource, type SpendingLine } from "@/lib/budget/ledger-month";
import { bucketBalance } from "@/lib/budget/buckets";
import { categoryStory, carryConsequence, surplusSuggestions } from "@/lib/budget/screen-plan";
import { groupMonth } from "@/lib/budget/month-view";
import { merchantFamily } from "@/lib/budget/merchant";
import { formatMoney, roundMoney } from "@/lib/budget/money";
import { monthLabel, shiftMonth } from "@/lib/budget/parse-date";
import { hasMonthOverride, planAmount } from "@/lib/budget/plans";
import { categoryCarries } from "@/lib/budget/style";
import { monthSeries } from "@/lib/budget/visual-data";
import type { Category, Transaction } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { queueFundWizard } from "./fund-wizard-queue";
import { AmountField } from "./amount-field";
import { FillJar, SpendMeter } from "./money-visual";
import { CategoryChange, RowTools } from "./month-parts";
import { MiniBars } from "./visuals/mini-bars";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";

import { takeCategoryPanelListener, type OpenRequest } from "./category-panel-open";

export function CategoryPanelHost() {
  const [request, setRequest] = useState<OpenRequest>(null);
  useEffect(() => takeCategoryPanelListener(setRequest), []);
  if (!request) return null;
  return <CategoryPanel categoryId={request.categoryId} initialYm={request.ym} onClose={() => setRequest(null)} />;
}

function weekOf(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function pretty(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleString("en-US", { month: "short", day: "numeric" });
}

function familyName(description: string) {
  const family = merchantFamily(description);
  if (!family || family === "UNKNOWN") return description.trim() || "Cash";
  return family
    .toLowerCase()
    .split(" ")
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

export function LeftoversCard({ limit = 3 }: { limit?: number }) {
  const ym = useBudgetStore((s) => s.activeMonth);
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const budgets = useBudgetStore((s) => s.monthBudgets);
  const buckets = useBudgetStore((s) => s.moneyBuckets);
  const moves = useBudgetStore((s) => s.bucketMoves);
  const setAsides = useBudgetStore((s) => s.setAsides);
  const removeSetAside = useBudgetStore((s) => s.removeSetAside);
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const carryStartMonth = useBudgetStore((s) => s.profile.carryStartMonth);
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const suggestions = useMemo(
    () =>
      surplusSuggestions(
        { transactions, categories, budgets: budgets ?? [], buckets: buckets ?? [], moves: moves ?? [], setAsides: setAsides ?? [], style, carryStartMonth },
        ym,
      ).slice(0, limit),
    [transactions, categories, budgets, buckets, moves, setAsides, style, carryStartMonth, ym, limit],
  );
  if (!suggestions.length && !undo) return null;
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-lg font-semibold">Extra money this month</h2>
      {undo ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{undo.name} was set aside.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              removeSetAside(undo.id);
              setUndo(null);
            }}
          >
            Undo
          </Button>
        </p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {suggestions.map((item) => (
          <li key={item.categoryId}>
            <LeftoverActions categoryId={item.categoryId} name={item.name} amount={item.amount} ym={ym} onSaved={(id) => setUndo({ id, name: item.name })} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LeftoverActions({
  categoryId,
  name,
  amount,
  ym,
  onSaved,
}: {
  categoryId: string;
  name: string;
  amount: number;
  ym: string;
  onSaved?: (id: string) => void;
}) {
  const funds = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const addSetAside = useBudgetStore((s) => s.addSetAside);
  const navigate = useNavigate();
  const preferred = funds.find((item) => /emergency|cushion|rainy/i.test(item.name)) ?? null;
  const [fundId, setFundId] = useState(preferred?.id ?? "");
  const shown = formatMoney(amount);
  const fund = funds.find((item) => item.id === fundId) ?? null;

  function add() {
    if (!fund) return;
    const id = addSetAside({ ym, categoryId, fundId: fund.id, amount });
    if (id) onSaved?.(id);
  }

  return (
    <div className="text-sm">
      <p>
        Savings transfers: {shown} spare
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {funds.length ? (
          <>
            <Select aria-label={`Fund for ${name}`} value={fund?.id ?? ""} onChange={(e) => setFundId(e.target.value)}>
              <option value="">Choose a fund</option>
              {funds.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={add} disabled={!fund}>
              Move
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              queueFundWizard(categoryId);
              void navigate({ to: "/funds" });
            }}
          >
            Move
          </Button>
        )}
        <a className="inline-flex min-h-11 items-center text-sm font-medium text-primary" href={`/grow?lump=${Math.round(amount)}`}>
          Grow it
        </a>
      </div>
    </div>
  );
}

function CategoryPanel({ categoryId, initialYm, onClose }: { categoryId: string; initialYm?: string; onClose: () => void }) {
  const active = useBudgetStore((s) => s.activeMonth);
  const [ym, setYm] = useState(initialYm && /^\d{4}-\d{2}$/.test(initialYm) ? initialYm : active);
  const [range, setRange] = useState<"month" | "3" | "all">("month");
  const [shown, setShown] = useState(20);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fullId, setFullId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets);
  const moneyBuckets = useBudgetStore((s) => s.moneyBuckets);
  const bucketMoves = useBudgetStore((s) => s.bucketMoves);
  const asideRows = useBudgetStore((s) => s.setAsides);
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const carryStart = useBudgetStore((s) => s.profile.carryStartMonth);
  const profile = useBudgetStore((s) => s.profile);
  const category = categories.find((item) => item.id === categoryId) ?? null;

  const source = useMemo<LedgerSource>(
    () => ({
      transactions,
      categories,
      budgets: monthBudgets ?? [],
      buckets: moneyBuckets ?? [],
      moves: bucketMoves ?? [],
      setAsides: asideRows ?? [],
      style,
      carryStartMonth: carryStart,
      profile,
    }),
    [transactions, categories, monthBudgets, moneyBuckets, bucketMoves, asideRows, style, carryStart, profile],
  );
  const ledger = useMemo(() => monthLedger(source, ym), [source, ym]);
  const line = ledger.spending.find((row) => row.id === categoryId) ?? null;
  const story = line ? categoryStory(line) : null;
  const history = useMemo(() => {
    const cache = new Map();
    const rows: { ym: string; a: number; b: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const month = shiftMonth(ym, -i);
      const book = monthLedger(source, month, cache);
      const point = book.spending.find((row) => row.id === categoryId);
      rows.push({ ym: month, a: point?.planned ?? 0, b: point?.spent ?? 0 });
    }
    return monthSeries(ym, rows);
  }, [source, ym, categoryId]);
  const charges = useMemo(() => collectCharges(transactions, categories, categoryId, ym, range), [transactions, categories, categoryId, ym, range]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setShown(20);
    setOpenId(null);
  }, [categoryId, ym, range]);

  if (!category) {
    return (
      <PanelShell onClose={onClose}>
        <p className="text-sm">That category is gone.</p>
      </PanelShell>
    );
  }

  const linked = (moneyBuckets ?? []).find((fund) => fund.categoryIds.includes(category.id));
  const tone = category.kind === "income" ? "in" : "out";

  return (
    <PanelShell onClose={onClose} label={category.name}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{category.name}</h2>
          <p className="text-sm text-muted">{monthLabel(ym)}</p>
        </div>
        <button type="button" className="min-h-11 px-2 text-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setYm(shiftMonth(ym, -1))}>
          Earlier
        </Button>
        <Button size="sm" variant="outline" onClick={() => setYm(shiftMonth(ym, 1))}>
          Later
        </Button>
      </div>
      {story ? (
        <p className="mt-3 text-sm">
          <span className="font-medium">This month: {story.thisMonth}.</span>
          {story.fromEarlier !== 0 ? ` From earlier: ${formatMoney(story.fromEarlier)}.` : ` ${story.detail}`}
        </p>
      ) : null}
      {linked ? (
        <a className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary" href={`/funds#fund-${linked.id}`}>
          Fund balance {formatMoney(bucketBalance(linked, ym, transactions, categories, bucketMoves ?? []))}
          {line ? ` · Left this month ${formatMoney(roundMoney(line.planned - line.spent))}` : ""}
        </a>
      ) : null}
      {line ? <Picture line={line} /> : null}
      <MiniBars months={history} aLabel="Amount" bLabel="Spent" />
      {category.kind === "expense" ? <Amounts category={category} ym={ym} line={line} onClose={onClose} /> : null}
      <div className="mt-5">
        <h3 className="text-sm font-medium">Charges</h3>
        <div className="mt-2 flex gap-2" role="group" aria-label="Which charges">
          {(
            [
              ["month", "This month"],
              ["3", "Last 3 months"],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={range === id}
              className={`min-h-11 rounded-md border px-3 text-sm ${range === id ? "border-primary bg-chip" : "border-border"}`}
              onClick={() => setRange(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <ChargeList
          charges={charges.slice(0, shown)}
          categories={categories}
          ym={ym}
          tone={tone}
          openId={openId}
          fullId={fullId}
          note={note}
          onOpen={(id) => {
            setOpenId(openId === id ? null : id);
            const row = charges.find((item) => item.tx.id === id);
            setNote(row?.tx.notes ?? "");
          }}
          onFull={(id) => setFullId(fullId === id ? null : id)}
          onNote={setNote}
        />
        {charges.length > shown ? (
          <Button className="mt-2" variant="outline" size="sm" onClick={() => setShown((count) => count + 20)}>
            Show more
          </Button>
        ) : null}
        {category.kind === "expense" ? <AddCash ym={ym} categoryId={category.id} /> : null}
      </div>
    </PanelShell>
  );
}

function Picture({ line }: { line: SpendingLine }) {
  if (line.carries) {
    const full = line.planned > 0 ? (Math.max(0, line.left) / (line.planned * 3)) * 100 : 0;
    return (
      <div className="mt-4 flex items-center gap-4">
        <FillJar pct={full} negative={line.left < -0.004} overflow={full > 100} />
        <dl className="grid flex-1 grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted">From last month</dt>
            <dd className="tabular">{formatMoney(line.carryIn, { signed: true })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">This month adds</dt>
            <dd className="tabular">{formatMoney(line.planned)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Spent</dt>
            <dd className="tabular">{formatMoney(line.spent)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Left</dt>
            <dd className="tabular">{formatMoney(line.left, { signed: true })}</dd>
          </div>
        </dl>
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-2">
      <SpendMeter spent={line.spent} plan={line.planned} />
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Amount</dt>
          <dd className="tabular">{formatMoney(line.planned)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Spent</dt>
          <dd className="tabular">{formatMoney(line.spent)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Left</dt>
          <dd className="tabular">{formatMoney(line.left, { signed: true })}</dd>
        </div>
      </dl>
    </div>
  );
}

function Amounts({ category, ym, line, onClose }: { category: Category; ym: string; line: SpendingLine | null; onClose: () => void }) {
  const updateCategory = useBudgetStore((s) => s.updateCategory);
  const setMonthPlan = useBudgetStore((s) => s.setMonthPlan);
  const patchProfile = useBudgetStore((s) => s.patchProfile);
  const monthBudgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const carryStart = useBudgetStore((s) => s.profile.carryStartMonth);
  const transactions = useBudgetStore((s) => s.transactions);
  const style = useBudgetStore((s) => (s.profile.budgetStyle === "buckets" ? "buckets" : "monthly"));
  const monthAmount = planAmount(category, ym, monthBudgets);
  const custom = hasMonthOverride(category.id, ym, monthBudgets);
  const carries = categoryCarries(category, style);
  const [undo, setUndo] = useState<{ before: number; after: number } | null>(null);
  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-medium">Amounts</h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Usual amount
          <AmountField
            className="mt-1"
            aria-label={`Monthly amount for ${category.name}`}
            value={amountDraft(category.plannedMonthly)}
            placeholder="0"
            onEscapeClose={onClose}
            onCommit={(draft) => {
              const before = category.plannedMonthly || 0;
              const next = usualAmountCommit(draft, before);
              if (next == null) return;
              updateCategory(category.id, { plannedMonthly: next });
              setUndo({ before, after: next });
            }}
          />
        </label>
        <label className="text-xs text-muted">
          This month only
          <AmountField
            className="mt-1"
            aria-label={`This month for ${category.name}`}
            value={custom ? amountDraft(monthAmount) : ""}
            placeholder="Same"
            onCommit={(draft) => {
              const change = monthAmountCommit(draft, custom ? monthAmount : null);
              if (change.action === "clear") setMonthPlan(category.id, ym, null);
              if (change.action === "set") setMonthPlan(category.id, ym, change.amount);
            }}
          />
        </label>
      </div>
      {undo ? (
        <p className="flex flex-wrap items-center gap-2 text-sm" role="status">
          <span>
            Usual amount changed from {formatMoney(undo.before)} to {formatMoney(undo.after)}.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              updateCategory(category.id, { plannedMonthly: undo.before });
              setUndo(null);
            }}
          >
            Undo
          </Button>
        </p>
      ) : null}
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
            if (!carryStart) {
              const first = earliestDataMonth(transactions);
              if (first) patchProfile({ carryStartMonth: first });
            }
          }}
        >
          This one carries over
        </button>
      </div>
      <p className="text-sm">{carryConsequence(line ? line.left : monthAmount, carries)}</p>
    </div>
  );
}

type Charge = { tx: Transaction; amount: number };

function collectCharges(transactions: Transaction[], categories: Category[], categoryId: string, ym: string, range: "month" | "3" | "all"): Charge[] {
  const months =
    range === "all"
      ? [...new Set(transactions.map((row) => row.date.slice(0, 7)))].filter((key) => /^\d{4}-\d{2}$/.test(key))
      : range === "3"
        ? [0, 1, 2].map((i) => shiftMonth(ym, -i))
        : [ym];
  const out: Charge[] = [];
  const seen = new Set<string>();
  for (const month of months) {
    const layout = groupMonth(transactions, categories, month, []);
    const group = layout.expenses.find((row) => row.id === categoryId) ?? layout.income.find((row) => row.id === categoryId);
    if (!group) continue;
    for (const tx of group.transactions) {
      if (seen.has(tx.id)) continue;
      seen.add(tx.id);
      const share = group.shares[tx.id];
      const amount = share == null ? tx.amount : tx.amount < 0 ? -Math.abs(share) : Math.abs(share);
      out.push({ tx, amount });
    }
  }
  return out.sort((a, b) => b.tx.date.localeCompare(a.tx.date) || b.tx.id.localeCompare(a.tx.id));
}

function ChargeList({
  charges,
  categories,
  ym,
  tone,
  openId,
  fullId,
  note,
  onOpen,
  onFull,
  onNote,
}: {
  charges: Charge[];
  categories: Category[];
  ym: string;
  tone: "in" | "out";
  openId: string | null;
  fullId: string | null;
  note: string;
  onOpen: (id: string) => void;
  onFull: (id: string) => void;
  onNote: (value: string) => void;
}) {
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const groups = new Map<string, Charge[]>();
  for (const charge of charges) {
    const key = weekOf(charge.tx.date);
    groups.set(key, [...(groups.get(key) ?? []), charge]);
  }
  if (!charges.length) return <p className="mt-2 text-sm text-muted">No charges in this view.</p>;
  return (
    <div className="mt-3 space-y-3">
      {[...groups.entries()].map(([week, rows]) => (
        <div key={week}>
          <p className="text-xs text-muted">Week of {pretty(week)}</p>
          <ul className="mt-1 divide-y divide-border rounded-md border border-border">
            {rows.map((charge) => {
              const open = openId === charge.tx.id;
              const check = Boolean(charge.tx.auto?.provisional);
              const hand = charge.tx.userSet || charge.tx.pinned === "charge" || charge.tx.pinned === "month";
              return (
                <li key={charge.tx.id} className="px-3 py-2 text-sm">
                  <button type="button" className="flex w-full items-baseline justify-between gap-2 text-left" onClick={() => onOpen(charge.tx.id)}>
                    <span>
                      <span className="text-muted">{pretty(charge.tx.date)} · </span>
                      {familyName(charge.tx.description)}
                      {check ? <span className="ml-2 rounded bg-chip px-1.5 py-0.5 text-xs">Check</span> : null}
                      {hand ? <span className="ml-2 rounded bg-chip px-1.5 py-0.5 text-xs">Set by hand</span> : null}
                    </span>
                    <span className="tabular">{formatMoney(charge.amount, { signed: true })}</span>
                  </button>
                  <button type="button" className="mt-1 text-xs text-primary" onClick={() => onFull(charge.tx.id)}>
                    {fullId === charge.tx.id ? "Hide bank text" : "Bank text"}
                  </button>
                  {fullId === charge.tx.id ? <p className="mt-1 text-xs text-muted">{charge.tx.description}</p> : null}
                  {open ? (
                    <div className="mt-2 space-y-2">
                      <CategoryChange t={charge.tx} tone={tone} categories={categories} ym={ym} onChanged={() => undefined} />
                      <label className="block text-xs text-muted">
                        Notes
                        <Input
                          className="mt-1"
                          value={note}
                          onChange={(e) => onNote(e.target.value)}
                          onBlur={() => patchTransaction(charge.tx.id, { notes: note })}
                        />
                      </label>
                      <button type="button" className="min-h-11 text-sm text-primary" onClick={() => patchTransaction(charge.tx.id, { excluded: !charge.tx.excluded })}>
                        {charge.tx.excluded ? "Count this charge" : "Leave this charge out"}
                      </button>
                      <RowTools t={charge.tx} tone={tone} categories={categories} onNotice={() => undefined} onChanged={() => undefined} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AddCash({ ym, categoryId }: { ym: string; categoryId: string }) {
  const addCashCharge = useBudgetStore((s) => s.addCashCharge);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("Cash");
  return (
    <form
      className="mt-4 grid gap-2 sm:grid-cols-[1fr_8rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const next = Number(amount);
        if (!Number.isFinite(next) || next <= 0) return;
        addCashCharge({ categoryId, amount: next, date: `${ym}-15`, description: name || "Cash" });
        setAmount("");
      }}
    >
      <Input aria-label="Cash charge name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input aria-label="Cash charge amount" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Button type="submit">Add a charge</Button>
    </form>
  );
}

function PanelShell({ children, onClose, label }: { children: ReactNode; onClose: () => void; label?: string }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close category" onClick={onClose} />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={label ?? "Category"}
        className="absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto rounded-t-2xl bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[28rem] md:rounded-none md:border-l md:border-border md:bg-surface md:pb-4 md:shadow-xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line md:hidden" aria-hidden="true" />
        {children}
      </aside>
    </div>
  );
}
