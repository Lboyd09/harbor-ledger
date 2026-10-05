import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createContext, useContext } from "react";
import { latestBalance } from "@/lib/budget/accounts";
import { bucketBalance } from "@/lib/budget/buckets";
import { MARKET_RATES, SAVINGS_RATES, monthlyPath, projectBoth, projectLump, rothVsTraditional } from "@/lib/budget/grow-math";
import { DEFAULT_IRA, iraLimit, rothRoom } from "@/lib/budget/ira";
import { buildYearWorkbook } from "@/lib/budget/year";
import { useBudgetStore } from "@/store/budget-store";
import { useLivelyMotion } from "../use-lively-motion";
import { usePlannerFacts } from "../use-planner-facts";
import type { TipFacts } from "@/lib/budget/tips";

export type GrowPage =
  | "overview"
  | "retire"
  | "free"
  | "work"
  | "monthly"
  | "roth"
  | "goal"
  | "cushion"
  | "debt"
  | "loan"
  | "worth"
  | "inflation"
  | "double";

export const GROW_PAGES: { id: GrowPage; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "retire", label: "Retirement" },
  { id: "free", label: "When work is optional" },
  { id: "work", label: "Put it to work" },
  { id: "monthly", label: "Add every month" },
  { id: "roth", label: "Roth or traditional" },
  { id: "goal", label: "Save for a goal" },
  { id: "cushion", label: "Cushion" },
  { id: "debt", label: "Debt" },
  { id: "loan", label: "Loan or mortgage" },
  { id: "worth", label: "Net worth" },
  { id: "inflation", label: "Inflation" },
  { id: "double", label: "Doubling and reaching a number" },
];

type Bag = ReturnType<typeof useGrowState>;

const GrowContext = createContext<Bag | null>(null);

