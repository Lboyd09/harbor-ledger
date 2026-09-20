import type { TxStatus } from "./types.ts";

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  posted: "Posted",
  refund: "Refund",
  transfer: "Transfer",
  reimbursement: "Reimbursed",
};

export const TX_STATUS_HINT: Record<TxStatus, string> = {
  posted: "Counts in the budget",
  refund: "Stays in the expense bucket and reduces what you spent",
  transfer: "Hidden from income and spending (card payments, account moves)",
  reimbursement: "Treated like a refund — reduces the expense bucket",
};
