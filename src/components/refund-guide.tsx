export function RefundGuide() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 text-sm">
      <p className="font-medium">How refunds work</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
        <li>Store sent money back: set the deposit to “Store refund” and keep it on the same category as the purchase.</li>
        <li>
          A parent paid you back: on the purchase, pick their Zelle/Venmo deposit and tap “Cancel this purchase.” The
          deposit stops counting as income and the purchase drops in that category.
        </li>
        <li>Card payment or moving money to savings: set the row to “Move between accounts.” It leaves the budget on purpose.</li>
      </ol>
    </div>
  );
}
