import { useMemo } from "react";
import { plannerFacts } from "@/lib/budget/planner";
import { useBudgetStore } from "@/store/budget-store";

export function usePlannerFacts() {
  const profile = useBudgetStore((s) => s.profile);
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const ym = useBudgetStore((s) => s.activeMonth);
  const year = Number(ym.slice(0, 4)) || new Date().getFullYear();
  return useMemo(
    () => plannerFacts({ profile, accounts, balances, transactions, categories, year }),
    [profile, accounts, balances, transactions, categories, year],
  );
}
