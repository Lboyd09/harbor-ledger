import type { TxStatus } from "./types.ts";

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  posted: "Counts",
  refund: "Store refund",
  transfer: "Move between accounts",
  reimbursement: "Someone paid me back",
};

export const TX_STATUS_HINT: Record<TxStatus, string> = {
  posted: "This row is real income or a real expense.",
  refund: "The store sent money back. Keep it on the same expense category so that spend goes down.",
  transfer: "Not income and not spending — card payments, savings moves, cash you sent yourself.",
  reimbursement:
    "A person (often a parent) paid you back. Put this deposit on the same category as the original purchase so that purchase drops to $0 in the budget.",
};
