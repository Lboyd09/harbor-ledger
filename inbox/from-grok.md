# Sorting, then Home, Budget, Month, and import

## Commit

934c5703dc657dda3643fb644b9f123afd443f35

## Signatures

- merchantFamily(description: string): string
- tokenOverlap(a: string, b: string): number
- editDistance(a: string, b: string): number
- applyConfirmAuto(transactions: Transaction[], ids: string[], profile: Profile): { transactions: Transaction[]; profile: Profile }
- rememberBankLabel(profile: Profile, label: string | null | undefined, categoryId: string | null): Profile
- guessAccountKind(rows: { description: string; amount: number | null }[], endingBalance: number | null): AccountGuess
- inferIncomeStreams(transactions: { date: string; description: string; amount: number; status?: string; merchantKey?: string }[], categories: Category[], profile: Pick<Profile, "incomeStreams">): IncomeSuggestion[]
- monthEndBalances(rows: ParsePreviewRow[]): BalancePoint[]
- fileChecklist(input: { rows: ParsePreviewRow[]; categories: Category[]; profile: Pick<Profile, "incomeStreams">; endingBalance: { amount: number; asOf: string } | null }): ChecklistLine[]
- applyAdoptedIncome(input: { profile: Profile; categories: Category[]; transactions: Transaction[]; suggestions: IncomeSuggestion[]; createCategoryId: () => string; createStreamId: () => string }): { profile: Profile; categories: Category[]; transactions: Transaction[] }
- dataDepth(transactions: Transaction[]): DataDepth | null
- typicalMonth(transactions: Transaction[], categories: Category[]): TypicalMonth | null
- recurringBills(transactions: Transaction[], categories: Category[], today: string): RecurringBill[] | null
- payCycle(transactions: Transaction[]): PayCycle | null
- runway(accounts: Account[], balances: BalancePoint[], transactions: Transaction[], categories: Category[]): Runway | null
- categoryTrends(transactions: Transaction[], categories: Category[], ym: string): CategoryTrend[] | null
- unusualCharges(transactions: Transaction[], ym?: string): UnusualCharge[] | null
- incomeStability(transactions: Transaction[], categories: Category[]): IncomeStability | null
- savingsRateSeries(transactions: Transaction[], categories: Category[]): SavingsPoint[] | null
- rankedInsights(transactions: Transaction[], categories: Category[], today: string, accounts?: Account[], balances?: BalancePoint[]): RankedInsight[]
- waitingUnlocks(transactions: Transaction[], categories: Category[], today: string): { id: string; title: string; detail: string }[]
- reviewQueue(transactions: Transaction[], categories: Category[], history?: Transaction[], rules?: MerchantRule[]): ReviewGroup[]
- queueStats(queue: ReviewGroup[]): QueueStats
- coverSentence(stats: QueueStats): string
- forecastChip(projected: number, planned: number | null): ForecastChip | null
- budgetLead(input: { plannedSpend: number; usualIncome: number; typicalSpend: number | null; typicalMonths: number }): BudgetLead
- orderSpending<T extends SpendRank>(rows: T[]): T[]
- splitFixedFlexible<T extends { id: string }>(rows: T[], fixedIds: string[], flexibleIds: string[]): { fixed: T[]; flexible: T[]; rest: T[] }
- suggestAmounts(categories: Category[], transactions: Transaction[], ym: string): AmountSuggestion[]
- comingUp(bills: RecurringBill[] | null, today: string, days?: number): ComingItem[] | null
- carryConsequence(left: number, carries: boolean): string
- paceSentence(forecast: MonthEndForecast | null): string
- dueLabel(hints: string[], cadence: IncomeCadence, transactions: Transaction[], ym: string, received: number): string | null
- monthStrip(input: { forecast: MonthEndForecast | null; incomeSoFar: number; incomeStill: number | null }): MonthStrip
- confirmAuto(ids: string[]): CategoryUndo
- adoptIncomeStreams(suggestions: IncomeSuggestion[]): void

MonthEndForecast also gained low and high (the pace band).

