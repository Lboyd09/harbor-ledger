# Age, retirement, and the last screens

## Commit

5b329d75a80f64efa15e5bfc51809596810679e5

## Signatures

- figureById(id: string): ReferenceFigure | undefined
- figuresNeedingCheck(): ReferenceFigure[]
- figureLine(figure: ReferenceFigure): string
- assumptionLines(ids: string[]): string[]
- ageInYear(birthYear: number | null | undefined, year: number): number | null
- birthYearFromAge(age: number, year: number): number | null
- plannerFacts(input: { profile: Profile; accounts: Account[]; balances: BalancePoint[]; transactions: Transaction[]; categories: Category[]; year: number }): PlannerFacts
- cleanRetirementInput(raw: RetirementInput): RetirementInput
- nominalBalance(saved: number, monthly: number, annualRate: number, years: number): number
- projectRetirement(raw: RetirementInput): RetirementResult
- retirementWithExtra(raw: RetirementInput, extraPerMonth: number): RetirementResult
- retirementWithYears(raw: RetirementInput, extraYears: number): RetirementResult
- retirementSensitivity(raw: RetirementInput): SensitivityRow[]
- retirementMonteCarlo(raw: RetirementInput, options?: { mean?: number; spread?: number; seed?: number; runs?: number; endAge?: number }): MonteCarloResult
- defaultRetirementInput(): RetirementInput
- yearRows(input: { principal: number; monthly: number; years: number; rate: number; inflation: number; today: boolean }): YearRow[]
- sensitivityOf(project: (rate: number, monthly: number) => number, rate: number, monthly: number): SensitivityRow[]
- amortizationSchedule(input: { balance: number; aprPercent: number; years: number; extra?: number }): AmortizationRow[]
- debtTimeline(debts: DebtItem[], extra: number): { minimums: DebtMonth[]; withExtra: DebtMonth[] }
- debtMatchesPayoff(debts: DebtItem[], extra: number): boolean
- netWorthSeries(accounts: Account[], balances: BalancePoint[]): WorthPoint[]
- fiNumbers(input: { yearlySpend: number; withdrawal: number; savingsRate: number; realReturn: number; yearsLeft: number | null }): { fi: number | null; years: number | null; coast: number | null }

grow-math.ts and ira.ts results are unchanged. IRA_LIMITS still equal the 2026 DEFAULT_IRA amounts.

## Conflicts and later prompts

- bank-label corpus: 48/48 (100%). merchant corpus: 180/180 (100%), sure-wrong 0%, likely-wrong 0%. analytics corpus: 24/24 (100%).
- Person-to-person payments (Venmo, Zelle, Cash App) are checked before a strong keyword, not after cash as the written ladder lists them. Left this way on purpose.
- setKeepsLeftovers still links a category to a fund and can clear the monthly amount. The Budget carry switch does not call it.
- yearCash still lives in totals.ts and was not copied anywhere else.
- Confirming a Check remembers the bank label. Undo puts the charge back and does not forget that label. CategoryUndo has no profile field.
- A strong keyword still beats a bank label. The bank-label reason is used when the description is not already a keyword.
- Cash taken out goes to Other. The preset categories do not include one named Cash.
- A repeating amount with no keyword family lands on Subscriptions, then Other, not a category named Bills.
- The built preview still dies on a missing pglite data file (`pglite.data`). The dev app was walked. Typecheck passed. Lint had 0 errors and 5 existing warnings. The production build succeeded.
- Return ranges (savings 3 / 4.2 / 5 percent, market 4 / 7 / 10 percent) are marked needs checking. They are the existing Harbor planning range, not a published series. Values are imported from grow-math so they cannot drift.
- 401(k) deferral 24500, catch-up 8000, and ages 60–63 catch-up 11250 are stored from IRS Notice 2025-67. No calculator reads them yet.
- Employer match is a percent of what the person saves, not of pay. 50 means the employer adds half again. That is stated on the card.
- Full Social Security age 67 is for a birth year of 1960 or later. Earlier birth years have a lower full age. The card says so.
- The 4 percent withdrawal is Bengen, Journal of Financial Planning, October 1994. It is a historical rule, not a current IRS figure. The card says so.
- Monte Carlo is one draw per year, not per month, so it will not match the monthly compounding path exactly. Same seed, same result.

