import type { TxStatus } from "./types.ts";

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  posted: "Counts normally",
  refund: "Money back from a store",
  transfer: "Left out",
  reimbursement: "Paid back",
};

export const TX_STATUS_HINT: Record<TxStatus, string> = {
  posted: "Counts in the budget",
  refund: "A store gave this money back. It is not income. It lowers what you spent there.",
  transfer: "Left out so a card payment or moving money between accounts is not counted twice",
  reimbursement: "Someone paid you back. The purchase and the payback both stay out of the budget.",
};
