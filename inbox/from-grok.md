# Prompt 2 of 5: Onboarding rewrite

## Commit

[e74e1da](https://github.com/Lboyd09/harbor-ledger/commit/e74e1da41b3204c50a35ba227c2eda37c521fed0) on `main`.

Setup is one path of seven steps. The welcome screen has one start button. There is no bank-file path in setup. Typecheck passed. Lint has 0 errors and the same 7 warnings as before. The new plan tests passed (24 with the existing budget tests). `npm test` still stops on the same 11 pre-existing sandbox script failures, so that script never reaches the app tests. Those were run directly.

Walked it in the browser as a first-time user: Step 1 of 7 through Step 7 of 7, no bank file asked, no jargon, housing amount kept, income total shown, style required before continuing, accounts and a savings plan saved, then reopening setup showed the paycheck, the style, the balance, and the savings plan already filled in.

## Signatures

- `answersToProfile(answers: SetupAnswers, options?: { today?: string }): SetupProfileFields`
- `suggestedCategorySlugs(answers: SetupAnswers): string[]`
- `selectedSlugs(answers: SetupAnswers): string[]`
- `suggestAmounts(answers: SetupAnswers, expectedMonthlyIncome: number): Record<string, number>`
- `fitToIncome(amounts: Record<string, number>, income: number): Record<string, number>`
- `savingsPlanMonthly(target: number, by: string | null, startMonth: string): number | null`
- `customSlug(name: string, taken: string[]): string`
- `categoryHint(slug: string): string`
- `categoryLabel(slug: string, housing: Housing, splitDining: boolean): string`
- `blankAnswers(): SetupAnswers`
- `buildSetup(answers: SetupAnswers, base?: Profile, options?: { today?: string }): { profile: Profile; categories: Category[]; extras: SetupExtras }`
- `mergeAccounts(existing: Account[], incoming: Account[]): Account[]`
- `mergeBalances(existing: BalancePoint[], incoming: BalancePoint[]): BalancePoint[]`
- `mergeSavingsPlans(existing: MoneyBucket[], incoming: MoneyBucket[], activeMonth: string): MoneyBucket[]`
- `applyCompleteSetup(state: LedgerSnapshot, profile: Profile, categories: Category[], extras?: SetupExtras): LedgerSnapshot`
- `answersFromLedger(input: { profile: Profile; categories: Category[]; accounts: Account[]; balances: BalancePoint[]; moneyBuckets: MoneyBucket[] }): SetupAnswers`
- `householdSentence(answers: SetupAnswers): string`
- Store: `completeSetup(profile: Profile, categories: Category[], extras?: SetupExtras): void`

## Conflicts and later prompts

Conflicts with the code:

- "I have kids at home" is not a household value. It sets `dependents`. Household stays `single` unless the ledger was already partnered or married.
- "Working" is stored as `early-career`. An existing `established` or `parent` stage is kept.
- "I use public transit" is saved on the profile, but the category list already includes transport with or without a car. Gas is added only when they have a car.
- "I'm saving up for something" adds the `purchase` goal (and keeps `save` if it was already there). That is what turns on the savings category.
- Saying "I'm not sure yet" saves no income streams. The next hydrate still turns an empty list into a $0 Paycheck, because that is what `normalizeProfile` already does.
- Removing an account or a savings plan on a later pass does not delete one already saved. `completeSetup` only merges by id, so a second run does not duplicate. Remove before the first finish does not save it.
- Setup edits one savings plan. Any others already in the ledger are left alone.
- A credit card balance is stored as a negative amount owed, so the total does not treat debt as cash.
- The step number is not restored if they reload mid-setup. Saving a step would be a new profile field.
- The style step says it can be changed in Account. That control is not on the Account screen yet. `setBudgetStyle` is already there. Account screens were left alone.
- A signed-in person with an empty ledger still starts on step 1, not the welcome screen. That matches the old signed-in path.
- `fund-wizard.tsx` was not reused. It says Fund, links a category, and saves immediately. Setup uses a small savings-plan section instead.
- Presets still add "Transfers in" and "Other income" beside the sources they named.

Left for later prompts:

- Import, per-account files, and auto-categorization (prompt 3). "Add my bank file now" only opens the existing import screen.
- Month page and per-month amount changes (prompt 4). Setup writes the usual monthly amount only.
- Home, navigation, Grow, and the Account control for the style (prompt 5).
- Deleting an account or a savings plan from setup after it has been saved.
- A wording sweep. Other screens still say Fund.
