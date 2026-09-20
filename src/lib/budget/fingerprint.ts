import { merchantKey } from "./merchant";
import { roundMoney } from "./money";

export function fingerprint(date: string, amount: number, description: string): string {
  const key = merchantKey(description);
  const desc = String(description || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${date}|${roundMoney(amount).toFixed(2)}|${key}|${desc}`;
}
