import { figureById } from "./reference.ts";

export type TipStatus = "general guidance" | "needs checking";

export type Tip = {
  id: string;
  topic: string;
  text: string;
  source: string;
  status: TipStatus;
  when?: (facts: TipFacts) => boolean;
};

export type TipFacts = {
  cushionMonths?: number | null;
  cardApr?: number | null;
  employerMatch?: number | null;
  savingsRate?: number | null;
  savingsWanted?: number | null;
  hasDebts?: boolean;
};

const withdrawal = figureById("withdrawal");

/** Short, general ideas. A number appears only when it is a dated reference figure. */
export const TIPS: Tip[] = [
  { id: "match-first", topic: "retirement", text: "Take an employer match before other investing. It is part of pay.", source: "General saving order.", status: "general guidance", when: (f) => f.employerMatch == null || f.employerMatch <= 0 },
  { id: "match-entered", topic: "retirement", text: "Count the match as part of what you save, then raise your own amount slowly.", source: "General saving order.", status: "general guidance" },
  { id: "debt-before-low", topic: "debt", text: "Pay high-interest debt before money that is likely to earn less than that rate.", source: "General saving order.", status: "general guidance", when: (f) => (f.cardApr ?? 0) >= 8 || Boolean(f.hasDebts) },
  { id: "debt-minimums", topic: "debt", text: "Pay at least the minimum on every debt, then put extra on the highest rate.", source: "General saving order.", status: "general guidance" },
  { id: "cushion-cash", topic: "cushion", text: "Keep the cushion in cash you can reach, not in a fund that can fall.", source: "General saving order.", status: "general guidance", when: (f) => f.cushionMonths == null || f.cushionMonths < 3 },
  { id: "cushion-size", topic: "cushion", text: "A few months of spending is enough for most people. Steady jobs can sit lower.", source: "General saving order.", status: "general guidance" },
  { id: "fees", topic: "work", text: "Fees compound the same way growth does. A smaller fee keeps more of the gain.", source: "General saving order.", status: "general guidance" },
  { id: "fees-monthly", topic: "monthly", text: "A yearly fee comes out every year. Compare it before you pick where the money sits.", source: "General saving order.", status: "general guidance" },
  { id: "roth-later", topic: "roth", text: "Roth versus traditional is about tax now versus tax later. Neither is always better.", source: "General saving order.", status: "general guidance" },
  { id: "roth-room", topic: "roth", text: "The phase-out is an income test. Check the current IRS year before you rely on it.", source: "IRS contribution rules.", status: "needs checking" },
  { id: "diversify", topic: "work", text: "Spread money across many holdings. One company or one year is a narrow bet.", source: "General saving order.", status: "general guidance" },
  { id: "diversify-retire", topic: "retirement", text: "A mix of stocks and bonds changes as the date you need the money gets closer.", source: "General saving order.", status: "general guidance" },
  { id: "automate", topic: "monthly", text: "An automatic transfer on payday is easier to keep than a decision every month.", source: "General saving order.", status: "general guidance" },
  { id: "automate-goal", topic: "goal", text: "Automate the monthly amount into a fund so the goal does not depend on memory.", source: "General saving order.", status: "general guidance" },
  { id: "review-year", topic: "retirement", text: "Review the plan once a year. Pay, spending, and the match all change.", source: "General saving order.", status: "general guidance" },
  { id: "review-rate", topic: "work", text: "Review the rate you typed once a year. A guess is not a promise of return.", source: "Harbor planning range.", status: "needs checking" },
  { id: "goal-separate", topic: "goal", text: "A goal is extra savings. It is not a spending category and it is not the cushion.", source: "General saving order.", status: "general guidance" },
  { id: "goal-date", topic: "goal", text: "A near date belongs in cash. A far date can sit where it may grow.", source: "General saving order.", status: "general guidance" },
  { id: "inflation-spend", topic: "inflation", text: "Prices rise, so a plan that never increases spending gets tighter over time.", source: "General saving order.", status: "general guidance" },
  { id: "inflation-cash", topic: "cushion", text: "Cash does not grow with prices. That is fine for money you may need soon.", source: "General saving order.", status: "general guidance" },
  { id: "loan-extra", topic: "loan", text: "Extra payments cut interest only when they go to principal, not to fees.", source: "General saving order.", status: "general guidance" },
  { id: "loan-rate", topic: "loan", text: "A lower rate matters more than a longer term if the payment still fits.", source: "General saving order.", status: "general guidance" },
  { id: "worth-all", topic: "worth", text: "Net worth is what you own minus what you owe. Leave a debt out and the total is high.", source: "General saving order.", status: "general guidance" },
  { id: "worth-update", topic: "worth", text: "Update the number when you know it. An old snapshot is not a trend.", source: "General saving order.", status: "general guidance" },
  { id: "double-not-promise", topic: "double", text: "Doubling time is a guess from the rate you typed. It is not a promise.", source: "Harbor planning range.", status: "needs checking" },
  { id: "double-fee", topic: "double", text: "A fee lowers the rate that actually compounds. Type the fee if you know it.", source: "General saving order.", status: "general guidance" },
  { id: "rate-gap", topic: "monthly", text: "If saving is under what you said you want, raise the automatic amount, not the hope.", source: "General saving order.", status: "general guidance", when: (f) => f.savingsWanted != null && f.savingsRate != null && f.savingsRate + 0.005 < f.savingsWanted },
  { id: "withdraw-study", topic: "free", text: withdrawal ? `One study used a ${Math.round(withdrawal.value * 100)}% withdrawal, as of ${withdrawal.asOf}. It is not a rule for you.` : "A withdrawal rate is a study, not a rule for you.", source: withdrawal?.source ?? "Reference", status: "needs checking" },
  { id: "work-optional-spend", topic: "free", text: "The date work is optional moves when spending moves. Spending is the lever.", source: "General saving order.", status: "general guidance" },
  { id: "no-product", topic: "work", text: "Harbor does not name a fund or a bank. The picture is the math, not a product.", source: "General saving order.", status: "general guidance" },
  { id: "lump-time", topic: "work", text: "Money you will not need for many years can take more ups and downs.", source: "General saving order.", status: "general guidance" },
  { id: "emergency-first", topic: "debt", text: "A tiny cash cushion comes before extra debt payments, so a surprise does not create new debt.", source: "General saving order.", status: "general guidance", when: (f) => f.cushionMonths != null && f.cushionMonths < 1 },
];

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function tipWordCount(tip: Tip) {
  return words(tip.text);
}

/** At most three tips for this page, preferring ones that match the person's facts. */
export function tipsFor(topic: string, facts: TipFacts = {}): Tip[] {
  const pool = TIPS.filter((tip) => tip.topic === topic || tip.topic === "general");
  const matched = pool.filter((tip) => (tip.when ? tip.when(facts) : false));
  const rest = pool.filter((tip) => !tip.when);
  const picked: Tip[] = [];
  for (const tip of [...matched, ...rest]) {
    if (picked.some((row) => row.id === tip.id)) continue;
    picked.push(tip);
    if (picked.length === 3) break;
  }
  return picked;
}
