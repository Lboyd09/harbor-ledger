# Category panel, leftovers, funds, and accounts that grow

## Commit

9bb156c92b458c8105f2ac963cad3d05797a144e

## Signatures

- categoryStory(row: SpendingLine): CategoryStory
- surplusSuggestions(source: LedgerSource, ym: string): SurplusSuggestion[]
- SetAside { id, ym, categoryId, fundId: string | null, amount }
- accountGrowth(account, balances, today, options?: { yearsToRetire?: number | null }): AccountGrowthResult
- shownBalance(account, balances, today): number
- groupAccounts, quickCash, quickInvestment
- Account.growth optional; AccountKind adds "cash"
- MonthLedger.funds, MonthLedger.released, YearLedger.funds
- Profile.carryAskSeen?: string | null

## Deleted files and exports

No files deleted. No routes deleted.

Removed from the screens, not exported:

- The inline expander, history bars, amount editors, and carry buttons on each Budget spending row. Those controls now live in the category panel.
- The old Home accounts list (balance form, kind icons, and the per-account block). AccountBoard replaced it.
- The "See what it could grow to" surplus line in month-parts.tsx.

Unexported, because nothing outside the file used them: ACCOUNT_GROUP_ORDER, ACCOUNT_GROUP_LABEL, accountGroup. groupAccounts still returns the same groups.

No CSS classes were left unused by this change. No shims.

## Conflicts and later prompts

- bank-label corpus: 48/48 (100%). merchant corpus: 180/180 (100%), sure-wrong 0%, likely-wrong 0%. analytics corpus: 24/24 (100%).
- Person-to-person payments (Venmo, Zelle, Cash App) are checked before a strong keyword, not after cash as the written ladder lists them. Left this way on purpose.
- setKeepsLeftovers still links a category to a fund and can clear the monthly amount. The Budget carry switch does not call it. Turning one category to carry, when no start is saved yet, sets the start to the first month of the file, not this month.
- monthCash and yearCash still live in totals.ts. They are wrappers on monthLedger and yearLedger. They are not a second formula, and they were not copied into screens.
- Confirming a Check remembers the bank label. Undo puts the charge back and does not forget that label. CategoryUndo has no profile field.
- A strong keyword still beats a bank label. The bank-label reason is used when the description is not already a keyword.
- Cash taken out goes to Other. The preset categories do not include one named Cash.
- A repeating amount with no keyword family lands on Subscriptions, then Other, not a category named Bills.
- The built preview still dies on a missing pglite data file (`pglite.data`). The dev app was walked. Typecheck passed. Lint had 0 errors and 7 warnings (2 new fast-refresh warnings on the panel and the account board, same pattern as the fund wizard, plus 5 that were already there).
- Moves from one fund to another are stored as fundMoves and are not added into savedToFunds. The month strip now says so in one sentence when that number is not zero.
- safeToSpend is still the old “after plans” number. It is computed from monthLedger, and it now subtracts savedToFunds, so a set-aside lowers it. The Budget strip shows leftOver, not that number.
- A later file that reaches further back does not move a start that is already saved. Budget now asks once, and the answer is remembered on carryAskSeen. Undo of the two plain choices does not clear that memory.
- Home’s saved number is money assigned to funds across the twelve months, including set-asides that name a fund. A fund screen still shows that fund’s balance, including what was already there. Same funding rule, different question.
- Decisions 23 and 28 are marked superseded by 49. Decision 27 still describes the old Month page’s carry sentences. Those sentences now live on the category panel.
- surplusSuggestions uses the month ledger’s carryOut and the same two-month cutoff as surplusToPutToWork. It does not call surplusToPutToWork, because that walk does not see set-asides and would overstate the leftover.
- A set-aside with a fundId is inside savedToFunds. A set-aside with no fund only lowers that category’s carry and is counted as released. Fund-to-fund moves stay out of savedToFunds.
- An account whose kind is "other" sits in Bank and cash, with checking and cash. It is not its own group.
- A fund card still has its older “Put in” line (the monthly funding amount). The sentence under it is the ledger: funding, set aside, and what linked categories spent. Those two lines answer different questions.
- Sorting opens a category from the saved rule, or from the one category every charge from that name already shares. A name with mixed categories has no Open button until a default is saved.
- categoryStory money is formatMoney, so the sentence says $40.00, not $40.
- When the last typed balance is today, the estimate equals that balance. The switch cannot show a different number until time has passed. A typed balance still wins until “Use estimates between updates” is on.

