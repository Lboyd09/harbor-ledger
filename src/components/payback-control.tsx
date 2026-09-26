import { useMemo, useState } from "react";
import { displayMerchant } from "@/lib/budget/merchant";
import { formatMoney } from "@/lib/budget/money";
import { findPaybackCandidates, looksLikePayback, paybackHint } from "@/lib/budget/payback";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";
import { Select } from "./ui/field";

export function PaybackControl({ purchaseId }: { purchaseId: string }) {
  const transactions = useBudgetStore((s) => s.transactions);
  const patchTransaction = useBudgetStore((s) => s.patchTransaction);
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory);
  const purchase = transactions.find((t) => t.id === purchaseId);
  const [picked, setPicked] = useState("");
  const [done, setDone] = useState(false);

  const candidates = useMemo(() => {
    if (!purchase) return [];
    return findPaybackCandidates(purchase, transactions);
  }, [purchase, transactions]);

  if (!purchase || purchase.amount >= 0) return null;

  const incoming = transactions.filter((t) => looksLikePayback(t) && t.status !== "reimbursement");
  const list = candidates.length ? candidates : incoming.slice(0, 8);
  if (!list.length) return null;

  function apply() {
    if (!purchase) return;
    const pay = transactions.find((t) => t.id === picked);
    if (!pay) return;
    patchTransaction(pay.id, {
      status: "reimbursement",
      notes: `Pays back ${displayMerchant(purchase.description)} on ${purchase.date}`,
    });
    if (purchase.categoryId) setTransactionCategory(pay.id, purchase.categoryId, false);
    patchTransaction(purchase.id, {
      notes: `Paid back by ${displayMerchant(pay.description)}`,
    });
    setDone(true);
  }

  if (done) {
    return <p className="text-xs text-good">Marked as paid back. That deposit now cuts this expense instead of counting as income.</p>;
  }

  return (
    <div className="rounded-md border border-border bg-chip/60 p-2">
      <p className="text-xs font-medium">Did someone pay this back?</p>
      <p className="mt-1 text-xs text-muted">
        Use this when you bought something for family and a parent Zelle / Venmo / cash-app came back in.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select className="min-h-9 min-w-48 text-xs" value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="">Pick the deposit</option>
          {list.map((t) => (
            <option key={t.id} value={t.id}>
              {formatMoney(t.amount)} · {paybackHint(purchase, t)}
            </option>
          ))}
        </Select>
        <Button type="button" size="sm" disabled={!picked} onClick={apply}>
          Cancel this purchase
        </Button>
      </div>
    </div>
  );
}
