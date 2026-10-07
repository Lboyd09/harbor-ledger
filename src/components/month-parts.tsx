import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { carryIn, carryOut, carryStatus, categorySpent, nextMonthAllowance } from "@/lib/budget/carry";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney } from "@/lib/budget/money";
import type { MonthGroup } from "@/lib/budget/month-view";
import { monthLabel, monthShort } from "@/lib/budget/parse-date";
import { closestAmount, paybackNote } from "@/lib/budget/payback";
import { hasMonthOverride, planAmount } from "@/lib/budget/plans";
import { previewChange, type CategoryUndo, type ChangeScope } from "@/lib/budget/sorting";
import { piecesOf } from "@/lib/budget/splits";
import { downloadText } from "@/lib/budget/download";
import type { Category, Transaction } from "@/lib/budget/types";
import { cn } from "@/lib/cn";
import { unusualCharges } from "@/lib/budget/analytics-depth";
import { useBudgetStore } from "@/store/budget-store";
import { CategorySelect } from "./category-select";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

function dayLabel(iso: string) {
  return `${monthShort(iso.slice(0, 7))} ${Number(iso.slice(8, 10))}`;
}

function rowFocus(tone: "in" | "out", groupId: string, txId: string) {
  return `${tone}|${groupId}|${txId}`;
}

function monthWord(ym: string) {
  return monthLabel(ym).replace(/ \d{4}$/, "");
}

function isPaycheck(categories: Category[], t: Transaction) {
  const slug = categories.find((c) => c.id === t.categoryId)?.slug ?? "";
  return slug === "paycheck" || slug.startsWith("paycheck-");
}

function catName(categories: Category[], id: string | null) {
  return categories.find((c) => c.id === id)?.name ?? "no category";
}

