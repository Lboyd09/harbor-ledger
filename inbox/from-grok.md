# Prompt 3 of 5: Import into accounts, and sort charges automatically

## Commit

[dc11eff](https://github.com/Lboyd09/harbor-ledger/commit/dc11effb32727e5268337bf315302ceba29f0f48) on `main`.

Each bank file belongs to one account. Sure charges get a category on their own. Everything else waits on the import screen with a suggestion ready to accept. The Account screen lists the accounts and can switch leftover style later. Typecheck passed. Lint has 0 errors and the same 7 warnings as before. The new sorting tests and the existing budget tests passed (54 when run directly). `npm test` still stops on the same pre-existing sandbox script failures, so that script never reaches the app tests.

Walked it as a first-time user: finished setup, imported a small file into a new checking account, saw “We sorted 3 of 7 charges for you,” accepted three suggestions, and found Everyday checking at $2,866.50 on Account. Switching to “Carry over what's left” kept the account, the balance, and all seven charges. September still shows Kroger.

## Signatures

- `sortCharge(input: { description: string; amount: number; merchantKey: string; date?: string }, ctx: SortContext): SortedCharge`
- `importNewRows(args: { rows: ImportRow[]; sourceLabel: string; existing: Transaction[]; categories: Category[]; rules: MerchantRule[]; incomeStreams?: IncomeStream[]; accountId?: string | null; createId?: () => string }): { added: Transaction[]; skipped: number; transactions: Transaction[] }`
- `pairAccountTransfers(rows: Transaction[], freshIds: Set<string>, categories: Category[]): Transaction[]`
- `nextAccountId(name: string, usedIds: Iterable<string>): string`
- `createAccount(accounts: Account[], input: { name: string; kind: AccountKind; institution?: string | null }, now?: string): Account | null`
- `accountHasActivity(id: string, transactions: { accountId?: string | null }[], imports: { accountId?: string | null }[]): boolean`
- `accountAcceptsFile(kind: AccountKind): boolean`
- `enteredBalanceAmount(kind: AccountKind, amount: number): number`
- `storedFileBalance(kind: AccountKind, fileAmount: number): number`
- `creditFileSignLooksWrong(kind: AccountKind, fileAmount: number): boolean`
- `upsertFileBalance(balances: BalancePoint[], point: { accountId: string; date: string; amount: number }): BalancePoint[]`
- `endingBalanceFrom(rows: ParsePreviewRow[], columns: DetectedColumn[]): { amount: number; asOf: string } | null`
- `merchantNormalized(description: string): string`
- `matchKeyword(text: string): { slug: string; pattern: string; weak: boolean } | null`
- `suggestCategory(description: string, amount: number, categories: Category[], rules: MerchantRule[], merchantKeyValue: string, history?: SortHistory[], incomeStreams?: IncomeStream[]): SuggestResult`
- Store: `addAccount(input: { name: string; kind: AccountKind; institution?: string | null }): string`
- Store: `updateAccount(id: string, patch: Partial<Pick<Account, "name" | "kind" | "institution">>): void`
- Store: `removeAccount(id: string): boolean`
- Store: `addBalance(accountId: string, amount: number, date?: string): void`
- Store: `importPreview(preview: CsvPreview, flipSign: boolean, accountId?: string | null, balanceAmount?: number | null): ImportResult`

## Conflicts and later prompts

Conflicts with the code:

- Amazon, Walmart, Target, and Costco are weak, so they are no longer given a category on import. That includes the demo sample. They stay as a suggestion.
- `importPreview` has an optional fourth argument, `balanceAmount`, so a corrected card balance is stored as typed and is not flipped again. Callers that leave it off still work.
- “An expense keyword never claims a deposit” is still a refund in that expense category when the keyword is strong. A weak one stays a suggestion and does not set a category. The old refund test needs this.
- A deposit within 5 percent of a paycheck, whose description also says payroll, is likely, not sure, even though the payroll word alone would be sure. A deposit whose words match an income hint is sure even when the amount is far off.
- Older history rows that have no amount still count for either side, so the old “last category you set” test still passes.
- A positive balance on a credit-card file is stored as a negative amount owed. The correction box shows only in that case. A file that is already negative is kept.
- Remove is blocked by charges or by imports. The note always says “This one has imports.”
- The fingerprint text is unchanged. A repeat is skipped for one account only when this import has an account. Rows that still have no account id block every account, the same as before.
- The column map and the sign flip sit under “Something look wrong?” unless parsing reported a problem. The preview table stays visible. The bank-file help starts closed so the account question is first.
- A reload used to invent a second account named after the file, such as “Bank CSV”, even when every row already belonged to the account you chose. It no longer does. An old ledger whose rows have no account still gains one account per bank name.

Left for later prompts:

- The month page and per-month amounts (prompt 4).
- Home, navigation, Grow, and visual polish (prompt 5).
- `categorize-coach`, the month board, and the year page were left as they are.
- Month math, fund math, and the setup steps were not changed, except that import reads the income words, the categories, and the accounts.
- Setup still does not delete an account or a savings plan after it has been saved.
