# Bank labels, quiet analytics, and per-category carry

## Commit

77f4dce5d1cde0e44e486bee7123e91d8e875145

## Signatures

- matchBankLabel(label: string, categories: Category[]): BankMatch | null
- categoryCarries(category: Category, style: BudgetStyle): boolean
- monthEndForecast(input: { transactions: Transaction[]; categories: Category[]; ym: string; today: string; budgets?: MonthBudget[] }): MonthEndForecast | null
- priceIncrease(transactions: Transaction[]): PriceChange | null
- stoppedBill(transactions: Transaction[], today: string): StoppedBill | null
- oneOffCharge(transactions: Transaction[], ym: string): OneOffCharge | null
- yearBoundary(transactions: Transaction[], categories: Category[], year: number): YearBoundary | null
- quietMonth(transactions: Transaction[], categories: Category[]): QuietMonth | null
- freshAccount(transactions: Transaction[], categories: Category[]): FreshAccount | null
- fileInsights(transactions: Transaction[], categories: Category[], today?: string): FileInsights | null

## Conflicts and later prompts

- bank-label corpus: 31/31 (100%). analytics corpus: 24/24 (100%).
- Decision 1 and decision 33 said one leftover style for the whole ledger, and that categories are not mixed. The latest instruction is a per-category override. A missing flag still follows the ledger. Income still never carries. Decision 37 records that. The original decision sentences for this prompt were not in the message, so 37–39 are the rules that were actually built.
- setKeepsLeftovers still turns a category into a fund and can clear its monthly amount. The Budget page switch does not call it. Switching carry only sets the flag, and the start month if the ledger did not have one yet.
- A merchant rule or an earlier choice still beats the bank label. Vague labels (Other, Uncategorized, Miscellaneous) stay unsorted on purpose.
- sortCharge now accepts optional bankCategory and memo. TransactionAuto.reason, Category.carry, and the category and memo column roles are optional, so older backups still load. An unknown auto source is kept as "none" instead of dropping the row.
- yearCash still lives in totals.ts and was not changed.
- Home shows up to five of the file insights, with the waiting list tucked under "Still waiting on more history." Stopped bills, price increases, and the December/January comparison are in the library and show up in that list when the file can support them. They do not each have their own screen.
- The built-output preview still dies on a missing pglite data file that earlier preview logs already show. The dev app, the typecheck, and the build itself succeeded.
- The app is still named Harbor. No logo change.

## Still not done or not working as well as it could

- A first-time walk imported the demo file into a new checking account: 50 of 53 charges sorted. A second file with Category and Memo columns, into a second account, sorted 4 of 5. Groceries, eating out, rent, and car insurance were checked with the bank's reason. The row labeled Other stayed in Needs a look. Carry on Groceries kept the $400 usual amount, the $90 this-month amount, and all 58 charges.
- The three demo rows that stayed unsorted had no sure keyword and no bank category. That is the same "only when sure" rule as before.
- Grow, the year spreadsheet, and the inside of a single charge were not reopened.
