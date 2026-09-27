import { useMemo, useState } from "react";
import { explainMatch } from "@/lib/budget/categorize";
import { formatMoney } from "@/lib/budget/money";
import { displayMerchant } from "@/lib/budget/merchant";
import { TX_STATUS_HINT, TX_STATUS_LABEL } from "@/lib/budget/tx-status";
import { inPeriod } from "@/lib/budget/totals";
import type { TxStatus } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { CategorySelect } from "./category-select";
import { Input, Select } from "./ui/field";

const STATUSES: TxStatus[] = ["posted", "refund", "transfer", "reimbursement"];

function TxFlags({ id, excluded, status }: { id: string; excluded: boolean; status: TxStatus }) {
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="min-h-9 w-40 text-sm"
        value={status}
        onChange={(e) => patchTransaction(id, { status: e.target.value as TxStatus })}
        aria-label="Row type"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} title={TX_STATUS_HINT[s]}>
            {TX_STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
      <label className="flex min-h-9 items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={excluded}
          onChange={(e) => patchTransaction(id, { excluded: e.target.checked })}
        />
        Exclude
      </label>
    </div>
  );
}

export function TransactionDesktop() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const merchantRules = useBudgetStore((s) => s.merchantRules);
  const period = useBudgetStore((s) => s.profile.budgetPeriod);
  const activeMonth = useBudgetStore((s) => s.activeMonth);
  const activeWeek = useBudgetStore((s) => s.activeWeek);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const deleteTransaction = useBudgetStore((s) => s.deleteTransaction);
  const key = period === "week" ? activeWeek : activeMonth;
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [periodOnly, setPeriodOnly] = useState(true);
  const [showExcluded, setShowExcluded] = useState(true);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return transactions.filter((t) => {
      if (periodOnly && !inPeriod(t, period, key)) return false;
      if (onlyOpen && t.categoryId) return false;
      if (!showExcluded && t.excluded) return false;
      if (needle && !`${t.description} ${t.merchantKey}`.toUpperCase().includes(needle)) return false;
      return true;
    });
  }, [transactions, q, onlyOpen, periodOnly, showExcluded, period, key]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="text-sm text-muted">Search</span>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Merchant or description" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={periodOnly} onChange={(e) => setPeriodOnly(e.target.checked)} />
          This {period}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Needs category
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} />
          Show excluded
        </label>
        <p className="text-sm text-muted">{rows.length} shown</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className={`border-b border-border/70 align-top ${t.excluded ? "opacity-60" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2 tabular">{t.date}</td>
                <td className="px-3 py-2">
                  <div className={`max-w-md font-medium ${t.excluded ? "line-through" : ""}`}>
                    {displayMerchant(t.description)}
                  </div>
                  <div className="max-w-md truncate text-muted">{t.description}</div>
                  {t.status !== "posted" ? (
                    <div className="mt-1 text-xs text-muted">{TX_STATUS_HINT[t.status]}</div>
                  ) : null}
                </td>
                <td className={`whitespace-nowrap px-3 py-2 text-right tabular ${t.amount < 0 ? "text-danger" : "text-good"}`}>
                  {formatMoney(t.amount, { signed: true })}
                </td>
                <td className="px-3 py-2">
                  <CategorySelect
                    categories={categories}
                    value={t.categoryId}
                    onChange={(id) => setTransactionCategory(t.id, id, false)}
                  />
                  {!t.categoryId ? (
                    <div className="mt-1 text-xs text-warn">Unassigned</div>
                  ) : (
                    <div className="mt-1 text-xs text-muted">
                      {explainMatch(t.description, t.categoryId, t.userSet, merchantRules, t.merchantKey)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <TxFlags id={t.id} excluded={t.excluded} status={t.status} />
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-danger"
                      onClick={() => deleteTransaction(t.id)}
                    >
                      Remove row
                    </button>
                    {t.categoryId ? <div className="text-xs text-muted">{catName.get(t.categoryId)}</div> : null}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  No rows match. Import a CSV or clear the filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TransactionMobile() {
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const merchantRules = useBudgetStore((s) => s.merchantRules);
  const period = useBudgetStore((s) => s.profile.budgetPeriod);
  const activeMonth = useBudgetStore((s) => s.activeMonth);
  const activeWeek = useBudgetStore((s) => s.activeWeek);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const deleteTransaction = useBudgetStore((s) => s.deleteTransaction);
  const key = period === "week" ? activeWeek : activeMonth;
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState("");
  const rows = transactions.filter((t) => {
    if (!inPeriod(t, period, key)) return false;
    if (onlyOpen && t.categoryId) return false;
    const needle = q.trim().toUpperCase();
    if (needle && !`${t.description} ${t.merchantKey}`.toUpperCase().includes(needle)) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search this ${period}`} />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
        Needs category
      </label>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map((t) => (
          <li key={t.id} className={`space-y-2 p-3 ${t.excluded ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`font-medium ${t.excluded ? "line-through" : ""}`}>{displayMerchant(t.description)}</div>
                <div className="text-xs text-muted">{t.date}</div>
              </div>
              <div className={`tabular text-sm ${t.amount < 0 ? "text-danger" : "text-good"}`}>
                {formatMoney(t.amount, { signed: true })}
              </div>
            </div>
            <CategorySelect
              categories={categories}
              value={t.categoryId}
              onChange={(id) => setTransactionCategory(t.id, id, false)}
            />
            <TxFlags id={t.id} excluded={t.excluded} status={t.status} />
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted">
                {explainMatch(t.description, t.categoryId, t.userSet, merchantRules, t.merchantKey)}
              </div>
              <button type="button" className="text-xs text-muted" onClick={() => deleteTransaction(t.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
        {rows.length === 0 ? <li className="p-6 text-center text-sm text-muted">Nothing in this {period}.</li> : null}
      </ul>
    </div>
  );
}