## Conflicts and later prompts

- bank-label corpus: 48/48 (100%). merchant corpus: 180/180 (100%), sure-wrong 0%, likely-wrong 0%. analytics corpus: 24/24 (100%).
- Person-to-person payments (Venmo, Zelle, Cash App) are checked before a strong keyword, not after cash as the written ladder lists them. The keyword list includes "VENMO FROM", "ZELLE FROM", and "CASH APP FROM" as income. If those ran first, a person-to-person payment would be marked sure. History still wins when it exists. Left this way on purpose.
- setKeepsLeftovers still links a category to a fund and can clear the monthly amount. The Budget carry switch does not call it. It only sets the category flag, and the start month if the ledger did not have one.
- yearCash still lives in totals.ts and was not copied anywhere else.
- Confirming a Check remembers the bank label. Undo puts the charge back and does not forget that label. CategoryUndo has no profile field.
- A strong keyword still beats a bank label. LANDLORD, GEICO, SHELL, and KROGER sort as keyword sure. The bank-label reason is used when the description is not already a keyword. The walk's Kroger rows said "The name looks like Groceries."
- Cash taken out goes to Other. The preset categories do not include one named Cash.
- A repeating amount with no keyword family lands on Subscriptions, then Other, not a category named Bills.
- reviewQueue still includes fair guesses, because the engine spec asked for that. Home "Needs you" and the one-name sort list only the charges that have no category. Fair guesses stay on Checked for you.
- Simple Home still shows the year chart, the top insights, accounts, the donut, and funds. Decision 43 says simple is the answer, one picture, and one next action. The screen list for Home named those sections for everyone, and put "All the numbers" in advanced only. Advanced is the grouped panels. They are not on the simple Home.
- The built preview was not walked again. An earlier preview died on a missing pglite data file. The dev app was walked, typecheck passed, lint had 0 errors, and the production build succeeded.

## Checklist

- Stage 1 file inference (kind, pay patterns, month-end balances, adopt): done.
- Stage 1 sorting ladder, provisional Check, confirmAuto, bankLabelMap: done, with the person-to-person order above.
- About 300 merchant patterns: done (321 lines added to keywords.ts).
- Analytics that stay quiet until the file can support them, plus ranked insights: done, in analytics-depth.ts, folded into fileInsights.
- reviewQueue, biggest dollars first, up to three suggestions: done.
- Tests for the engine, the corpus, and the screen helpers: done.
- One sort screen for import, Home, and Month, with keys 1/2/3, S, Z, and Undo: done.
- Import kind reason, checklist, pay-pattern Add, sorted count, Checked for you, See what was sorted: done.
- Budget two sides, phone switch, summary, fixed and everyday groups, carry consequence, forecast chip: done. A nerd row shows typical and fixed or variable. It does not show a separate spread number. Partly done.
- Month so far (days left, spent, expected, range, income still expected, projected left), delta versus usual, still coming, unusual-charge dismiss: done.
- Home headline, Needs you, year in and out, top insights, coming up, accounts and cushion, donut, funds, advanced All the numbers: done.
- Onboarding, calculators, Funds, Account, carry math, splits, payback, refunds, auth, themes: left alone.
- Old ledgers without the new fields still load: done (existing backup test, optional fields).
- Walk at 375 and on desktop, simple and advanced: done. No sideways scroll. A new checking account, a file with Category, Memo, and Balance, the kind sentence, the checklist, $1,840 every month from Acme Payroll, 11 of 13 sorted, option 2, Undo, Checked for you reasons on Target and Amazon, the budget sentence, the carry switch, and the Home headline.

## Still not done or not working as well as it could

- When the plan is the setup floors and the file is only a few small months, the cover line says the plan is a very large percent of a typical month. That number is the plan divided by the file. It is not a mistake, and it is awkward.
- A cushion reading can look huge when typical spending in the file is small and the balance is not. It says what it is based on.
- The next prompt is still calculators with retirement and age, onboarding (adds age), Sorting, Funds, Account, and the wording sweep.
