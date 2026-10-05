# One calculation, Budget is the month

## Commit

014a0d208e8818bf65d79d947f2fed4f5f048fbd

## Signatures

- earliestDataMonth(transactions: Transaction[]): string | null
- monthLedger(source: LedgerSource, ym: string, cache?: Map<string, MonthLayout>): MonthLedger
- yearLedger(source: LedgerSource, year: string): YearLedger
- safeFromLedger(source: LedgerSource, ym: string): { amount: number; funding: number; moved: number; spent: number; plans: number; income: number }
- IncomeLine, SpendingLine, MonthTotals, MonthFlags, MonthLedger, LedgerSource, YearLedger
- Category.carryFrom?: string | null

## Deleted files and exports

- src/components/month-board.tsx — MonthBoard
- src/components/overview.tsx — DesktopOverview, MobileOverview
- src/components/guide-card.tsx — GuideCard
- src/components/payback-control.tsx — PaybackControl
- src/components/recurring-view.tsx — RecurringView
- src/components/refund-guide.tsx — RefundGuide
- src/components/transaction-views.tsx — TransactionDesktop, TransactionMobile
- src/components/home-switch.tsx — HomeSwitch
- src/components/ledger-tabs.tsx — LedgerTabs
- src/components/month-page.tsx — MonthPage
- src/components/plan-view.tsx — PlanView
- src/routes/month.tsx, src/routes/payees.tsx, src/routes/recurring.tsx, src/routes/activity.tsx, src/routes/account.tsx, src/routes/plan.tsx, src/routes/categories.tsx

No redirects. /budget and /rules and /imports are the new routes. PlanView’s editing lives in budget-amounts.tsx as AmountsPage. MonthPage’s list lives in budget-transactions.tsx as TransactionsPage.

## Conflicts and later prompts

- bank-label corpus: 48/48 (100%). merchant corpus: 180/180 (100%), sure-wrong 0%, likely-wrong 0%. analytics corpus: 24/24 (100%).
- Person-to-person payments (Venmo, Zelle, Cash App) are checked before a strong keyword, not after cash as the written ladder lists them. Left this way on purpose.
- setKeepsLeftovers still links a category to a fund and can clear the monthly amount. The Budget carry switch does not call it. Turning one category to carry, when no start is saved yet, sets the start to the first month of the file, not this month.
- monthCash and yearCash still live in totals.ts. They are wrappers on monthLedger and yearLedger. They are not a second formula, and they were not copied into screens.
- Confirming a Check remembers the bank label. Undo puts the charge back and does not forget that label. CategoryUndo has no profile field.
- A strong keyword still beats a bank label. The bank-label reason is used when the description is not already a keyword.
- Cash taken out goes to Other. The preset categories do not include one named Cash.
- A repeating amount with no keyword family lands on Subscriptions, then Other, not a category named Bills.
- The built preview still dies on a missing pglite data file (`pglite.data`). The dev app was walked. Typecheck passed. Lint had 0 errors and 5 existing warnings.
- Moves from one fund to another are stored as fundMoves and are not added into savedToFunds. Adding them would break left = received − spent − saved. The month strip uses savedToFunds.
- safeToSpend is still the old “after plans” number. It is computed from monthLedger. The Budget strip shows leftOver, not that number.
- A later file that reaches further back does not move a start that is already saved. The choice then says the new first month. The person can pick it. Undo puts the old start back.
- Home’s saved number is money assigned to funds across the twelve months. A fund screen still shows that fund’s balance, including what was already there. Same funding rule, different question.
- Decisions 23 and 28 are marked superseded by 49. Decision 27 still describes the old Month page’s carry sentences. Those sentences now live on Budget.

## Checklist

- monthLedger and yearLedger, with income, spending, saved to funds, left over, flags, rolling-12, and since-start: done.
- Tests: left equals received minus spent minus saved; a carrying category’s left equals its carry-out; switching one category changes only that left; refunds, splits, transfers, hidden deposits, provisional charges, an empty month, and a year boundary stay finite and identical: done.
- Home’s year in, out, and saved are yearLedger totals. August’s strip was $3,840.00 received, $1,387.13 spent, $370.00 saved, $2,082.87 left. The 2026 line was $14,310.00 in, $5,559.36 out, $2,590.00 saved, which is seven funded months of $370: done.
- incomeRows, spendingRows, monthCash, yearCash, yearOverview, spanOverview, monthGlance, needsALook, carrySummary, and safeToSpend read the ledger: done. safeToSpend keeps its old meaning.
- Default leftover start is the earliest transaction month, set on first import and the first time carry-over is turned on: done. Two plain choices, plus Undo, on Budget and Account. Setup says the same thing: done. Per-category carryFrom is optional and old ledgers still load: done.
- PageMenu on Home and Budget. No Home | Month switch and no second tab row. Five tabs unchanged: done.
- Budget at /budget: month switcher, strip, forecast when the month has one, money in and money out, fixed and everyday with over first, still coming, charges that need a category, one-month amounts, carry choice, splits, payback, hidden deposits, and the line-by-line list: done. Set amounts and All transactions are in the menu: done. Category row visuals were not redesigned: done.
- Home at /: accounts first, year in/out/saved, Needs you, insights and coming up under More in Simple: done. Year review, Import, Sorting rules, and Past imports are in the menu: done.
- /plan is /budget. /categories is /rules. Links and the shell follow that. Old routes deleted, no shims: done.
- Funds, Grow, and Account screens were not redesigned. Links that pointed at the old pages were updated: done.
- Typecheck passed. Lint: 0 errors, 5 existing warnings. Walked at 375px (no sideways scroll) and on a wide screen. Imported a January–March file into a new account. The first-month choice then said January 2026. Switched Groceries from fresh to carry: only that row’s left changed. Menu reached This month, Set amounts, All transactions, Year review, Import, Sorting rules, and Past imports: done.

## Objections

- Moves between funds are not inside savedToFunds. The prompt said “plus moves between funds.” They are reported beside the total so the four month numbers still add up.
- safeToSpend is not what the strip calls Left. The strip is cash left after spending and fund assignments. safeToSpend is still “after the plan.”
- The year saved figure will not match a fund’s balance. The balance includes the opening and every month. The year figure is only what was assigned in that year.

## Proposals

- When a new file starts before the saved leftover month, ask once whether to move the start. Do not move it silently.
- When fundMoves is not zero, say so under the strip in one sentence.
- The next prompt can restyle the category rows. The amounts and the carry choice are already on the row.
