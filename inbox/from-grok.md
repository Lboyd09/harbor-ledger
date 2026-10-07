# UI rebuild

## Commit

18be75c3435785ff19ce39403e9fbfa0933babdf

## What changed

Today is three cards: Safe to spend, Needs you, and Bills coming up. The year charts and account list moved off Today. Budget, Money, and Plan use visible tabs. Settings is a gear, not a fifth tab. Looks are Light, Dark, and Automatic.

Negative money shows as -$1,234.56. A debt that never pays off shows dashes instead of 50+ years and a huge interest total. Loan years stay exact (5.5 years is 66 months), the schedule runs the full term, and a card balance is not filled in as a loan. Reach a number uses its own already-saved box, defaults the target to a savings goal, and says "Not within 50 years" instead of 0 months.

A new usual amount applies from this month forward. Past months keep the plan they had. Starting your own budget wipes the sample paycheck, the store card, and the $5,100 snapshot. Setup income is the expected amount when a paycheck is linked to that setup figure.

## Left

Each calculator does not have its own URL yet. Net worth still does not subtract every loan. Cushion months still disagree between screens. Retirement and When work is optional still start from different monthly savings. The category rows are not yet one tap-to-edit line. The production preview still dies on the missing pglite data file when no database URL is set. Vercel settings were not touched.

## Checks

Typecheck passed. App unit tests passed (228). Lint has no new errors. Desktop and phone: Today, Budget tabs, Money tabs, the five Plan questions, and Settings without the word Harbor. No sideways scroll. Dev server smoke had no console errors.