## Figures marked needs checking

- Savings return, low / middle / high (0.03 / 0.042 / 0.05). Harbor planning range.
- Market return, low / middle / high (0.04 / 0.07 / 0.10). Harbor planning range.

Checked, and shown with date and source where a screen uses them: IRA limits and Roth phase-outs (IRS Notice 2025-67, as of 2026-01-01), 401(k) limits (same notice), Social Security ages 62 / 67 / 70 (SSA; 67 is birth year 1960 or later), inflation 2 percent (Federal Reserve longer-run goal, as of 2025-08-22), withdrawal 4 percent (Bengen, October 1994).

## Checklist

- Reference file with value, date, source, and status: done.
- IRA figures moved unchanged: done.
- 401(k), Social Security ages, inflation, return ranges, 4 percent withdrawal: done. Return ranges need checking.
- Retirement inputs prefilled and tagged: done.
- Three paths, income supported, percent covered, gap, extra per month, extra years: done. Both close paths reach the target in tests.
- Balance-by-age chart, ring, one sentence, year table under Show as numbers: done.
- Advanced sensitivity and seeded Monte Carlo to age 95: done.
- Tests for zero savings, already past retire age, huge gap, negative inputs, seed, and gap closing: done.
- grow-tables year rows, sensitivity, amortization, debt timeline, net worth, FI: done. grow-math and ira results not changed.
- Every calculator prefilled, tagged, with a picture and a sentence: done. Advanced adds six metrics, a table, assumptions, and sensitivity where a rate or a monthly amount moves.
- When work is optional uses real spending, FI number, years, and coast: done.
- Emergency fund uses a typical month and steady bills: done.
- Net worth from account balances, with a one-snapshot note: done.
- Debt payoff date, interest, and timeline against minimums: done.
- Loan amortization and extra-payment savings: done. Balance comes from a credit account when one exists. A typed debt stays on the debt calculator so it is not counted twice.
- Roth uses age for the catch-up and warns on the income band: done.
- Grow order Plan ahead, See it grow, Protect yourself, Pay it down: done.
- Age on setup step 1, optional, Skip, summary with Change, stored as birthYear: done.
- Account Your numbers, with defaults and reset: done. Old ledgers without the fields still load.
- Simple Home is the headline, Needs you when it applies, the year chart, and one next action. The rest is under More: done.
- Under three months, the plan-percent line stays hidden. The cushion sentence needs three months, otherwise it says waiting on more history: done.
- Sorting card for names that still have no category, and a Check tag on fair guesses: done. The card stays hidden when every charge already has a category.
- Funds sentence and Grow link: done.
- Visible wording: no bucket, envelope, rollover, allocate, reconcile, or Nerd. The stored value stays nerd. Simple and Advanced are the labels: done.

## Objections

- A match typed as 50 is half of saving, not half of pay. Someone who means a salary match will overstate the employer add. The sentence on the card is the guard.
- The thousand tries use one return per year. They answer "does it last," not "what is the monthly balance."
- Four percent is a 1994 study. Treating it as checked does not make it a current safe rate.
- Age 67 is not everyone's full Social Security age. The screen says that, and it does not look up the person's birth year against the SSA table.

## Proposals

- A 401(k) picture that uses the deferral and catch-up figures already stored.
- If there is a typed debt and no credit account, offer that balance and rate on the loan screen instead of a blank balance.
- A Social Security guess from claiming age, using 62, 67, and 70, instead of a blank monthly field.
