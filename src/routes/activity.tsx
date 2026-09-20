import { createFileRoute } from "@tanstack/react-router";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionDesktop, TransactionMobile } from "@/components/transaction-views";

export const Route = createFileRoute("/activity")({ component: Activity });

function Activity() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Activity</h1>
        <MonthSwitcher compact />
      </div>
      <p className="max-w-2xl text-sm text-muted">
        Pick a category on each row. Flag refunds, reimbursements, and transfers, or exclude a row so it leaves the
        budget. “Same merchant” stores the rule so the next import of that payee lands in the same bucket.
      </p>
      <div className="md:hidden">
        <TransactionMobile />
      </div>
      <div className="hidden md:block">
        <TransactionDesktop />
      </div>
    </div>
  );
}