function sheetCategory(categories: Category[], t: Transaction) {
  const pieces = piecesOf(t);
  const overall = categories.find((c) => c.id === t.categoryId)?.name ?? "Needs a category";
  if (!pieces) return overall;
  return `${overall} (${pieces.map((p) => `${catName(categories, p.categoryId)} ${p.amount.toFixed(2)}`).join(" / ")})`;
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function countsLabel(t: Transaction) {
  if (t.excluded || t.status === "transfer") return "Left out";
  if (t.status === "reimbursement") return t.amount < 0 ? "Paid back — not spending" : "Paid back — not income";
  if (t.status === "refund") return "Money back — lowers spending";
  return "Yes";
}

function carryFigure(n: number) {
  if (n < -0.004) return `−${formatMoney(Math.abs(n))} owed`;
  return formatMoney(n);
}

function changeSentence(name: string, category: string, scope: ChangeScope, month: string, changes: number, kept: number, divided: number) {
  const n = `${changes} charge${changes === 1 ? "" : "s"}`;
  const dividedLine = divided ? ` ${divided} divided charge${divided === 1 ? "" : "s"} stay${divided === 1 ? "s" : ""} as ${divided === 1 ? "it is" : "they are"}.` : "";
  if (scope === "charge") return `Move this ${name} charge to ${category}.`;
  if (scope === "month") return `Move ${n} from ${name} to ${category}, in ${month} only.${dividedLine}`;
  const hand = kept ? ` ${kept} you set by hand ${kept === 1 ? "stays" : "stay"} as ${kept === 1 ? "it is" : "they are"}.` : "";
  return `Move ${n} from ${name} to ${category}, in every month.${hand}`;
}

export function CategoryChange({
  t,
  tone,
  categories,
  ym,
  onChanged,
}: {
  t: Transaction;
  tone: "in" | "out";
  categories: Category[];
  ym: string;
  onChanged: (sentence: string, undo: CategoryUndo) => void;
}) {
  const transactions = useBudgetStore((s) => s.transactions);
  const setCategoryScoped = useBudgetStore((s) => s.setCategoryScoped);
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const [scope, setScope] = useState<ChangeScope>("default");
  const name = displayMerchant(t.description);
  const month = monthWord(ym);
  const chosen = pending === undefined ? null : pending;
  const label = catName(categories, chosen);
  const base = { transactions, merchantKey: t.merchantKey, side: tone, categoryId: chosen, id: t.id, ym };
  const chargePreview = previewChange({ ...base, scope: "charge" });
  const monthPreview = previewChange({ ...base, scope: "month" });
  const defaultPreview = previewChange({ ...base, scope: "default" });
  const preview = scope === "charge" ? chargePreview : scope === "month" ? monthPreview : defaultPreview;
  const sentence = changeSentence(name, label, scope, month, preview.changes, preview.keptByHand, preview.skippedDivided);

  function apply() {
    if (pending === undefined) return;
    const undo = setCategoryScoped(t.id, pending, scope);
    if (!undo) return;
    onChanged(sentence, undo);
    setPending(undefined);
    setScope("default");
  }

  return (
    <div className="space-y-2">
      <CategorySelect
        categories={categories}
        kind={tone === "in" ? "income" : "expense"}
        value={pending === undefined ? t.categoryId : pending}
        onChange={(id) => {
          setPending(id);
          setScope("default");
        }}
      />
      {pending !== undefined ? (
        <fieldset className="space-y-1 text-sm">
          <legend className="sr-only">How far this change goes</legend>
          <label className="flex min-h-9 items-start gap-2">
            <input type="radio" name={`scope-${t.id}`} checked={scope === "charge"} onChange={() => setScope("charge")} />
            Just this charge
          </label>
          <label className="flex min-h-9 items-start gap-2">
            <input type="radio" name={`scope-${t.id}`} checked={scope === "month"} onChange={() => setScope("month")} />
            Every {name} in {month} ({monthPreview.changes})
          </label>
          <label className="flex min-h-9 items-start gap-2">
            <input type="radio" name={`scope-${t.id}`} checked={scope === "default"} onChange={() => setScope("default")} />
            Every {name}, every month (the default) ({defaultPreview.changes}
            {defaultPreview.keptByHand ? `, ${defaultPreview.keptByHand} set by hand stay` : ""})
          </label>
          <p className="text-sm">{sentence}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={preview.changes === 0}>
              Apply
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPending(undefined);
                setScope("default");
              }}
            >
              Cancel
            </Button>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

function MonthAmount({ category, ym }: { category: Category; ym: string }) {
  const budgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const setMonthPlan = useBudgetStore((s) => s.setMonthPlan);
  const custom = hasMonthOverride(category.id, ym, budgets);
  const current = planAmount(category, ym, budgets);
  const [draft, setDraft] = useState(current ? String(current) : "");
  useEffect(() => {
    setDraft(current ? String(current) : "");
  }, [current, category.id, ym]);
  return (
    <div className="space-y-2 border-t border-border px-4 py-3 text-sm">
      <p>
        Usual: {formatMoney(category.plannedMonthly)}
        {" · "}
        This month: {formatMoney(current)}
        {custom ? <span className="ml-2 rounded-full bg-chip px-2 py-0.5 text-xs">Changed for this month</span> : null}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          Amount for {monthWord(ym)}
          <Input className="mt-1 w-32" inputMode="decimal" aria-label={`Amount for ${category.name} this month`} value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <Button
          size="sm"
          onClick={() => {
            const next = Number(draft);
            if (!Number.isFinite(next) || draft.trim() === "") return;
            setMonthPlan(category.id, ym, next);
          }}
        >
          Save for this month
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMonthPlan(category.id, ym, null)} disabled={!custom}>
          Back to usual
        </Button>
        <Link to="/budget" search={{ page: "amounts" }} className="text-sm font-medium text-primary">
          Change the usual amount
        </Link>
      </div>
    </div>
  );
}

export function Section({
  title,
  kicker,
  hint,
  groups,
  empty,
  tone,
  categories,
  focus,
  divideKey,
  paybackId,
  onPayback,
  onFocus,
  onDivide,
  onChanged,
  onNotice,
  ym,
}: {
  title: string;
  kicker: string;
  hint: string;
  groups: MonthGroup[];
  empty: string;
  tone: "in" | "out";
  categories: Category[];
  focus: string | null;
  divideKey: string | null;
  paybackId: string | null;
  onPayback: (id: string | null) => void;
  onFocus: (key: string | null) => void;
  onDivide: (key: string | null) => void;
  onChanged: (sentence: string, undo: CategoryUndo) => void;
  onNotice: (message: string) => void;
  ym: string;
}) {
  const transactions = useBudgetStore((s) => s.transactions);
  const budgets = useBudgetStore((s) => s.monthBudgets) ?? [];
  const funds = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const profile = useBudgetStore((s) => s.profile);
  const carryOn =
    profile.budgetStyle === "buckets" &&
    Boolean(profile.carryStartMonth) &&
    ym >= (profile.carryStartMonth as string);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [quietOdd, setQuietOdd] = useState<string[]>([]);
  const odd = new Set(
    (unusualCharges(transactions, ym) ?? []).filter((item) => !quietOdd.includes(item.id)).map((item) => item.id),
  );
  return (
    <section className={cn("rounded-xl border p-3 md:p-4", tone === "in" ? "border-good/40" : "border-danger/35")}>
      <div className="mb-3 px-1">
        <p className={cn("text-xs font-medium uppercase tracking-wide", tone === "in" ? "text-good" : "text-danger")}>{kicker}</p>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </div>
      {groups.length === 0 ? <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">{empty}</p> : null}
      <div className="space-y-3">
        {groups.map((g) => {
          const stored = categories.find((c) => c.id === g.id);
          const expanded = openGroups[g.id] ?? false;
          const plan = stored ? planAmount(stored, ym, budgets) : g.plan;
          const over = tone === "out" && plan > 0 && g.total > plan + 0.5;
          const behind = tone === "in" && plan > 0 && g.total + 0.5 < plan;
          const pct = plan > 0 ? Math.min(100, Math.round((Math.max(0, g.total) / plan) * 100)) : 0;
          const linked = funds.some((fund) => fund.categoryIds.includes(g.id));
          const carry =
            carryOn && stored && tone === "out"
              ? {
                  ctx: {
                    transactions,
                    categories,
                    budgets,
                    carryStartMonth: profile.carryStartMonth as string,
                  },
                  category: stored,
                }
              : null;
          const row = carry ? { in: carryIn(carry.category, ym, carry.ctx), out: carryOut(carry.category, ym, carry.ctx) } : null;
          const status = carry ? carryStatus(carry.category, ym, carry.ctx) : "even";
          const allowance = carry ? nextMonthAllowance(carry.category, ym, carry.ctx) : null;
          const spent = stored && tone === "out" ? categorySpent(transactions, categories, stored.id, ym) : g.total;
          return (
            <div key={g.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className={cn("border-l-4 px-4 py-3", g.open ? "border-warn" : tone === "in" ? "border-good" : "border-danger")}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                  aria-expanded={expanded}
                  onClick={() => setOpenGroups((cur) => ({ ...cur, [g.id]: !expanded }))}
                >
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className={cn("text-xs", over || behind || status === "over" ? "text-danger" : "text-muted")}>
                      {g.transactions.length} charge{g.transactions.length === 1 ? "" : "s"}
                      {expanded ? " · hide" : " · show"}
                    </div>
                  </div>
                  <div className={cn("tabular font-medium", tone === "in" ? "text-good" : "text-danger")}>{formatMoney(g.total)}</div>
                </button>
                {tone === "in" && stored ? (
                  <p className={cn("mt-2 text-sm", behind ? "text-danger" : "text-muted")}>
                    Expected {formatMoney(plan)}, received {formatMoney(g.total)}. {behind ? "Behind" : plan > 0 ? "On track" : ""}
                  </p>
                ) : null}
                {tone === "out" && !carry && plan > 0 ? (
                  <p className={cn("mt-2 text-sm", over ? "text-danger" : "text-muted")}>
                    {formatMoney(g.total)} of {formatMoney(plan)}
                    {over ? ` · Over by ${formatMoney(g.total - plan)}` : ""}
                  </p>
                ) : null}
                {plan > 0 || (carry && stored) ? (
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-chip">
                    <div className={cn("h-full", over || status === "over" ? "bg-danger" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
                {carry && stored && row ? (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <p className="text-xs text-muted">From last month <span className="mt-0.5 block text-sm text-fg tabular">{carryFigure(row.in)}</span></p>
                      <p className="text-xs text-muted">This month adds <span className="mt-0.5 block text-sm text-fg tabular">{formatMoney(plan)}</span></p>
                      <p className="text-xs text-muted">Spent <span className="mt-0.5 block text-sm text-fg tabular">{formatMoney(spent)}</span></p>
                      <p className="text-xs text-muted">Left <span className={cn("mt-0.5 block text-sm tabular", row.out < -0.004 ? "text-danger" : "text-fg")}>{carryFigure(row.out)}</span></p>
                    </div>
                    <p className={cn("text-sm", status === "over" ? "text-danger" : "text-muted")}>
                      {status === "over"
                        ? `You're ${formatMoney(Math.abs(row.out))} over. Next month has ${formatMoney(allowance?.cutBack ? Math.abs(row.out) : Math.abs(row.out))} less, so this is the one to watch.`
                        : status === "extra"
                          ? `${formatMoney(row.out)} extra stays here for next month.`
                          : "Right on track."}
                    </p>
                  </div>
                ) : null}
                {linked ? (
                  <p className="mt-2 text-xs text-muted">
                    This is a fund. What you don’t spend stays.{" "}
                    <Link to="/funds" className="text-primary">See it in Funds</Link>
                  </p>
                ) : null}
              </div>
              {expanded && stored && !linked ? <MonthAmount category={stored} ym={ym} /> : null}
              {expanded ? (
                <ul className="divide-y divide-border border-t border-border">
                  {g.transactions.map((t) => {
                    const paid = t.status === "reimbursement";
                    const pieces = piecesOf(t);
                    const key = rowFocus(tone, g.id, t.id);
                    const open = focus === key;
                    const share = g.shares[t.id];
                    const shown = share == null ? t.amount : tone === "out" ? -Math.abs(share) : Math.abs(share);
                    const pieceLine = pieces
                      ? `Overall ${catName(categories, t.categoryId)}. This month: ${pieces.map((p) => `${catName(categories, p.categoryId)} ${formatMoney(p.amount)}`).join(" · ")}.`
                      : null;
                    return (
                      <TxRow
                        key={`${g.id}-${t.id}`}
                        date={dayLabel(t.date)}
                        name={displayMerchant(t.description)}
                        amount={shown}
                        paid={paid}
                        badge={paid ? "Paid back" : t.status === "refund" ? "Money back" : pieces ? "Divided" : undefined}
                        open={open}
                        onOpen={() => {
                          onPayback(null);
                          if (open) {
                            onFocus(null);
                            onDivide(null);
                          } else {
                            onFocus(key);
                            onDivide(null);
                          }
                        }}
                        extra={
                          <>
                            {t.pinned === "charge" ? <p className="mt-1 text-xs text-muted">Set for this charge</p> : null}
                            {t.pinned === "month" ? <p className="mt-1 text-xs text-muted">Set for this month</p> : null}
                            {odd.has(t.id) ? (
                              <p className="mt-1 text-sm">
                                This looks off.{" "}
                                <button type="button" className="font-medium text-primary" onClick={() => setQuietOdd((list) => [...list, t.id])}>
                                  That's normal
                                </button>
                              </p>
                            ) : null}
                            {t.status === "refund" ? <RefundLine t={t} onNotice={onNotice} /> : pieceLine ? <p className="mt-1 text-xs text-muted">{pieceLine}</p> : null}
                          </>
                        }
                        category={
                          open ? (
                            <div className="space-y-1">
                              <CategoryChange t={t} tone={tone} categories={categories} ym={ym} onChanged={onChanged} />
                              {tone === "out" && t.status === "posted" && !pieces ? (
                                <Button size="sm" variant="outline" onClick={() => { onFocus(key); onDivide(null); onPayback(t.id); }}>
                                  Someone paid me back
                                </Button>
                              ) : null}
                              {t.status === "posted" && !paid ? (
                                <button type="button" className="min-h-8 text-xs text-muted hover:text-fg" onClick={() => { onPayback(null); onFocus(key); onDivide(key); }}>
                                  Split into two categories
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted">{t.categoryId ? catName(categories, t.categoryId) : "Tap the name"}</span>
                          )
                        }
                        details={
                          open && paybackId === t.id ? (
                            <PaybackMatch t={t} categories={categories} onNotice={onNotice} onClose={() => onPayback(null)} />
                          ) : open ? (
                            <RowTools t={t} tone={tone} categories={categories} onNotice={onNotice} onChanged={onChanged} divide={divideKey === key} />
                          ) : null
                        }
                      />
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RowTools({
  t,
  tone,
  categories,
  onNotice,
  onChanged,
  divide,
}: {
  t: Transaction;
  tone: "in" | "out";
  categories: Category[];
  onNotice: (message: string) => void;
  onChanged: (sentence: string, undo: CategoryUndo) => void;
  divide?: boolean;
}) {
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const deleteTransaction = useBudgetStore((s) => s.deleteTransaction);
  const countAsIncome = useBudgetStore((s) => s.countAsIncome);
  const resetChargeToDefault = useBudgetStore((s) => s.resetChargeToDefault);
  const paycheck = isPaycheck(categories, t);
  const note = paybackNote(t.notes);
  const pieces = piecesOf(t);
  const name = displayMerchant(t.description);

  return (
    <div className="mt-2 space-y-3 text-sm">
      {t.status === "reimbursement" ? (
        <div className="rounded-md border border-border bg-bg p-3">
          <p className="font-medium">This was paid back{note ? ` — ${note}` : ""}.</p>
          <p className="mt-1 text-muted">It is not spending and the matching deposit is not income.</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => { useBudgetStore.getState().undoPaidBack(t.id); onNotice("Counted as spending again."); }}>
            Undo — count it again
          </Button>
        </div>
      ) : (
        <p className="text-muted">Pick a category above, then choose just this charge, this month, or the default. Nothing changes until you tap Apply.</p>
      )}
      {t.pinned === "charge" || t.pinned === "month" ? (
        <Quiet
          onClick={() => {
            const undo = resetChargeToDefault(t.id);
            if (undo) onChanged(`Put this ${name} charge back on its default.`, undo);
          }}
        >
          Back to default
        </Quiet>
      ) : null}
      {t.status === "posted" ? <SplitEditor t={t} tone={tone} categories={categories} onNotice={onNotice} openNow={Boolean(divide)} /> : null}
      <div className="flex flex-wrap gap-3">
        {t.status === "refund" ? (
          <Quiet onClick={() => { patchTransaction(t.id, { status: "posted" }); onNotice("Counted as a normal charge again."); }}>Not money back</Quiet>
        ) : tone === "out" && t.status === "posted" && !pieces ? (
          <Quiet onClick={() => { patchTransaction(t.id, { status: "refund" }); onNotice("Marked as money a store gave back. It lowers spending and is not income."); }}>
            Store gave this back
          </Quiet>
        ) : null}
        {t.status === "transfer" && t.amount > 0 ? (
          <Quiet onClick={() => { countAsIncome(t.id); onNotice("Counted as income."); }}>Count as income</Quiet>
        ) : null}
        {tone === "in" && !paycheck && t.status === "posted" ? (
          <Quiet onClick={() => { patchTransaction(t.id, { status: "transfer" }); onNotice("Hidden from income. It is listed under Left out of income."); }}>Not income</Quiet>
        ) : null}
        <Quiet danger onClick={() => deleteTransaction(t.id)}>Remove</Quiet>
      </div>
    </div>
  );
}

function SplitEditor({
  t,
  tone,
  categories,
  onNotice,
  openNow,
}: {
  t: Transaction;
  tone: "in" | "out";
  categories: Category[];
  onNotice: (message: string) => void;
  openNow?: boolean;
}) {
  const setSplits = useBudgetStore((s) => s.setSplits);
  const existing = t.splits && t.splits.length >= 2 ? t.splits : null;
  const [on, setOn] = useState(Boolean(existing) || Boolean(openNow));
  const abs = Math.abs(t.amount);
  const half = Math.round((abs / 2) * 100) / 100;
  const rest = Math.round((abs - half) * 100) / 100;
  const [aCat, setACat] = useState(existing?.[0]?.categoryId ?? t.categoryId ?? "");
  const [bCat, setBCat] = useState(existing?.[1]?.categoryId ?? "");
  const [aAmt, setAAmt] = useState(String(existing?.[0]?.amount ?? half));
  const [bAmt, setBAmt] = useState(String(existing?.[1]?.amount ?? rest));
  const kind = tone === "in" ? "income" : "expense";
  const overall = categories.find((c) => c.id === t.categoryId);

  useEffect(() => {
    if (openNow) setOn(true);
  }, [openNow]);

  if (!on) return <Quiet onClick={() => setOn(true)}>Divide into two categories</Quiet>;

  function save() {
    const a = Number(aAmt);
    const b = Number(bAmt);
    if (!aCat || !bCat) return onNotice("Pick a category for each piece.");
    if (aCat === bCat) return onNotice("Pick two different categories. The overall category can still be one of them.");
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return onNotice("Both amounts need to be more than zero.");
    if (Math.abs(a + b - abs) > 0.05) return onNotice(`The two amounts need to add up to ${formatMoney(abs)}.`);
    setSplits(t.id, [
      { categoryId: aCat, amount: a },
      { categoryId: bCat, amount: b },
    ]);
    onNotice("Divided. The overall category stays, and only this row changed.");
  }

  return (
    <div className="max-w-md space-y-2 rounded-md border border-border bg-bg p-3">
      <p className="font-medium">Two categories, one row</p>
      <p className="text-xs text-muted">
        {overall ? `${overall.name} stays the overall category. ` : ""}
        The pieces count in this month only. They have to add up to {formatMoney(abs)}.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        <CategorySelect categories={categories} kind={kind} value={aCat || null} onChange={(id) => setACat(id ?? "")} />
        <Input inputMode="decimal" aria-label="First amount" value={aAmt} onChange={(e) => setAAmt(e.target.value)} />
        <CategorySelect categories={categories} kind={kind} value={bCat || null} onChange={(id) => setBCat(id ?? "")} />
        <Input inputMode="decimal" aria-label="Second amount" value={bAmt} onChange={(e) => setBAmt(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save}>Save this split</Button>
        <Button size="sm" variant="ghost" onClick={() => { setSplits(t.id, null); setOn(false); onNotice("Back to one category."); }}>
          Use one category
        </Button>
      </div>
    </div>
  );
}

function PaybackMatch({
  t,
  categories,
  onNotice,
  onClose,
}: {
  t: Transaction;
  categories: Category[];
  onNotice: (message: string) => void;
  onClose: () => void;
}) {
  const transactions = useBudgetStore((s) => s.transactions);
  const markPaidBack = useBudgetStore((s) => s.markPaidBack);
  const [label, setLabel] = useState("");
  const [pick, setPick] = useState("");
  const month = t.date.slice(0, 7);
  const pool = transactions.filter(
    (x) => x.amount > 0 && x.id !== t.id && x.status !== "reimbursement" && x.status !== "transfer" && !x.excluded && !isPaycheck(categories, x),
  );
  const sameMonth = pool.filter((x) => x.date.slice(0, 7) === month);
  const list = (sameMonth.length ? sameMonth : pool).slice().sort((a, b) => {
    const da = Math.abs(Math.abs(a.amount) - Math.abs(t.amount));
    const db = Math.abs(Math.abs(b.amount) - Math.abs(t.amount));
    return da - db || a.date.localeCompare(b.date);
  });
  const suggested = closestAmount(Math.abs(t.amount), list, t.date);
  const gap = suggested ? Math.abs(Math.abs(suggested.amount) - Math.abs(t.amount)) : Infinity;
  const close = Boolean(suggested) && gap <= Math.max(5, Math.abs(t.amount) * 0.15);
  const chosen = pick || (close ? suggested?.id || "" : "");

  return (
    <div className="mt-2 max-w-lg space-y-2 rounded-md border border-border bg-bg p-3">
      <p className="font-medium">Which deposit paid this back?</p>
      <p className="text-sm text-muted">
        {close && suggested
          ? `${displayMerchant(suggested.description)} on ${dayLabel(suggested.date)} is ${formatMoney(suggested.amount)}, close to this charge. Tap it, then confirm. Both rows leave income and spending.`
          : suggested
            ? `Nothing lines up with ${formatMoney(Math.abs(t.amount))}. The nearest deposit is first. Pick it only if that money really paid this.`
            : "There is no deposit to match. You can still leave this purchase out of spending."}
      </p>
      {list.length ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {list.slice(0, 12).map((x) => {
            const on = chosen === x.id;
            return (
              <li key={x.id}>
                <button type="button" onClick={() => setPick(x.id)} className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${on ? "border-primary bg-chip" : "border-transparent hover:bg-chip"}`}>
                  <span>
                    {dayLabel(x.date)} · {displayMerchant(x.description)}
                    {close && suggested?.id === x.id ? <span className="ml-2 text-xs text-muted">Closest</span> : null}
                  </span>
                  <span className="tabular text-good">{formatMoney(x.amount)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Input value={label} placeholder="Note, optional" aria-label="Payback note" onChange={(e) => setLabel(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!chosen && list.length > 0} onClick={() => { markPaidBack(t.id, chosen || null, label); onNotice(chosen ? "Matched. Both rows are out of this month." : "That purchase is out of spending."); onClose(); }}>
          {chosen ? "These cancel each other out" : "Leave this purchase out of spending"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export function RefundLine({ t, onNotice }: { t: Transaction; onNotice: (message: string) => void }) {
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  return (
    <p className="mt-1 max-w-md text-xs text-muted">
      Money a store gave back. It lowers what you spent. It is not a paycheck or new income.{" "}
      <button type="button" className="underline-offset-2 hover:underline" onClick={() => { patchTransaction(t.id, { status: "posted" }); onNotice("Counted as a normal charge again."); }}>
        Not a return
      </button>
    </p>
  );
}

export function EmptyMonth({ ym, transactions, onJump }: { ym: string; transactions: Transaction[]; onJump: (ym: string) => void }) {
  const latest = transactions.map((t) => t.date.slice(0, 7)).sort().at(-1);
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-4 text-sm">
      <p className="font-medium">Nothing posted in {monthLabel(ym)} yet.</p>
      {latest && latest !== ym ? (
        <p className="mt-1 text-muted">
          Your latest charges are in {monthLabel(latest)}.{" "}
          <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => onJump(latest)}>
            Show {monthLabel(latest)}
          </button>
        </p>
      ) : (
        <p className="mt-1 text-muted">Import a CSV when this month’s file arrives, or move to another month.</p>
      )}
    </div>
  );
}

export function TxRow({
  date,
  name,
  amount,
  category,
  details,
  extra,
  muted,
  paid,
  badge,
  open,
  onOpen,
}: {
  date: string;
  name: string;
  amount: number;
  category: ReactNode;
  details?: ReactNode;
  extra?: ReactNode;
  muted?: boolean;
  paid?: boolean;
  badge?: string;
  open?: boolean;
  onOpen?: () => void;
}) {
  const color = paid || badge === "Money back" ? "text-muted" : amount > 0 ? "text-good" : "text-danger";
  return (
    <li className={cn("grid gap-2 px-4 py-3 md:grid-cols-[5.5rem_1fr_7rem_16rem] md:items-start", muted && "opacity-70")}>
      <div className="text-sm text-muted tabular">{date}</div>
      <div>
        {onOpen ? (
          <button type="button" className="text-left font-medium" onClick={onOpen} aria-expanded={open ? "true" : "false"}>
            {name}
            {badge ? <span className="ml-2 rounded-full bg-chip px-2 py-0.5 text-xs font-normal text-muted">{badge}</span> : null}
          </button>
        ) : (
          <div className="font-medium">
            {name}
            {badge ? <span className="ml-2 rounded-full bg-chip px-2 py-0.5 text-xs font-normal text-muted">{badge}</span> : null}
          </div>
        )}
        {extra}
        {details}
      </div>
      <div className={cn("tabular text-sm md:text-right", color)}>
        {paid ? (
          <>
            <div>Not counted</div>
            <div className="text-xs line-through">{formatMoney(Math.abs(amount))}</div>
          </>
        ) : badge === "Money back" ? (
          <span title="Lowers what you spent">−{formatMoney(Math.abs(amount))}</span>
        ) : (
          formatMoney(amount, { signed: amount > 0 })
        )}
      </div>
      <div className="space-y-2">{category}</div>
    </li>
  );
}

export function MonthSheet({ rows, categories, ym }: { rows: Transaction[]; categories: Category[]; ym: string }) {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  function download() {
    const header = ["Date", "Name", "Income", "Expense", "Category", "Counts"];
    const lines = [header.join(",")];
    for (const t of sorted) {
      lines.push([t.date, csvCell(displayMerchant(t.description)), t.amount > 0 ? t.amount.toFixed(2) : "", t.amount < 0 ? Math.abs(t.amount).toFixed(2) : "", csvCell(sheetCategory(categories, t)), csvCell(countsLabel(t))].join(","));
    }
    downloadText(`budgetflow-${ym}.csv`, lines.join("\r\n"), "text/csv;charset=utf-8");
  }
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">This month, line by line</h2>
          <p className="mt-1 text-sm text-muted">Income and expenses are separate columns. Paid back means the row is on the sheet but not in the totals.</p>
        </div>
        <Button variant="outline" size="sm" onClick={download}>Download this month</Button>
      </div>
      <div className="sheet-wrap rounded-lg border border-border bg-surface">
        <table className="sheet-table sheet-rise w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium text-good">Income</th>
              <th className="px-3 py-2 text-right font-medium text-danger">Expense</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Counts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const skipped = t.excluded || t.status === "transfer" || t.status === "reimbursement";
              return (
                <tr key={t.id} className={cn("border-b border-border last:border-0", skipped && "text-muted")}>
                  <td className="whitespace-nowrap px-3 py-2 tabular">{dayLabel(t.date)}</td>
                  <td className="px-3 py-2">{displayMerchant(t.description)}</td>
                  <td className="px-3 py-2 text-right tabular text-good">{t.amount > 0 ? formatMoney(t.amount) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular text-danger">{t.amount < 0 ? formatMoney(Math.abs(t.amount)) : "—"}</td>
                  <td className="px-3 py-2">{sheetCategory(categories, t)}</td>
                  <td className="px-3 py-2">{countsLabel(t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Quiet({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={cn("min-h-9 text-xs text-muted", danger ? "hover:text-danger" : "hover:text-fg")} onClick={onClick}>
      {children}
    </button>
  );
}

export function Summary({ label, value, hint, warn, tone }: { label: string; value: string; hint: string; warn?: boolean; tone?: "in" | "out" }) {
  return (
    <div className={cn("rounded-lg border bg-surface p-4", tone === "in" ? "border-good/40" : tone === "out" ? "border-danger/35" : "border-border")}>
      <div className={cn("text-xs font-medium uppercase tracking-wide", tone === "in" ? "text-good" : tone === "out" ? "text-danger" : "text-muted")}>{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-semibold tabular", warn && "text-danger", tone === "in" && !warn && "text-good")}>{value}</div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </div>
  );
}
