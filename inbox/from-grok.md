# Prompt 5 reply

## Commit

a79ff24dd1e5e71c70854cedc59b503e85bad683

## Signatures

- topSlices(parts: SlicePart[], n: number): SlicePart[]
- monthSeries(endYm: string, rows?: { ym: string; a?: number; b?: number }[]): MonthPoint[]
- yearOverview(transactions: Transaction[], categories: Category[], year: string): YearOverview
- spanOverview(transactions: Transaction[], categories: Category[], year: string, throughMonth: number): YearOverview
- spendingSlices(transactions: Transaction[], categories: Category[], year: string): SpendingSlice[]
- accountRows(accounts: Account[], balances: BalancePoint[], today: string): AccountRows
- monthGlance(input: { style: BudgetStyle; ym: string; transactions: Transaction[]; categories: Category[]; budgets?: MonthBudget[]; carryStartMonth?: string | null; safeToSpend: number }): MonthGlance
- needsALook(input: { transactions: Transaction[]; categories: Category[]; profile: Profile; ym: string; budgets?: MonthBudget[] }): NeedsALook
- staleLabel(ageDays: number): string
- ProgressRing({ pct: number; label: string; tone?: "primary" | "good" | "warn" | "danger" })
- MiniBars({ months: MiniMonth[]; aLabel: string; bLabel: string; onSelect?: (index: number) => void })
- StackedBar({ parts: StackPart[] })
- Donut({ parts: SlicePart[]; centerLabel: string; onPick?: (part: SlicePart) => void })
- CountUp({ value: number; format: (n: number) => string })
- Delta({ amount: number; goodWhen: "up" | "down"; format: (n: number) => string })
- ShowNumbers({ caption: string; columns: string[]; rows: string[][] })
- EmptyArt({ kind: "home" | "budget" | "funds" | "grow" | "sorting" })
- HomeSwitch()
- HomeDashboard()
- YourMoney({ accounts: Account[]; balances: BalancePoint[]; netWorth: NetWorthPoint[] })
- PlaceMap()
- GrowthArea({ principal: number; years: number; inflation: number; today: boolean; gainTax: number; lively: boolean })
- RothBars({ roth: number; traditional: number; taxNow: string; taxLater: string })
- PayoffRace({ snowMonths: number; avaMonths: number; snowInterest: number; avaInterest: number })
- FillJar gained an optional celebrate flag. Existing pct, negative, and overflow are unchanged.

## Conflicts and later prompts

- yearCash lives in totals.ts, not year.ts. yearOverview calls that function and matches it. The Home headline uses spanOverview: January through the month you are on, compared with those same months last year. A full calendar year still matches yearCash when throughMonth is 12.
- The Year page cannot open on one category from an address, so tapping a spending slice shows the amount on Home instead of jumping there.
- Import does not read a chosen account from the address. Add a file opens Import, and the person picks the account. The wizard still remembers the last one.
- Decision 23 said Home would not change yet. This prompt replaces that. Home is the dashboard. The month is /month, still under the Home tab. There is no sixth tab.
- Meadow and Midnight were added. Harbor, Tide, Brass, and Dusk stay. Dusk is still a dark look, as this prompt asked for midnight in addition, not instead.
- Put it to work and the monthly picture hide their inputs under Change the numbers. Loan, inflation, double, how long to reach a number, lump plus monthly, and save for a goal still show the older forms. Nerd tools stay hidden until asked for.
- Prompts 3 and 4 were already on main (import-review, auto-sort, month page, sorting). Their math and the Month page internals were left alone, aside from the Home | Month switch at the top of the month.

## Still not done or not working as well as it could

- Grow is picture-first for where money can go, the lump-sum paths, the monthly line, Roth versus traditional, the IRA limit, the emergency cushion, and the two payoff orders. The rest of the calculators are still forms.
- A slice on Home does not open that category on the Year page.
- Add a file from an account row does not preselect that account.
- Chart colors were chosen to stay readable on all six looks, but there was no automated contrast pass on every slice.
- The sparkle when a goal is reached or a carry-over category finishes under its amount plays once and is easy to miss. Start-fresh rows do not sparkle.
- Onboarding, import sorting, account editing, and the inside of the Month page are whatever the earlier prompts shipped. This pass did not reopen them.
