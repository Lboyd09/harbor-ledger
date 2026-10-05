# Round 3, prompt 3 of 3

## Commit

04c21b27191c862f43a1b9282270c5e50788cbe0

## Signatures

- tipsFor(topic: string, facts?: TipFacts): Tip[]
- tipWordCount(tip: Tip): number
- visibleSentences(source: string): string[]
- copyProblems(source: string): string[]
- queueFundFromGoal(prefill: { name: string; target: number; by: string | null; monthly: number }): void
- WORKBOOK_SHEETS (the twelve sheet names, in order)
- useGrow(): grow session
- CalcFrame({ question, numbers, result, picture, keyNumbers, topic, facts, assumptionIds, years, advanced })

## Deleted

Files: src/components/grow-view.tsx (the thirteen-card picker, NerdGrow, BandLine), src/components/calc-depth.tsx (AdvancedDepth).
Store export: setKeepsLeftovers. Nothing in the app called it. Linking a category still uses linkBucketCategory.
Styles: brass, meadow, and midnight (the accent blocks and the swatches). Keyframes route-in and row-in. The looping jar animations. They are one draw-in now.
Workbook sheets: Saving for, Overview, Months, Plan, Month budgets, IRA figures, Income merchants, Spending merchants.
Kept on purpose: monthCash and yearCash. Analytics and the year overview still call them.

## Checklist

- Grow landing, five tiles, page menu, one file per page, shared frame, lump link, fund prefill: done.
- Retirement: partly. The existing card stays, so its result and Monte Carlo do not change. Tips, assumptions, and "Not personal advice" sit under it.
- Add every month includes a starting pile, so the old "both" calculator is not lost. Doubling and reaching a number share one page.
- Tips, about 30, at most three, tests: done.
- Workbook order, ledger totals, live left and total formulas, three charts, empty ledger, same file for Google Sheets: done.
- Three looks plus Automatic. Old stored values map (brass to harbor, meadow to tide, midnight to dusk). Choosing Automatic writes "auto": done.
- Motion 160 to 220 ms, ease-out, once. Calm and reduced motion turn it off: done.
- Long paragraphs split. The text test passes. Banned words are not shown: done.
- Dead code: done for the grow screen, the old looks, and setKeepsLeftovers. Two older unused locals (Stat, planIncomeUser) were already unused and were left.
- Typecheck: done. Lint: 0 errors, warnings remain (react-refresh on files that export a helper next to a component, plus two older unused locals).
- Unit tests, including the earlier budget files plus tips, copy, and the workbook: 163 passed.
- Walk at 375 and desktop, Simple and Advanced, each Grow page, the fund wizard prefilled, Dusk and Automatic, calm motion, no sideways scroll: done.
- Keyboard-only through every control: partly. The page menu already moves with the arrow keys. I did not tab every field.
- Opened the workbook in Excel or Google Sheets itself: not done. SheetJS read the same bytes back and the year total matched yearLedger.

## Conflicts

- Employer match is typed only on the retirement card and is not saved, so that page's first tip stays the "no match entered" tip.
- savingsGoalRate is optional and has no control yet, so the "under the rate you want" tip runs only when that field is already stored.
- A category is still linked to a fund with linkBucketCategory, not with the removed setKeepsLeftovers.

## Objections

- Rebuilding retirement inside the shared frame would have copied formulas that retirement.ts already owns. I left the card and added the tips around it.

## Proposals

- Save the employer match and the savings rate the person wants, so those two tips follow the person.
- A later pass can show retirement's key numbers in the shared frame without a second formula.

## Still not done from this round

- A full keyboard pass of every Grow field.
- Opening the workbook inside Excel or Google Sheets (the file was checked with SheetJS).
- BRIEF.md is not in this repo.
- The script half of npm test was not treated as part of this change. The unit-test list passed.
- New Grow headlines do not count up. Home still does.
