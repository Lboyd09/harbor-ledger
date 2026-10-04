# Prompt 4 of 5: The Month page, and categories that change by default or for one month

## Commit

[fcc0db3](https://github.com/Lboyd09/harbor-ledger/commit/fcc0db3fe648c667220cc76fe315eda0a15e8fdc) on `main`.

The Month page is its own page at /month. A name has one default category for money in and one for money out. On the Month page a change can be this charge, this month, or the default, and it says what it will do before it applies. Undo puts it back. A category amount can change for one month and go back to the usual amount. Sorting is where the default is changed, and charges set by hand stay as they are. Typecheck passed. Lint has 0 errors and 4 warnings (the 3 unused-code warnings in the old month board are gone). The new sorting tests and the existing budget tests passed. `npm test` still stops on the same pre-existing sandbox script failures, so that script never reaches the app tests.

Walked it in both styles. On the Month page, one Amazon charge was changed for that charge only, then for March only, then as the default, and each one was undone. The sentence showed first, including how many charges set by hand would stay. A Groceries amount was saved for March and put back. On Sorting, a default change said how many hand-set charges would stay, then Back to default cleared the one set by hand. Carry-over on that month showed what came in, what the month adds, what was spent, and what is left. Home still starts with Safe to spend, Funds, and Look back.

## Signatures

- `sideOf(t: Pick<Transaction, "amount" | "status">): "in" | "out"`
- `previewChange(input: { transactions: Transaction[]; merchantKey: string; side: "in" | "out"; ym?: string; categoryId: string | null; scope: "charge" | "month" | "default"; id?: string; includePinned?: boolean; merchantRules?: MerchantRule[] }): { changes: number; keptByHand: number; skippedDivided: number }`
- `applyChange(input: ChangeInput): { transactions: Transaction[]; merchantRules: MerchantRule[]; before: RowBefore[]; rulesBefore: MerchantRule[] | null; preview: ChangePreview }`
- `restoreChanges(transactions: Transaction[], before: RowBefore[]): Transaction[]`
- `resetToDefault(t: Transaction, rules: MerchantRule[]): Transaction`
- `ruleFor(rules: MerchantRule[], merchantKey: string, side: "in" | "out"): MerchantRule | undefined`
- `captureRow(t: Transaction): RowBefore`
- Store: `setCategoryScoped(id: string, categoryId: string | null, scope: "charge" | "month" | "default"): CategoryUndo | null`
- Store: `setMerchantDefault(merchantKey: string, side: "in" | "out", categoryId: string | null, options?: { includePinned?: boolean }): CategoryUndo`
- Store: `resetChargeToDefault(id: string): CategoryUndo | null`
- Store: `restoreCategories(undo: CategoryUndo): void`

`CategoryUndo` is `{ rows: RowBefore[]; rules: MerchantRule[] | null }`. `RowBefore` keeps the category, whether the person set it, the pin, the split, and the import note.

## Conflicts and later prompts

Conflicts with the code:

- A single charge needs an id. `previewChange` and `applyChange` take an optional `id`. The prompt's list did not include it.
- `setTransactionCategory` and `setMerchantCategory` still do what they did for the import review and the coach. They do not set the pin. "Do this for every" still overwrites hand-set rows and clears a split. The Month page and Sorting use the new actions, which leave pinned rows alone.
- A month change skips a divided charge and counts it. A default change updates the overall category and leaves the pieces, so that month still follows the pieces.
- Undo of a default also puts the merchant rule back. `restoreChanges` only restores rows. The store keeps the old rule list on the undo and writes it back.
- Carry-over numbers show from the month carry-over started. Earlier months still show spent of the usual amount.
- A category tied to a fund still cannot take a one-month amount. `setMonthPlan` already refuses, and the card says it is a fund.
- The coach still walks every uncategorized charge, not only the month named on the card. The coach was left alone.
- Home still shows the Month page under Safe to spend, because Home is the safe-to-spend block plus the Month page. The year strip, the three summary cards, and the search box are not on the new Month page. The top of Home is unchanged.
- One hand-set charge reads "stays" rather than "stay".

Left for later prompts:

- Home as a year dashboard, navigation, Grow visuals, and polish (prompt 5). The Settings link still says Merchants.
- The import review's "every one of these" path still uses the old overwrite.
- The coach is still the old one-at-a-time flow.