## Checklist

- One category panel, sheet on a phone and a side panel from md up, opened from a Budget row, a Home “where it went” slice, a Sorting row, and a fund card: done. Escape closes it. The dialog takes focus when it opens.
- categoryStory for over, under, even, fresh, and carry, each sentence under about 16 words, tone and icon as well as words: done.
- Picture: FillJar and the four numbers when the category carries; SpendMeter and Amount, Spent, Left when it starts fresh. MiniBars with Show as numbers: done.
- Amounts: usual amount, this-month-only amount, and the carry choice with carryConsequence, reusing the existing controls: done.
- Charges: This month, Last 3 months, All; grouped by week; merchant family name; full bank text one tap away; Check and Set by hand; change category, split, exclude, notes, delete; Add a charge for cash; 20 then Show more: done.
- Budget rows are name, one big number, jar or bar, one chip, tap to open. Inline expanders removed: done.
- setAsides optional on the ledger. A set-aside lowers carryOut. A fundId counts in savedToFunds. A null fundId only releases the money. Old ledgers and backups load without the list. Undo stays after the suggestion disappears: done.
- Identities: leftOver = received − spent − savedToFunds, and a carrying category’s left = carryOut. Switching carry still changes only that category’s left (existing ledger test): done.
- surplusSuggestions ranked, largest first, same two-month cutoff. One card at the top of Budget (up to three) and the same text in the panel. Add to a chosen fund, or Make a fund, and See what it could grow to with the lump already filled in. The old surplus line in month-parts is gone: done.
- Budget strip: Saved to funds opens funding and set-asides by fund. One sentence when fund moves are not zero: done.
- “In [fund name]” on a linked category, and it opens that fund. A fund card says what it received this month and what linked categories spent, from the same ledger: done.
- Funds page top: total in funds, this month put in, and used. Home year shows saved by fund, in Simple and in Advanced: done.
- A new file that reaches back before the saved leftover start asks once. It does not move the start by itself: done.
- AccountKind cash. Cash, investment, and retirement take no file. Home order is bank and cash, savings, investments and retirement, cards and loans, then net. Stale label, Add a file, and Update balance stay: done.
- Quick add from Home and from the Home menu Accounts. Cash is an amount. An investment is name, type (brokerage, Roth IRA, traditional IRA, 401(k), other), and balance: done.
- accountGrowth: estimate now, last typed, expected this year, and three ordered paths at 10, 20, and 30 years or the retire age. No parameters: one line asking for a return and a monthly amount. Estimates do not replace a typed balance or the net until Use estimates between updates is on: done.
- Tests for categoryStory, set-aside identities, surplusSuggestions, accountGrowth (zero, negative, large, typed wins, paths ordered, fee reduces growth), quick add, and group order: done. 101 budget tests passed. Typecheck passed. Lint: 0 errors, 7 warnings.
- Walked at 375 px and on a wide screen, in Simple and in Advanced. Opened a carrying category, moved one Shell charge to Eating out, added a cash charge, set $145 of Other aside into Used car. August’s strip, the Used car card, and Home’s year all showed the extra $145 (saved $515 that month, $2,735 for the year). Undo put a later Gas set-aside back. Added $80 cash and a Roth with Typical and $200 a month. The card stayed at the typed $12,000. No sideways scroll on Home, Budget, Funds, or Grow. No dead link on the fund tag or the Grow lump link: done.

## Objections

- Moves between funds are not inside savedToFunds. They are one sentence under the strip so the four month numbers still add up.
- safeToSpend is not what the strip calls Left.
- The year saved figure will not match a fund’s balance. The balance includes the opening and every month. The year figure is only what was assigned in that year.
- surplusToPutToWork is still the named cutoff, but the suggestion list reads the ledger so an earlier set-aside is not offered twice.

## Proposals

- The fund card’s older “Put in” line could say funding plus set-asides, so it matches the sentence under it.
- A set-aside could be for part of the leftover, not only the whole suggested amount.
- Sorting could show the category the charges already use in the dropdown, not only on the Open button. The dropdown still waits for a saved rule.