function useGrowState() {
  const profile = useBudgetStore((s) => s.profile);
  const transactions = useBudgetStore((s) => s.transactions);
  const categories = useBudgetStore((s) => s.categories);
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const debts = useBudgetStore((s) => s.debts ?? []);
  const netWorth = useBudgetStore((s) => s.netWorth ?? []);
  const bucketList = useBudgetStore((s) => s.moneyBuckets);
  const moveList = useBudgetStore((s) => s.bucketMoves);
  const ira = useBudgetStore((s) => s.ira) ?? DEFAULT_IRA;
  const ym = useBudgetStore((s) => s.activeMonth);
  const facts = usePlannerFacts();
  const lively = useLivelyMotion();
  const nerd = profile.detail === "nerd";
  const year = ym.slice(0, 4);
  const book = useMemo(() => buildYearWorkbook(transactions, categories, year), [transactions, categories, year]);
  const savingsOnly = accounts
    .filter((account) => account.kind === "savings")
    .reduce((sum, account) => sum + Math.max(0, latestBalance(account.id, balances)?.amount ?? 0), 0);
  const cashSaved = accounts
    .filter((account) => account.kind === "savings" || account.kind === "cash")
    .reduce((sum, account) => sum + Math.max(0, latestBalance(account.id, balances)?.amount ?? 0), 0);
  const surplus = useMemo(() => {
    const buckets = bucketList ?? [];
    const moves = moveList ?? [];
    return buckets.reduce(
      (best, bucket) => {
        const balance = bucketBalance(bucket, ym, transactions, categories, moves);
        return balance > best.balance ? { name: bucket.name, balance } : best;
      },
      { name: "Leftover", balance: Math.max(0, book.net) },
    );
  }, [bucketList, moveList, ym, transactions, categories, book.net]);

  const [page, setPage] = useState<GrowPage>("overview");
  const [principal, setPrincipal] = useState(() => String(Math.max(0, Math.round(surplus.balance))));
  const [years, setYears] = useState("10");
  const [monthly, setMonthly] = useState("200");
  const [rate, setRate] = useState("7");
  const [taxNow, setTaxNow] = useState("22");
  const [taxLater, setTaxLater] = useState("12");
  const [annual, setAnnual] = useState(String(ira?.under50 ?? 7500));
  const [today, setToday] = useState(false);
  const [inflation, setInflation] = useState("2");
  const [age50, setAge50] = useState(false);
  const [joint, setJoint] = useState(false);
  const [magi, setMagi] = useState(String(Math.round((profile.monthlyIncome || 0) * 12)));
  const filled = useRef(false);

  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get("lump"));
    if (Number.isFinite(n) && n > 0) {
      setPrincipal(String(Math.round(n)));
      setPage("work");
    }
  }, []);

  useEffect(() => {
    if (filled.current) return;
    if (facts.monthlySaving.value == null && facts.age.value == null && facts.inflation.value == null && facts.saved.value == null) return;
    filled.current = true;
    if (facts.monthlySaving.value != null) setMonthly(String(Math.round(facts.monthlySaving.value)));
    setRate(String(Math.round((facts.returns.expected || 0.07) * 1000) / 10));
    if (facts.age.value != null) setAge50(facts.age.value >= 50);
    if (facts.inflation.value != null) setInflation(String(Math.round(facts.inflation.value * 1000) / 10));
    if (facts.saved.value != null) {
      setPrincipal((current) => (Number(current) > 0 ? current : String(Math.round(facts.saved.value ?? 0))));
    }
  }, [facts]);

  const inflationRate = Math.max(0, (Number(inflation) || 0) / 100);
  const yearCount = Math.max(0, Number(years) || 0);
  const principalN = Math.max(0, Number(principal) || 0);
  const monthlyN = Math.max(0, Number(monthly) || 0);
  const taxNowN = (Number(taxNow) || 0) / 100;
  const taxLaterN = (Number(taxLater) || 0) / 100;
  const market = (Number(rate) || 0) / 100;
  const savings = projectLump({ principal: principalN, years: yearCount, rates: SAVINGS_RATES, inflation: inflationRate, today, gainTax: taxNowN, endTax: 0 });
  const taxable = projectLump({ principal: principalN, years: yearCount, rates: MARKET_RATES, inflation: inflationRate, today, gainTax: taxNowN, endTax: 0 });
  const rothLump = projectLump({ principal: principalN * (1 - taxNowN), years: yearCount, rates: MARKET_RATES, inflation: inflationRate, today, gainTax: 0, endTax: 0 });
  const traditionalLump = projectLump({ principal: principalN, years: yearCount, rates: MARKET_RATES, inflation: inflationRate, today, gainTax: 0, endTax: taxLaterN });
  const path = monthlyPath({ monthly: monthlyN, years: yearCount, rate: market, inflation: inflationRate, today });
  const both = projectBoth({ principal: principalN, monthly: monthlyN, years: yearCount, rate: market, inflation: inflationRate, today });
  const annualN = Math.max(0, Number(annual) || 0);
  const compare = rothVsTraditional({ annual: annualN, years: yearCount, rate: market, taxNow: taxNowN, taxLater: taxLaterN, inflation: inflationRate, today });
  const limit = iraLimit(ira, age50);
  const room = rothRoom(ira, Math.max(0, Number(magi) || 0), joint);

  const tipFacts: TipFacts = {
    cushionMonths: facts.typicalSpendMonthly.value ? cashSaved / facts.typicalSpendMonthly.value : null,
    cardApr: debts.length ? Math.max(...debts.map((debt) => debt.apr)) : null,
    employerMatch: null,
    savingsRate: facts.savingsRate,
    savingsWanted: profile.savingsGoalRate ?? null,
    hasDebts: debts.length > 0,
  };

  return {
    page, setPage, profile, transactions, categories, accounts, balances, debts, netWorth, ira, facts, lively, nerd, book, cashSaved, savingsOnly, surplus, ym,
    principal, setPrincipal, years, setYears, monthly, setMonthly, rate, setRate, taxNow, setTaxNow, taxLater, setTaxLater,
    annual, setAnnual, today, setToday, inflation, setInflation, age50, setAge50, joint, setJoint, magi, setMagi,
    inflationRate, yearCount, principalN, monthlyN, taxNowN, taxLaterN, market, annualN,
    savings, taxable, rothLump, traditionalLump, path, both, compare, limit, room, tipFacts,
  };
}

export function GrowProvider({ children }: { children: ReactNode }) {
  const bag = useGrowState();
  return <GrowContext.Provider value={bag}>{children}</GrowContext.Provider>;
}

export function useGrow() {
  const bag = useContext(GrowContext);
  if (!bag) throw new Error("Grow page used outside Grow");
  return bag;
}
