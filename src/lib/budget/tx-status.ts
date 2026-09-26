import type { TxStatus } from "./types.ts";

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  posted: "Posted",
  refund: "Store refund",
  transfer: "Left out",
  reimbursement: "Paid back",
};

export const TX_STATUS_HINT: Record<TxStatus, string> = {
  posted: "Counts in the budget",
  refund: "A merchant refund. Stays with that expense and lowers what you spent",
  transfer: "Left out so a card payment or account move is not counted twice",
  reimbursement: "Not income and not spending — the purchase and the payback cancel",
};
