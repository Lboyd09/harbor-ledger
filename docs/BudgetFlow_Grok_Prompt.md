# BudgetFlow: work order for Grok (autonomous coding agent)

You are working inside the BudgetFlow repo (`harbor-ledger`) on Liam's machine. This file is your whole brief. It was written from a full review of `main` at commit `a194b57` (after PRs #8 and #9). Line numbers below are at `a194b57`, so search for the quoted text if a line has moved. Task IDs like **#214** are Liam's master-list numbers. Keep them in branch names and commit messages.

---

## 0. Start here: the understanding gate (do this before any code)

1. **Read this WHOLE file, top to bottom, before you change anything.** Then read `AGENTS.md`.
2. Create `docs/grok-progress.md` with three sections:
   - **(a) Rules, in your own words:** the hard rules (section 2) restated as **at most 12 bullets**. The deploy rule must be one of them, word for word: "Never write `[deploy]` in a commit message, except the single final deploy commit."
   - **(b) Checklist:** one row for **every task ID** in this file (0.1 … 8.8) **and every master-list ID** (#13 … #265) mentioned anywhere in this file, including the "Verify only" and "Later / backlog" lists and the Decisions table. Each row starts `[ ]`. Format: `- [ ] 1.1 · #214 #83 #167 #168 #131 · Debt calculator must not change net worth`. Master-list IDs that only appear inside another task can share that task's row, but every ID must appear somewhere in the checklist.
   - **(c) Questions and contradictions:** anything in this brief that is unclear or contradicts the code, AGENTS.md or itself. Write "none" if there are none. Don't stop to ask; pick the safest reading, note it, and go on.
3. Commit `docs/grok-progress.md` with Phase 0 (see the Phase 0 commit).
4. **Keep it current.** After each task, tick its row and add the status and the commit hash: `- [x] 1.1 · … · Done (a1b2c3d)`. Allowed final statuses: **Done (commit hash)**, **Verified already fixed (how you checked)**, **Waiting on Liam (D-number)**, **Backlog**. Commit the progress file together with the work it records.
5. **If your context gets tight, or a new session starts:** re-read this file and `docs/grok-progress.md`, run `git log --oneline -20` and `git status`, and continue from the **first unchecked row**. Never redo a ticked task. The work must be resumable at any point.

---

## 1. Role and goal

You are the engineer for **BudgetFlow**, a private budget app. People download a CSV from their bank, import it, and BudgetFlow shows what's safe to spend, where money went, and simple plans. There is no bank login. Stack: TanStack Start + TanStack Router, React 19, Vite 8, TypeScript, Tailwind 4, Zustand, Better Auth, Kysely + `pg` on **Supabase Postgres**, deployed on Vercel.

The users are **not technical**. Many use **large text on a phone** (test at 390px and 465px wide with the browser font at 150%).

North star: **the numbers and charts lead, the text is minimal, and every number agrees across every screen.** If two screens show the same idea (net worth, cushion, left, debts, retirement saved), they must show the same figure, from one function, with the same label.

---

## 2. Hard rules (break none of these)

1. **Read `AGENTS.md` first and follow it**, except where rule 13 below corrects it. Also skim `DECISIONS.md` (it's partly stale; see #211). `README.md` and `DECISIONS.md` still describe the old five tabs. The live navigation is `src/components/app-shell.tsx`.
2. **Money math lives in `src/lib/budget/`** in plain functions, never inside components. Every money-math change gets a unit test in `src/lib/budget/*.test.ts`. Round to cents only for display (`formatMoney` in `money.ts`). `simulatePayoff` rounds each month's interest to the cent on purpose. Don't round a running balance anywhere else.
3. **A blank box means "missing", never $0.** Use `readNumber` from `src/lib/budget/calc-input.ts` (`readNumber("")` → `null`, `readNumber("0")` → `0`). A blank required box shows a prompt ("Add the extra payment") or is treated as not entered. A typed 0 stays 0. Never write `Number(x) || 0` for a user input.
4. **Never rename** the storage keys (`harbor-ledger-v3`, `harbor-ledger-v2`, `harbor-fund-*`), existing migrations, the `HARBOR_FROM_EMAIL` env var, the `HARBOR-XXXX-XXXX` backup-code parsing, the repo name or the URL (`harbor-ledger-nine.vercel.app`). Internal identifiers that start with `harbor`/`Harbor` (for example the `HarborLook` type, `HarborMark`, the `"harbor"` theme id) stay too. Only user-visible text changes.
5. **No destructive data changes.** Don't delete or rewrite users' saved data. New fields on persisted types must be **optional**, with a default in `src/lib/budget/normalize.ts`, so old saved budgets still load. **Pre-approved:** adding optional fields and new optional settings. **Not approved without Liam (ask first):** removing or renaming a persisted field, new database tables or migrations, changing the signed-in payload format, or deleting a feature.
6. **Git: one short-lived branch per phase, then into `main`.** Make a branch per phase (or per part where a phase is split): `phase-1-numbers`, `phase-3a-text-plan`, etc. Commit there. When that phase's checks (rule 7) all pass, fast-forward or merge it into `main` (`git checkout main && git pull --ff-only && git merge --ff-only <branch>`, or `git merge --no-ff <branch>` if a fast-forward isn't possible) and `git push origin main`. Then delete the branch. Never push `main` with a failing check. Never force-push `main` or rewrite its history. No pull requests are needed; the commit and merge messages are the record.
6a. **DEPLOY RULE (most important).** Production deploys only when a commit on `main` has the text `[deploy]` in its message. **Never write `[deploy]` in any commit or merge message, except the single final deploy commit** (section 7). Not in examples, not in quotes, not in squash messages. Every other push to `main` is built-and-skipped, which is expected. You don't run `vercel`, don't need Vercel access, and don't touch Vercel settings. Production builds run database migrations, so don't add migrations in this run (rule 5).
7. **Before finishing each phase, all of these pass** (use Node 22: `node -v` must print v22.x):
   - `npm run typecheck`
   - `npm run lint` (no new warnings; see #245)
   - The app tests: `node --experimental-strip-types --test src/lib/**/*.test.ts` (or the file list in the `test` script of `package.json`). **New test files must also be added to the `test` script's file list**, because that script names each file.
   - `npx vite build` (through `node scripts/with-app-env.mjs vite build` if env is needed).
   - **Caveat:** `npm test` currently fails because its first half (`node --test 'scripts/**/*.test.mjs'`) runs 15 template-script tests that need missing `.grok/skills/og/*` and app-env files. That failure existed before (`c1bd399`) and is not yours, unless you're doing #207. Report it; don't hide it.
   - **Don't run `npm run build` locally.** It runs `npm run db:migrate` against the database after the build.
8. **Don't add dependencies** unless there's no reasonable way without one. If you must, say why in the commit message. Radix UI, Recharts, Zod and Playwright are already installed.
9. **Reference numbers must keep passing** (they're in the existing tests; don't change the expected values):
   - Debt payoff, Visa $1,240 @ 24.99% + student loan $18,500 @ 5.5% with $150 extra: **47 months, $2,337.61 interest** (`debt-payoff.test.ts`).
   - Put it to work: **$17,586.55** before tax / **$16,261.22** after tax (`lump.test.ts`).
   - Roth vs traditional, $7,500 a year for 10 years: **Roth $80,826.22 / traditional $91,188.56** (traditional before tax $103,623.36) (`roth-math.test.ts`).
   - Retirement, age 29→67, $18,300 saved, $500/mo, 7%, 2.5% inflation: **$1,389,856.19** future dollars, **$543,829.77** today's dollars (`calc-input.test.ts`).
   - Mortgage $300K @ 6.5% for 30 years: **$1,896.20/mo** (`calc-input.test.ts`).
   - When work is optional: **11.80 / 16.33 / 11.27 years** (`work-optional.test.ts`).
   - Loan term 5.5 years = **66 months** (not rounded to 6 years).
   - `formatMoney(-1234.56)` → **"-$1,234.56"**.
   - Every other expected value in the existing tests.
10. **User-visible wording:** short sentences, plain words, at most 8 words for a helper line. The four areas are **Today, Budget, Money, Plan**, plus **Settings** (gear). Call the user's data "your budget" (not "ledger" or "file") and a CSV "bank file". No developer words on screen (env-var names, "Resend", "seed", "payload").
11. **Accessibility:** tap targets at least 44px, text contrast at least 4.5:1, every control reachable by keyboard with a visible focus ring, and anything pressable looks like a button.
12. **Don't touch production data, secrets or `.env` files.** Don't print secrets. Use the local dev server (`npm run dev`, port 8080) and the sample budget for manual checks.
13. **Corrections to AGENTS.md** (fix the file in task #244; until then, follow these):
    - The database is **Supabase Postgres** (transaction pooler; `DATABASE_URL` uses `sslmode=require&uselibpqcompat=true`), **not Neon**. With no `DATABASE_URL`, the app uses in-memory PGLite.
    - **Pushing to `main` deploys ONLY when the commit message contains `[deploy]`** (a Vercel Ignored Build Step skips every other build). AGENTS.md's "Every push to `main` goes live in production" is wrong.
    - AGENTS.md's "Never commit straight to `main`" doesn't apply to this run. Rule 6 replaces it: commit on a phase branch, then merge into `main` and push once the checks pass.
    - AGENTS.md's "Done" says `npm run build` must pass. Use `npx vite build` instead (rule 7), because `npm run build` also migrates the database.
    - AGENTS.md says to "ask first" for big changes (more than ~10 files, page redesigns, storage changes). **This brief is Liam's approval for Phases 0–7 as written.** Still split big phases into the parts listed, put the plan in the phase's merge message, and still stop at anything marked **ask Liam first**.
    - AGENTS.md's "one task per session" becomes **one phase per branch** for this run, and the run can span several sessions (section 0, step 5).
    - Use the helper agents in `.grok/agents/` as AGENTS.md allows: run `math-checker` on any phase that changes money math (Phases 1 and 4), and `reviewer` on each phase's diff (`git diff main...<branch>`) before you merge it.

---

## 3. Workflow (repeat for every phase)

1. `git checkout main && git pull --ff-only`, then `git checkout -b <phase-branch>`. Each phase starts from `main` with every earlier phase already merged.
2. **Plan briefly** (5–15 lines): which tasks, which files, which tests. Write it in `docs/grok-progress.md` under the phase, and reuse it in the merge message.
3. **Implement** task by task, in the order listed. Commit per task or small group: `fix(#214): keep calculator debts out of net worth`.
4. **Add or extend tests** for every logic change (see each task's "Accept" line). Prefer pure functions in `src/lib/budget/` that the component calls.
5. **Verify** with rule 7's checks, plus a quick manual pass in `npm run dev` on the screens you touched, at desktop width and at 465px with 150% text.
6. **Merge and push:** when every check passes, merge the branch into `main` with a message that works as the old PR description: the first line is `Phase N: <title> (#IDs)`, and the body lists what changed and why (by task ID), tests added, checks run with results, what to check by hand, anything left open, and "Decisions taken (default)". Push `main`. **No `[deploy]` anywhere in it.** Update `docs/grok-progress.md` with the commit hashes (in a follow-up commit if needed).
7. **Go on to the next phase** without waiting. Don't stop to ask anything. Tasks marked **DECISION · ask Liam first** get the status "Waiting on Liam (Dn)" in the progress file and are not built. For any other **DECISION**, build the stated default and list it in the merge message under "Decisions taken (default)".
8. If a task turns out to be **already fixed**, don't change code. Mark it "Verified already fixed (how)" in the progress file and move on. If a task is blocked, write down why in the progress file and continue with the rest. A blocked task must end up as Done, Waiting on Liam or Backlog (with the reason) before the deploy commit.

Task format below: **ID · title**, then **What** (the problem in plain words), **Where** (files), **Change** (exactly what to do), **Accept** (how to check it's done).

---

## 4. Phases

### Phase 0 · Baseline and housekeeping (branch `phase-0-baseline`, small)

**0.1 · Verify the baseline.** Run rule 7's checks on clean `main`. Record the results (app tests were 264/264 passing at `a194b57`; eslint had 0 errors and 11 warnings; `npm test` failed only in the template-script half). If anything else fails, stop and report.

**0.0 · Understanding gate.** Create `docs/grok-progress.md` as in section 0 and commit it in Phase 0.

**0.2 · #244 · Fix AGENTS.md.**
- **Where:** `AGENTS.md`. Keep the "Current work order: docs/BudgetFlow_Grok_Prompt.md" pointer near the top.
- **Change:** (a) The Stack line "Postgres: Neon when `DATABASE_URL` is set…" → "Postgres: Supabase (transaction pooler) when `DATABASE_URL` is set, otherwise in-memory PGLite". (b) The first paragraph's "Every push to `main` goes live in production." → "Pushes to `main` build and deploy to production only when the commit message contains the deploy tag (a Vercel Ignored Build Step skips all other builds). Only add that tag when told to." (Write the tag as "the deploy tag" in AGENTS.md, not literally, so no copied text can trigger a deploy.) (f) In Workflow, "Never commit straight to `main`" → "Work on a short-lived branch, then merge into `main` and push when typecheck, lint, the app tests and `npx vite build` pass." (g) Add "A production build runs `npm run build`, which runs database migrations. Don't add migrations without Liam's OK." (c) Under Commands → Build, add: "`npm run build` also runs `db:migrate`. To check that the app builds, use `npx vite build`." (d) In "Done", replace `npm run build` with `npx vite build`. (e) Under Test, add the note that the `scripts/**/*.test.mjs` half needs `.grok/skills/og/*` and app-env files and fails without them (until #207 is done), and that new test files must be added to the `test` script.
- **Accept:** AGENTS.md no longer says Neon, describes the deploy-tag rule correctly, allows merging to `main` after checks, and says how to build without migrating. `grep -c '\[deploy\]' AGENTS.md` is 0.

**0.3 · #245 · Clear the 11 eslint warnings.**
- **Where:** the unused `Stat` and `planIncomeUser` variables, one unused `eslint-disable` comment, and 8 `react-refresh/only-export-components` warnings (run `npm run lint` to list them).
- **Change:** remove the unused code and the stale disable comment. For the fast-refresh warnings, move non-component exports into a sibling `.ts` file when it's trivial; otherwise leave them and list them.
- **Accept:** `npm run lint` shows 0 errors and fewer than 11 warnings (ideally 0). No behaviour change.

**0.4 · #207 · Make `npm test` run cleanly.**
- **Where:** `package.json` `test` script, `scripts/**/*.test.mjs`.
- **Change:** don't delete the template tests. Make them skip themselves, with a clear "skipped: missing .grok/skills/og" message, when their fixtures are absent, so `npm test` reaches the app tests. Or split the script into `test:app` (the `src/lib` files) and `test:scripts`, and make `test` run `test:app` and then `test:scripts` only when the fixtures exist.
- **Accept:** on a clean checkout, `npm test` exits 0 and runs all 264+ app tests; the template tests run when their fixtures are present.

---

### Phase 1 · Data integrity and wrong numbers (branch `phase-1-numbers`; split into 1a, 1.1–1.5, and 1b, 1.6–1.14, if it passes ~10 files)

Run `math-checker` on this phase.

**1.1 · #214 (with what's left of #83, #167, #168, #131) · The Debt calculator must not change saved accounts or net worth. Highest priority.**
- **What:** Plan → Pay off debt writes to the same `debts` list that Money subtracts from net worth, and it pre-fills the credit-card total. So saving a card there subtracts it twice: the card is already a negative account balance. Live, net worth fell from $38,940 to $24,200 after using the calculator. Removing a debt in the calculator also changes Money. Typed debts also leak into Put it to work's debt note ("Your Visa charges…"), and there's no "Reset to my accounts".
- **Where:** `src/components/grow/debt.tsx` (the pre-fill effect at lines ~25–29 and add/remove), `src/components/grow/session.tsx` (where `g.debts` comes from), `src/store/budget-store.ts` (`addDebt`/`updateDebt`/`removeDebt`, ~866–884), `src/lib/budget/types.ts` (`DebtItem`), `src/lib/budget/normalize.ts`, `src/lib/budget/picture.ts` (`moneyPicture`), `src/components/account-board.tsx` ("Add a loan" on Money), `src/components/grow/put-to-work.tsx` (debt note).
- **Change:**
  1. Add an optional `origin?: "money" | "plan"` to `DebtItem`. Money's "Add a loan" sets `"money"`. The Debt calculator never writes to the stored `debts` list. It keeps its own working list in the Plan session state (`session.tsx`), or, if it must persist, in a separate optional `planDebts?: DebtItem[]` field (pre-approved: an optional field).
  2. The Debt calculator **starts from** your real debts: every credit-card account with a balance below 0 (balance = −amount, with the rate and minimum typed in the calculator), plus every Money loan (`origin` missing or `"money"`), plus loan accounts (#1.2). Each pre-filled row has a small "from your accounts" chip. Edits and removals change only the calculator's working copy.
  3. Add a **"Reset to my accounts"** button that rebuilds the working list from the accounts.
  4. `moneyPicture` subtracts only debts that aren't already an account balance: Money loans plus loan-type accounts. It never subtracts calculator debts.
  5. **Old data (DECISION, default):** for stored debts with no `origin`, treat them as Money loans **unless** one matches a credit-card account (same name, case-insensitive, or a balance within $1 of that card's owed amount). Treat a matching debt as a calculator copy: don't subtract it, and show it only in the calculator. Never delete stored data.
  6. Put it to work's debt note reads from the same "real debts" function, never from calculator-only debts.
- **Accept:** a new test in `picture.test.ts`: accounts Checking +$5,000 and Visa (credit) −$1,240 give net **$3,760**. Adding a Visa $1,240 debt from the calculator keeps net **$3,760** (today it becomes $2,520). A legacy stored debt `{name:"Visa", balance:1240}` with no `origin` also keeps $3,760. A Money loan of $5,000 makes it $−1,240. Manually: open Plan → Pay off debt, add and remove debts, and Money's net worth doesn't move. "Reset to my accounts" restores the pre-fill. Debt reference test still 47 months / $2,337.61.

**1.2 · #225 (with what's left of #33, #136, #84, #85, #167, #169, #81) · One calculation for all of Money's totals; loan accounts count as debts.**
- **What:** Money's top line says "Debts −$6,240", but the Accounts list has a Car loan at −$9,800, and the note says "Loans of $5,000 are subtracted". A negative "Other" account counts in Net but not in Debts. Retirement shows $36,900 on Money but $43,850 on Plan, because Plan's "Saved so far" adds Brokerage. The old "$5,100 last snapshot" sits next to "+$38,940".
- **Where:** `src/lib/budget/picture.ts`, `src/lib/budget/accounts.ts` (account kinds and groups), `src/components/funds-view.tsx` (line ~87 summary), `src/components/account-board.tsx` (line ~112 note), `src/components/grow-pictures.tsx` (line ~43 snapshot), `src/components/grow/worth.tsx` (line ~25), `src/components/retirement-card.tsx` ("Saved so far"), `src/components/home-dashboard.tsx` (Net worth tile).
- **Change:**
  1. Add loan account kinds `car_loan`, `student_loan`, `mortgage`, `personal_loan` to the account-kind list, grouped under **Debts** (a new value in an optional enum is pre-approved; `normalize.ts` must accept it). Any account whose kind is a loan, **or** any "other" account with a negative balance, counts in **Debts**.
  2. `moneyPicture` returns `{ cash, brokerage, retirement, debts (positive amount owed: cards + loan accounts + Money loans), net }`, with `net = cash + brokerage + retirement − debts`, and it's the only place these are added up. Money's top line, the Accounts note, Today's Net worth tile, Plan → Net worth and the Retirement page all read from it.
  3. Show Money's top line as 5 number tiles: Cash · Brokerage · Retirement · Debts · Net worth. Each tile opens the accounts behind it (#173).
  4. **Retirement totals (DECISION, default):** the Retirement calculator's starting balance stays retirement + brokerage, but its label becomes **"Invested so far (retirement + brokerage)"**, and a ⓘ shows the split ("Retirement $36,900 + Brokerage $6,950"). Money keeps the separate tiles.
  5. The typed net-worth snapshot only shows in the Net worth history chart, never next to the live figure. When the newest snapshot is more than 30 days old, show "Save today's net worth" (one tap saves the live figure as a snapshot).
- **Accept:** a test in `picture.test.ts`: Checking 5,000, Savings 6,130, Visa −1,240, Car loan (other) −9,800, Roth 36,900, Brokerage 6,950, and a Money loan Student 18,500 give **cash 11,130**, **debts 29,540** and **net 25,440**. On Money, Debts equals the sum of debt rows in Accounts, and Net equals what Today and Plan show. The Retirement page and Money show the same split, and the label says what's included. No "$5,100" next to the live net worth.

**1.3 · #223 (with what's left of #61) · Safe to spend and Budget's "Left" must agree or explain the difference.**
- **What:** Live: Today says Safe to spend **−$2,565**, while Budget says Left **−$590.88**, with no explanation. Safe to spend = income so far − this month's planned spending (the full plan, even what isn't spent yet) − overspending − money for funds. Left = income − spent − saved.
- **Where:** `src/lib/budget/ledger-month.ts` (`safeFromLedger`, ~line 371; `monthLedger`), `src/lib/budget/buckets.ts` (`safeToSpend`), `src/components/home-dashboard.tsx` (~151–163), `src/components/budget-amounts.tsx` (Left card).
- **Change (DECISION, default):** keep both numbers, but tie them together with one function. Add `safeBreakdown(source, ym)` returning `{ left, stillPlanned, fundsStillToAdd, safe }`, where `stillPlanned` = sum over planned spending categories of max(0, planned − spent), and `safe = left − stillPlanned − fundsStillToAdd`. Today's ⓘ "?" shows 3 lines: (for example) "Left now −$590.88 · Still planned −$1,974.12 · Safe to spend −$2,565". Budget's Left card gets a ⓘ: "Safe to spend also holds back what's still planned." If the current formula can't be expressed this way exactly, change `safeFromLedger` so it is, and explain the change in the PR.
- **Accept:** a test in `ledger-month.test.ts`, on the sample budget and on a hand-built month: `safe === left − stillPlanned − fundsStillToAdd` to the cent, and Today's number equals `safe`. The ⓘ text matches the numbers on screen.

**1.4 · #224 (with #64 and part of #189) · Label carried-over overspending, and stop fixed bills from carrying.**
- **What:** "Rent $1,350 of $1,350 — $3,050 over" and "Debt payments $280 of $150 — $970 over". The "over" chip adds overspending carried in from past months, with no label, so a row that's on plan looks over. Rent also showed "+$2,350 under" from carried leftovers.
- **Where:** `src/lib/budget/screen-plan.ts` (`categoryStory`, ~283–297), `src/components/budget-amounts.tsx` (row ~163–165), `src/components/category-panel.tsx`, `src/lib/budget/presets.ts` (preset categories), `src/lib/budget/types.ts` (category carry setting).
- **Change:**
  1. Split the row status into `thisMonth` (planned − spent this month) and `fromEarlier` (the carry-in). The row shows "This month: on plan" (or "$X over" / "$X left"), and when `fromEarlier ≠ 0` adds a second small line "From earlier: −$3,050". The chip never adds the two without saying so.
  2. **(DECISION, default)** Fixed-bill presets (Rent/Mortgage, Insurance, Utilities, Phone/Internet, Debt payments, Subscriptions) default to **start fresh each month** in **new** budgets. For **existing** budgets, don't change the setting silently. If a fixed-bill category carries a balance, show a one-time card: "Rent is a fixed bill. Start fresh each month? [Yes] [Keep]".
- **Accept:** a test in `screen-plan.test.ts`: planned 1,350, spent 1,350, carry-in −3,050 gives `thisMonth` "on plan" and `fromEarlier` −3,050, and the headline doesn't contain "$3,050 over" unless it's labelled "From earlier". A new sample budget's Rent starts fresh.

**1.5 · #65 / #216 / #250 (logic) / #221 / #139 · Leftover suggestions: never while the month is negative, never from savings or debt, one consistent figure.**
- **What:** "Put leftovers to work" suggests moving Savings transfers ($1,500) and Student loan money into Groceries while the month is negative. "Eating out $1,622.33 under" sits next to "Eating out has $758.33 that can move" (two different "left" figures). The box defaults to the Groceries fund.
- **Where:** `src/lib/budget/screen-plan.ts` (`surplusSuggestions`), `src/components/category-panel.tsx` (`LeftoversCard` ~89–110, ~145, ~173, ~293–303), `src/lib/budget/ledger-month.ts`.
- **Change:**
  1. `surplusSuggestions` returns nothing when the month's Left < 0.
  2. Never suggest from categories that are savings transfers, debt payments, or fixed bills, and never suggest moving money **into** an overspent category from savings. Any suggestion that takes money out of savings must say "Trade-off: less saved" (#139).
  3. The "spare" amount is the same "left" figure the row shows. If carry-over makes them differ, show "includes $X from earlier".
  4. The target fund defaults to a fund marked as the cushion (task 4.5), or one whose name contains emergency/cushion/rainy, or else **no choice**. Never Groceries.
  5. Show at most one suggestion block per screen.
- **Accept:** tests in `screen-plan.test.ts`: Left −$590.88 gives no suggestions; Left > 0 never suggests Savings transfers or Student loan; the spare amount equals the row's left. Manually: the sample month shows no "Put leftovers to work" while it's negative.

**1.6 · #229 (and what's left of #26) · Blank boxes must not count as 0.**
- **What:** Several calculator boxes use `Number(x) || 0`, so a blank box silently becomes $0.
- **Where:** `src/components/grow/debt.tsx:30` (Extra payment), `src/components/grow/double.tsx:50–55, 117–131` (Already saved, Add each month, rate, target), `src/components/grow/session.tsx:132–144`, `src/components/grow/inflation.tsx:30–32`, `src/components/grow/goal.tsx:34–36`, `src/components/grow/loan.tsx` (extra), `src/components/fund-wizard.tsx:74,101,118`, `src/components/funds-view.tsx:310`, `src/components/onboarding.tsx:439,453,549,734,745,827,882`, `src/components/settings-view.tsx:248`.
- **Change:** replace each with `readNumber`. Where the box is optional and 0 is a sensible meaning (Debt extra, Already saved, Add each month, Loan extra), show the placeholder "0" and treat blank as 0 **explicitly**, through a named helper `optionalAmount(readNumber(x))` with a comment. Where the box is required (rate, target, years, price), a blank shows the prompt and no result. In onboarding and the fund wizard, a blank must not save as 0. Leave it unset.
- **Accept:** a test in `calc-input.test.ts` for `optionalAmount` (`""`→0 marked "assumed", `"0"`→0, `"abc"`→invalid). `rg "Number\([^)]*\) \|\| 0" src/components` returns nothing for user inputs. Manually: Reach a number with a blank target shows "Add a target", not a result. Debt with a blank extra shows the same result as 0, with "0" as the placeholder.

**1.7 · #227 · Today's weekly line.**
- **What:** "About −$641.25 this week, through Friday" is the monthly figure ÷ 4, and it can be negative.
- **Where:** `src/components/home-dashboard.tsx:105, 162`; put the math in `src/lib/budget/dashboard.ts`.
- **Change:** `weeklySafe(safe, today)`: if safe ≤ 0, return null and hide the line. Otherwise divide by the weeks left in the month (days left ÷ 7, at least 1) and show "≈ $X a week until month end".
- **Accept:** a test: safe −2,565 gives null; safe 700 with 14 days left gives 350. The words "through Friday" are gone.

**1.8 · #226 · Fund balance vs category "left".**
- **What:** The Groceries fund shows −$780.73 on Money while Budget shows $239.27 left, with no labels.
- **Where:** `src/components/funds-view.tsx` (~280), `src/components/budget-amounts.tsx`, `src/components/category-panel.tsx`.
- **Change:** wherever a fund-linked category appears, label the two figures "Fund balance" and "Left this month". On Budget rows for fund-linked categories, show "Left this month" only, with a "Fund: −$780.73" chip linking to the fund. Explain a negative fund balance as "Spent more than saved in this fund."
- **Accept:** no screen shows a fund balance and a category left side by side without these labels.

**1.9 · #178 · Budget "Spent" mismatch.**
- **What:** the top tile says "SPENT $1,820.88", and the sentence says "Spent $1,775.88" ($45 apart, the manual cash entry or a refund).
- **Where:** `src/components/budget-amounts.tsx` (tile and forecast sentence), `src/lib/budget/analytics.ts` (`monthEndForecast`, ~184–188), `src/lib/budget/ledger-month.ts`.
- **Change:** find which figure leaves something out (cash entries, refunds or paybacks) and make both read `monthLedger(...).spent`.
- **Accept:** a test where a manual cash charge of $45 is included in both. On screen, both figures match.

**1.10 · #19 / #58 / #69 · The month-end forecast sentence.**
- **What:** "At this pace the month ends around $9,175.38" is projected **spending**, but it reads like money left. It appeared twice on Budget. "Nothing has gone out yet… ends at $0.00" contradicted the rows.
- **Where:** `src/lib/budget/analytics.ts:184–188`, `src/components/budget-amounts.tsx:213–214`.
- **Change:** rename it to "Spending on pace for $X this month". Show it once. Also show the projected leftover, which is computed but never shown: "On pace to end with $Y left" (or "$Y short"). Drop "Nothing has gone out yet… $0.00". When nothing is spent, show nothing.
- **Accept:** the sentence appears once on Budget and says "spending". Test: projected leftover = expected income − projected spending.

**1.11 · #59 / #241 · "Still coming this month".**
- **What:** It lists August and September dates in October, marked "stopped" or "late", and six small charges total "About $50,499.42 a year".
- **Where:** `src/components/budget-view.tsx:105`, `src/components/budget-transactions.tsx:110–116`, the bill-detection code in `src/lib/budget/` (search for "Still coming", `recurring`, `yearly`).
- **Change:** list only bills expected **from today to month end** that haven't been paid this month. Hide bills marked stopped. Mark paid ones done or drop them. Recompute the yearly estimate as Σ(amount × occurrences per year by cadence), and cap the occurrences: a monthly bill counts 12 times, weekly 52.
- **Accept:** a test with an Oct date: no item dated before today is listed, and stopped items are hidden. Six monthly charges totalling $120 give "About $1,440 a year".

**1.12 · #18 / #161 · One plan total.**
- **What:** There are three plan totals, and one counts parent and child categories twice ("Plan covers 289 percent"; the warning is now red, but the totals can still differ).
- **Where:** `src/lib/budget/screen-plan.ts` (`budgetLead`), `src/lib/budget/planner.ts`, `src/lib/budget/onboarding-plan.ts`, year views.
- **Change:** one exported `planTotal(categories, ym)` that skips parent categories when they have children (or uses the existing `countsTowardPlan` if that's what it does), and is used everywhere a plan total is shown.
- **Accept:** a test with a parent ($500) and two children ($300 + $200) gives $500, not $1,000. `rg` shows one plan-total function used by Budget, setup summary and Year.

**1.13 · #230 · Debt calculator's broken default example.**
- **What:** It opens on "Card $5,000 at 24%" with no minimum and says "never pays off, add at least $1.00".
- **Where:** `src/components/grow/debt.tsx` (default rows, ~25–29, ~51–55), `src/lib/budget/grow-math.ts` (`extraNeeded`, `paymentBelowInterest`).
- **Change:** with no real debts, open empty with "Add a card or loan" (no fake debt). Fix `extraNeeded` when the minimum is 0: it must return at least the first month's interest plus a cent, rounded **up** to the dollar (for $5,000 at 24% that's $101, not $1).
- **Accept:** a test: `extraNeeded([{balance:5000, apr:24, minimum:0}], 0)` ≥ 100.01. Debt opens empty on a budget with no debts.

**1.14 · #71 (data) · Demo leftovers in real budgets.**
- **What:** The Import account picker shows two "Cash" accounts and a "Demo bank file" account. Demo pieces (the "Demo bank file" account, the "Store card $640" debt `debt_demo_card`) can survive into a real budget.
- **Where:** `src/lib/budget/onboarding-plan.ts` (`isDemoLedger`, `applyCompleteSetup`), `src/store/budget-store.ts` (~1129 demo debt), `src/components/import-wizard.tsx` (account picker).
- **Change:** starting your own budget removes demo-only accounts and debts (they're identifiable by their demo ids and the `demo` flag) **only if** they have no user transactions. The import picker never pre-selects "Demo bank file". It pre-selects the only real account, or asks. Merge duplicate empty "Cash" accounts only when both are empty and were auto-created; otherwise leave them.
- **Accept:** a test in `onboarding-plan.test.ts`: after `applyCompleteSetup` from the sample, there's no `debt_demo_card` and no demo account. The import picker default is never a demo account.

---

### Phase 2 · Phone and large-text layout (branch `phase-2-phone`)

Test widths: **390px and 465px**, with the root font size at 150% (in DevTools, set `html { font-size: 150% }`, or use Chrome's font-size setting). Also check 1280px desktop.

**2.1 · #228 (with what's left of #48, #55, #98, #127) · Nothing overflows or hides behind the tab bar.**
- **What:** At ~465px and 150% text, Today's three tiles (Cushion · Saving · Net worth) overflow and Net worth is cut off. The floating "+" covers Budget's Left card. The bottom tab bar plus the "stays on this device" banner cover content, and the tab bar overlaps the page's last items.
- **Where:** `src/components/home-dashboard.tsx` (~128–136 tiles), `src/components/app-shell.tsx` (tab bar, FAB, banner ~211–214), `src/components/budget-amounts.tsx` (Left card), global styles.
- **Change:** tiles use `grid-cols-3` with `min-w-0`, truncate labels, and switch to a 2+1 or stacked layout below ~420px (use a container query or `minmax`). Number text scales down with `clamp()` but never below 1.25rem. The main content gets bottom padding = tab bar height + FAB + safe-area inset (`env(safe-area-inset-bottom)`). The FAB sits above the tab bar, never over a card's number. Also link the Cushion tile to `/grow?q=cushion`, not `/grow`.
- **Accept:** add `scripts/layout-check.mjs` (Playwright is already installed). It loads `/`, `/budget`, `/budget?page=transactions`, `/import`, `/funds`, `/grow?q=retire`, `/grow?q=debt` and `/settings` with the sample budget at 390 and 465 wide and 150% font, and asserts (a) `document.documentElement.scrollWidth <= innerWidth`, (b) no element with `data-money` (add this attribute to the big money numbers) is covered by the tab bar or FAB (`elementFromPoint` at its centre returns itself or a child), (c) every tile's text isn't clipped (`scrollWidth <= clientWidth`). Don't save or commit screenshots. Run it by hand against `npm run dev`; it isn't part of `npm test`.

**2.2 · #60 · The "stays on this device" banner shows once and can be closed.**
- **Where:** `src/components/app-shell.tsx:211–214` (banner) and `:75` (the existing small chip).
- **Change:** show the banner once (the first visit after setup) with a Close button, and remember it under a **new** UI key (for example `budgetflow-ui-banner-closed`; don't touch `harbor-ledger-*`). After that, only the small "On this device · Sign in" chip shows in the header or sidebar. Wording: "Your budget is saved on this device. Sign in to keep it safe."
- **Accept:** after Close and a reload, the banner is gone on every page, and the chip is still there.

**2.3 · #97 · Text-size setting.**
- **Where:** `src/components/settings-view.tsx` (Look section), `src/lib/budget/types.ts` (Profile: optional `textSize?: "normal" | "large" | "xlarge"`), the root layout.
- **Change:** Normal / Large / Extra large, setting the root font size to 100% / 118% / 135%, plus the browser's own zoom. All layout uses rem, so it scales.
- **Accept:** switching to Extra large passes `layout-check.mjs` at 390px.

**2.4 · #99 · Category names aren't cut off, and the category panel isn't a full-screen wall.**
- **What:** "Utilities, phone, int" is cut off. The panel covers the whole phone screen.
- **Where:** `src/components/budget-amounts.tsx` rows, `src/components/category-panel.tsx`.
- **Change:** row names wrap to two lines (`line-clamp-2`), never cut mid-word. On phones, the panel is a bottom sheet (max 85% height) with a visible close button and drag handle. On desktop, it's a side panel.
- **Accept:** "Utilities, phone, internet" shows in full at 390px/150%.

**2.5 · #100 / #103 / #101 · Contrast, tap targets, buttons look pressable.**
- **Where:** global styles (`src/styles*.css` or the Tailwind theme), every `text-muted` hint, "Add a file", "Update balance", "How:" lines.
- **Change:** helper text at least 0.875rem (14px) with ≥ 4.5:1 contrast on both Light and Dark. Every button and link-button has min-height and min-width 44px. "Add a file" and "Update balance" use the button style.
- **Accept:** add a small check to `layout-check.mjs` for the min 44×44 size of `button, a[role=button], [role=tab]`. Manual contrast check of the muted colour on both themes, with the hex values written in the PR.

**2.6 · #233 · "Fine-tune this question" doesn't jump.**
- **What:** The control disappears on Roth, so the layout jumps between questions.
- **Where:** `src/components/grow/frame.tsx`, `src/components/grow/roth.tsx`, `src/components/grow/index.tsx`.
- **Change:** always render the Fine-tune row in the same place. On Roth, show it disabled with "Nothing to fine-tune", or move Roth's rate inputs into it so it has content (preferred).
- **Accept:** switching between Plan questions doesn't move the result block's vertical position at 465px.

---

### Phase 3 · Text cleanup (three parts, one branch each: `phase-3a-text-plan`, `phase-3b-text-budget`, `phase-3c-text-money-settings`)

AGENTS.md treats more than ~10 files as a big change, so this phase is split. **3a:** the shared parts (X1–X10 below) plus Plan (section 6). **3b:** Today, Budget, Transactions, Year, Sorting (sections 1–3, 8). **3c:** Money, Settings, Import, Setup, Sign-in (sections 4, 5, 7, 9, 10). Text only, plus the small UI pieces needed to hold text behind a tap. **Logic fixes belong to Phase 1** (where this table says "FIX (logic)", do it only if Phase 1 missed it).

**Goal (#129, #255):** prose share (the part of the screen that's sentences) goes from the live levels (Today 25%, Budget 55%, Transactions 45%, Import 50%, Money 40%, Plan/retire 70%, Settings 60%) to about **Today 10%, Budget and Transactions 20%, Import 20%, Money 15%, Plan under 30%, Settings 25%**. **No text block longer than two lines** (#187).

**Phase 3 tasks** (the detail is in the overrides and the per-screen list below):
- **3.1 · #187 / #120 / #247 / #248 / #253 / #43 / #44 / #41 (part 3a) · Shared parts:** InfoTip, Footnote, CalcFrame changes and citations (the "Build these first" list), plus cross-cutting rows X1–X10 (X10 is #246, X8 is #251, X6 is #249, X7 is #250's wording).
- **3.2 · #107 / #111–#119 / #121 / #122 / #184 / #238 / #240 (all parts) · Wording overrides:** apply the "Overrides" list on every screen each part touches.
- **3.3 · #232 (text) / #129 (part 3a) · Plan:** per-screen section 6 (6a–6g).
- **3.4 · #242 / #249 / #74 (text) / #129 (part 3b) · Today, Budget, Transactions, Year, Sorting:** sections 1, 2, 3 and 8.
- **3.5 · #239 / #251 / #252 / #254 (wording) / #129 (part 3c) · Money, Settings, Import, Setup, Sign-in:** sections 4, 5, 7, 9 and 10. #239: Import must not say "The live ledger stays in your BudgetFlow account" (data is on the device until sign-in) or "Totals match Home"; export moves to Settings with one short line.

**Build these first (in 3a):**
1. `src/components/info-tip.tsx`: `<InfoTip text="…" label="What is this?">` is an ⓘ button (44px target, `aria-label`) that opens a Radix Popover (`@radix-ui/react-popover`, already installed). Use it for every "MOVE-i" item.
2. `<Footnote>`: one "Estimates, not advice." line at the bottom of each Plan page (#120).
3. In `src/components/grow/frame.tsx` (`CalcFrame`): Tips become `<details><summary>Tips (n)</summary>`, showing at most one matched tip open by default. Drop the per-tip "general guidance." status tag (#247). The `Field` source tag is optional: no tag for "typed", and a small "↺ from your accounts" chip only when a box was pre-filled (#248, and what's left of #44 and #41). Add a `headline` prop: one big number plus a sub-line above the result sentence (#253, #40, #39). Hide the "Key numbers" heading when there are no numbers (#220; verify it's already done).
4. A "Where these numbers come from" `<details>` at the bottom of each calculator holds citations ("Bengen, Journal of Financial Planning, October 1994", "BudgetFlow planning range…", IRS limits) (#43).
5. "MOVE-adv" means show it only when Settings → Detail is **Advanced** (Simple is the default; see #5.4).
6. "MOVE-help" means move it into a new `/help` route (`src/routes/help.tsx`) with anchors (`#csv`, `#safe-to-spend`, `#cushion`, `#rollover`). The details block stays as a link "How to get your bank file →".

**Overrides to the table below (these win):**
- "Put leftovers to work" is renamed **"Extra money this month"** everywhere (#107). The suggestion row reads "Savings transfers: $1,500 spare → [Move] [Grow it]" (#250).
- The retirement chart heading "A thousand tries" → **"Good years and bad years"**, and its result line → **"In 79 out of 100 possible futures, your money lasts to 95"** (use the real share, rounded to a whole number out of 100) (#111).
- "Left ($670.00)" style labels → **"Money left: −$670"** (#117). "From last month ($142.51)" → **"$142.51 unused from September"** (use the real month name) (#118). "This month only: Same" → **"Just this month: no change"** (#119).
- "Fair guesses are marked Check" → **"Please check these"** (#114). "This one stopped" → **"Looks like this bill stopped"** (#115, and hide stopped bills from "Still coming"; see 1.11). "Needs checking" (as a user-facing tag) → **"Estimate"** (#116). Remove "Spread, points" from the retirement page, or put it in Advanced as "Market swings: ±{s}%" (#112).
- Roth room: "Full amount" → **"You can put in up to $7,500 this year"** (use the real limit from `ira.ts`, and the partial amount when in the phase-out) (#113).
- Rename "Charges" to **"Transactions"** wherever deposits are included (e.g. "94 transactions: 8 deposits, 86 payments") (#122, #72 wording).
- State words, one each (#184): money is **"On track" / "Watch" / "Over"**; sorting is **"Check" / "Waiting"**. Replace "Needs you" (as a status), "Still to sort" and "Sorting rules" (the page title becomes "Sorting").
- Add an ⓘ next to **Safe to spend, Cushion and Roll-over** with a one-line answer and a link to `/help#…` (#121).
- Use the four area names everywhere (#240): "Home" → "Today", "Account" → "Settings", "Funds" → "Money" (or "Goals" for a fund), "Grow" → "Plan". Use "budget" for the user's data, not "ledger" or "file".
- Developer text goes away (#238): every user-visible mention of `RESEND_API_KEY`, `HARBOR_FROM_EMAIL`, "Resend" or "on this host". When mail isn't configured, show "Your link:" with the link, or hide the email feature. Never name env vars on screen.

**The full per-screen list.** Legend: **CUT** = remove. **SHORTEN** = replace with the → text. **MOVE-i** = behind an ⓘ. **MOVE-help** = into `/help`. **MOVE-adv** = Advanced only. **KEEP** = no change. **FIX** = wrong or stale wording that must change.

#### Text 0. Cross-cutting changes (do these first; they remove the most text)

| # | Where | Today | Action |
|---|---|---|---|
| X1 | `app-shell.tsx:211-214` "This budget stays on this device until you sign in." + "Sign in to save" banner, shown on every page | Eats vertical space on every screen, on phones too | **MOVE**: show once (first visit after setup) and remember the Close. After that, use a small "On this device · Sign in" chip in the sidebar or header (one already exists at `app-shell.tsx:75`). |
| X2 | `grow/frame.tsx:81` and `grow/retirement.tsx:23` "Not personal advice." + every tip's "general guidance." suffix (`frame.tsx:73-75`, `retirement.tsx:16-18`) + `retirement-card.tsx:291` "Estimates only, not financial advice." + `funds-view.tsx:229` + `grow-pictures.tsx:197/262/263` "An estimate, not financial advice." | On every calculator, sometimes 3 times | **SHORTEN** to one footer line per page, "Estimates, not advice.", and **CUT** the per-tip status tag. Keep "needs checking" only in the Assumptions details. Remove "An estimate, not financial advice." from inside sentences in `grow-pictures.tsx:197,262,263` and `funds-view.tsx:229`. |
| X3 | Tips block (`frame.tsx:70-79`, `retirement.tsx:13-21`): 3 tips always visible | 3 sentences under every result | **MOVE-i**: collapse into `<details><summary>Tips (3)</summary>` like Assumptions, or show 1 tip only, the matched one, with a "More tips" tap. |
| X4 | Field source tags under every calculator input (`frame.tsx:142` `<span>{tag}</span>`, e.g. "typed", "from your accounts", "shared with other pages", "a common starting point") | One extra line under every box | **SHORTEN** to an icon: no tag for "typed", and a small "↺ from your accounts" chip only when prefilled. **CUT** the "typed" tag entirely. |
| X5 | `retirement-card.tsx` `factNote(...)` lines under each of 10 inputs (`:152,157,162,167,177,187,200,205`) **and** the same source lines again at `:238-242` `assumptions.map` **and** again in the page's Assumptions details (`grow/retirement.tsx:27`) | Source lines print 2–3 times | **CUT** `:238-242`. **MOVE-i** the per-field notes (`factNote`) into one ⓘ per field, or drop them and rely on the Assumptions details. Keep one Assumptions list per page. |
| X6 | "Income is compared with what usually comes in. It does not carry / is not carried" ×4: `category-panel.tsx:283`, `settings-view.tsx:283`, `onboarding.tsx:621`, `onboarding.tsx:634`, plus `budget-amounts.tsx:230` "Nothing rolls into next month." and `budget-amounts.tsx:54` | Same idea 5–6 times | Keep it **once**, in setup step 4 (`onboarding.tsx:621`), shortened. **CUT** the rest (details below). |
| X7 | Leftovers suggestions "X has $N that can move" + "Add $N to …" + "See what it could grow to" (`category-panel.tsx:89-110` `LeftoversCard`, `:145`, `:173`, and per-panel `:293-303`), shown 3 times live | Repeated card. It also suggests moving money while the month is negative (bug) | **SHORTEN** to one row per category: "Savings transfers: $1,500 spare → [Move] [Grow]". Show at most once per screen, and **hide when the month's Left is negative** (logic: Phase 1, task 1.5). |
| X8 | Investment account rows: "Add a return and a monthly amount to estimate growth." + a full inline form on every investment (`account-board.tsx:240` and the form `:370-415`) | Repeats per account | **MOVE**: show the form only after tapping "Estimate growth" on that account. Line `:240` → **SHORTEN** "Estimate growth" as a button label. |
| X9 | Stale names: "Home", "Account", "Funds", "Grow", "ledger" | Confusing after the 4-tab redesign | **FIX** everywhere listed below (marked FIX). Use "budget", not "ledger" or "file", for the user's data everywhere a user sees it. |
| X10 | Page subtitles under every H1: Today `home-dashboard.tsx:125`, Budget `page-menu.tsx:156`, Money `funds-view.tsx:85`, Settings `settings-view.tsx:35` | Each restates the tabs | **CUT** all four. The tabs already say it. |

---

#### Text 1. Today (`src/components/home-dashboard.tsx`)

| file:line | Current | Action → new text |
|---|---|---|
| home-dashboard.tsx:114 | "Add a bank file, or open Budget to set amounts from setup." | SHORTEN → "Add a bank file to see your money." (empty-state CTA; keep the button) |
| home-dashboard.tsx:113 | "Nothing here yet" | KEEP |
| home-dashboard.tsx:125 | "What you can spend, what needs you, and the bills that are coming." | CUT (X10) |
| home-dashboard.tsx:128/133/136 | Labels "Cushion", "Saving", "Net worth" | KEEP. Layout bug: on a 465px phone the 3 cards overflow and Net worth is cut off. Use `grid-cols-3` with `min-w-0` and truncation, or a 2+1 layout. Also link "Cushion" to `/grow?q=cushion`, not `/grow`. |
| home-dashboard.tsx:142 | "This is the sample budget. Starting your own replaces it." | SHORTEN → "Sample budget. Start yours anytime." |
| home-dashboard.tsx:151 | "Safe to spend" | KEEP |
| home-dashboard.tsx:162 | "About {weekly} this week, through Friday." | **FIX**: `weekly = safe/4` is not "this week through Friday", and it shows negative values ("About -$641.25 this week"). → when safe > 0: "≈ {weekly} a week"; when safe ≤ 0: hide the line. |
| home-dashboard.tsx:163 | (ⓘ) "Income so far, minus this month's plan, minus money already spent." | KEEP as ⓘ, but **FIX** the text to match the math and reconcile with Budget's Left (live: Today −$2,565 vs Budget Left −$590.88, unexplained) → "Income so far − planned bills − overspending." Then add one line under the number when it differs from Budget Left: "Budget's Left counts only what's spent." (the logic is Phase 1, task 1.3) |
| home-dashboard.tsx:176 | "Nothing needs you right now." | KEEP |
| review-queue.ts:232 (Needs you) | "{n} names cover {p} percent of what's left to sort." | SHORTEN → "{count} charges to sort" |
| home-dashboard.tsx:180 | "You're over on {name} by {$}." | SHORTEN → "{name}: {$} over" |
| home-dashboard.tsx:203 | "No bills due in the next few weeks." | SHORTEN → "No bills due soon." |

#### Text 2. Budget → This month (`budget-view.tsx`, `budget-amounts.tsx`, `category-panel.tsx`, `month-parts.tsx`)

| file:line | Current | Action → new text |
|---|---|---|
| page-menu.tsx:156 | "This month, the charges, and a bank file." | CUT (X10) |
| page-menu.tsx:167 | "More: year, sorting, past imports" | SHORTEN → "More" |
| budget-amounts.tsx:31 | "Rent, groceries, insurance, and eating out live here. A savings fund is separate and is not this budget." | CUT |
| budget-amounts.tsx:33 | "How leftover spending works" (style chooser on the Budget page) | MOVE to Settings only (it's already there at `settings-view.tsx:261`). Remove the chooser from Budget. |
| budget-amounts.tsx:41 / :50 | "Each spending category starts over." / "Leftover spending stays in that category." | MOVE with the chooser |
| budget-amounts.tsx:54 | "Income is not part of this choice. Pay changes… Nothing already saved is deleted." | CUT (X6) |
| screen-plan.ts:30-32 (lead) | "Planned {$} of about {$} usual income." / "Planned spending is {$}. Income is not entered yet." | SHORTEN → "{$} planned of {$} income" / "{$} planned · add income" |
| screen-plan.ts:38-40 (cover) | "A typical month in this file is {$}. The plan is {p} percent of that. That is far off, so treat it as a warning." / "Plan covers {p} percent of a typical month's spending." | SHORTEN → warn: "Plan is {p}% of a usual month" (red); normal: CUT (keep the number in a ⓘ) |
| budget-amounts.tsx:213-214 forecast sentence | `{chip}. {forecast.sentence}` | SHORTEN to the chip only, e.g. "On pace: {$} by month end" |
| screen-plan.ts:110 / :119 (ideas) | "{name} shows up, but one month is not enough to suggest an amount." / "{name} averages {$} a month. Add it?" | CUT the first. SHORTEN the second → "{name}: usually {$}/mo · [Use]" |
| budget-amounts.tsx:200 | "Over or at risk" (heading) | KEEP |
| budget-amounts.tsx:230 | "What arrived, next to what usually arrives. Nothing rolls into next month." | CUT (X6) |
| budget-amounts.tsx:243 | "Usual amount, if you want one" | SHORTEN → "Usual amount" |
| budget-amounts.tsx:272 | "What's left stays in the category. The bar is that leftover, full at three months of the amount." | MOVE-i on the bar |
| budget-amounts.tsx:273 | "The bar is what you spent against this month's amount. Next month starts over." | CUT |
| budget-amounts.tsx:278 | "No spending categories yet. Add one below." | KEEP (empty-state CTA) |
| budget-amounts.tsx:163-165 row "{spent} of {planned}" + `story.headline` chip ("{$} over.") | Seen: "Rent $1,350 of $1,350 — $3,050 over"; "Debt payments $280 of $150 — $970 over" | **FIX**: the chip shows carried-in overspend from earlier months with no label. → "{$} over incl. past months" or show "This month: even · Past: −$3,050". It must not contradict "$1,350 of $1,350". |
| budget-view.tsx:95 | "Nothing put into a fund this month." | SHORTEN → "No fund savings yet" |
| budget-view.tsx:100 | "{$} moved between funds, not counted as new savings." | MOVE-i |
| budget-view.tsx:105 / budget-transactions.tsx:110 | "Still coming this month" | KEEP the heading. **FIX** the list: Aug/Sep items marked "stopped"/"late" shouldn't be "coming this month"; hide stopped items. **FIX** the implausible "About $50,499.42 a year" total. |
| budget-transactions.tsx:115-116 | " · this looks late" / " · this one stopped" | SHORTEN → "· late" / hide stopped |
| category-panel.tsx:89, :295 | "Put leftovers to work" | KEEP once per screen (X7) |
| category-panel.tsx:145 | "{name} has {$} that can move." | SHORTEN → "{$} spare" (X7) |
| category-panel.tsx:173 | "See what it could grow to" | SHORTEN → "Grow it" |
| category-panel.tsx:283 | "Income is compared with what usually comes in. It does not carry." | CUT (X6) |
| category-panel.tsx:376/380 | "From last month" / "This month adds" | KEEP (numbers labels) |
| category-panel.tsx:487/501 | "This one starts fresh" / "This one carries over" | KEEP |
| screen-plan.ts:283-297 story detail | "Starts again at {$}." / "Next month starts {$} lower." / "{$} carries into next month." / "Nothing extra to carry." | SHORTEN → show only `headline`; detail → MOVE-i |
| month-parts.tsx:329 | "You're {$} over. Next month has {$} less, so this is the one to watch." | SHORTEN → "{$} over · next month −{$}" |
| month-parts.tsx:331 | "{$} extra stays here for next month." | SHORTEN → "+{$} carries to next month" |
| month-parts.tsx:339 | "See it in Funds" | **FIX** → "See fund" (no Funds tab now) |
| category-panel.tsx:564 | "No charges in this view." | KEEP |
| add-charge.tsx:53 | "Cash you spent. It lands in this month's budget." | SHORTEN → "Cash you spent" |
| add-charge.tsx:36 | "That date is still in the future. Use today, or pick a past day." | SHORTEN → "Pick today or an earlier day." (error, keep) |
| (layout) | "+" floating button covers the LEFT card on a 465px phone | FIX: add bottom padding equal to the FAB, or move the FAB above the tab bar. |

#### Text 3. Budget → Transactions (`budget-transactions.tsx`, `month-parts.tsx`)

| file:line | Current | Action → new text |
|---|---|---|
| budget-transactions.tsx:90/92 | "Start with one month" / "Import a bank file, then categorize each charge. That is the whole start. Tap a row later to split it or mark it paid back." | KEEP the heading. SHORTEN the body → "Import a bank file to begin." (CTA buttons stay) |
| budget-transactions.tsx:147 | "These deposits were filed as transfers, so they are not in income. Count them if the money is yours. Open a row if it pays back a purchase." | SHORTEN → "Left out of income. Yours? Count them." |
| budget-transactions.tsx:151 | "Those deposits are already in income." / "Counted {n} deposits as income." | KEEP (confirmation) |
| budget-transactions.tsx:153 | "Count every hidden deposit as income" | SHORTEN → "Count all as income" |
| budget-transactions.tsx:176 / :194 | "Tap a category to see the deposits." / "Tap a category to see the charges. Tap a charge to change where it goes." | CUT both |
| budget-transactions.tsx:178 / :196 | "No income in this month." / "No expenses in this month." | KEEP |
| budget-transactions.tsx:213 | "A payment to a credit card is not new spending — the purchases are already in expenses. These stay out so you do not count them twice." | MOVE-i on the "Card payments" heading → ⓘ "Already counted as purchases." |
| (summary line) | The month summary line repeats the cards above it | CUT the duplicate summary sentence; keep the cards. |
| month-parts.tsx:56-57 | "Paid back — not spending" / "Paid back — not income" / "Money back — lowers spending" | KEEP (row tags) |
| month-parts.tsx:69-72 | "Move {n} from {name} to {cat}, in {month} only." etc. (scope preview) | KEEP (needed before Apply), and drop the "set by hand stay as they are" clause → MOVE-i |
| month-parts.tsx:464 | "Pick a category above, then choose just this charge, this month, or the default. Nothing changes until you tap Apply." | SHORTEN → "Pick a category, then Apply." |
| month-parts.tsx:458 | "It is not spending and the matching deposit is not income." | SHORTEN → "Left out of spending and income." |
| month-parts.tsx:481 | "Marked as money a store gave back. It lowers spending and is not income." | SHORTEN → "Refund · lowers spending" |
| month-parts.tsx:489 | "Hidden from income. It is listed under Left out of income." | SHORTEN → "Moved to Left out of income." |
| month-parts.tsx:533 | "Pick two different categories. The overall category can still be one of them." | SHORTEN → "Pick two different categories." (error) |
| month-parts.tsx:534/535 | "Both amounts need to be more than zero." / "The two amounts need to add up to {$}." | KEEP (errors) |
| month-parts.tsx:540 | "Divided. The overall category stays, and only this row changed." | SHORTEN → "Split saved." |
| month-parts.tsx:547 | "{overall} stays the overall category." | CUT |
| month-parts.tsx:601 | "{merchant} on {day} is {$}, close to this charge. Tap it, then confirm. Both rows leave income and spending." | SHORTEN → "Best match: {merchant}, {day}, {$}" |
| month-parts.tsx:603 | "Nothing lines up with {$}. The nearest deposit is first. Pick it only if that money really paid this." | SHORTEN → "No exact match. Closest first." |
| month-parts.tsx:604 | "There is no deposit to match. You can still leave this purchase out of spending." | SHORTEN → "No deposit to match." |
| month-parts.tsx:626 | "Matched. Both rows are out of this month." | SHORTEN → "Matched." |
| month-parts.tsx:660 | "Import a CSV when this month's file arrives, or move to another month." | SHORTEN → "No charges yet. Import this month's file." |
| month-parts.tsx:742 | "Income and expenses are separate columns. Paid back means the row is on the sheet but not in the totals." | MOVE-adv |
| sort-queue.tsx:244 | "Keys: 1, 2, or 3 pick a choice. S skips. Z undoes." | MOVE-i (desktop only; hide on touch) |
| sort-queue.tsx:178 | "Nothing in this list is still waiting on a category." | SHORTEN → "All sorted." |
| sort-queue.tsx:115 | "Changed these charges, not the default." | KEEP (confirmation) |

#### Text 4. Budget → Import (`import-wizard.tsx`, `import-review.tsx`, `routes/import.tsx`, `export-bar.tsx`)

| file:line | Current | Action → new text |
|---|---|---|
| import-wizard.tsx:187 | "BudgetFlow reads a file you download from the bank. It does not log in. Each file belongs to one account." | SHORTEN → "No bank login. Just a downloaded file." (this is a trust signal, so keep it visible, short) |
| import-wizard.tsx:192/195 | "Which account is this file from?" ×2 | KEEP once; CUT the duplicate label |
| import-wizard.tsx:217 | "Add the account this file belongs to." | CUT |
| import-wizard.tsx:281 | "Drop a .csv here, or tap to choose" | KEEP |
| import-wizard.tsx:282 | "One account per file. Columns can be fixed after the preview." | CUT |
| import-wizard.tsx:389 | "The file did not include one. You can skip this." | SHORTEN → "Optional." |
| import-wizard.tsx:492-516 per-bank steps (Chase, BofA, Wells, Capital One…) | ~10 multi-clause sentences | MOVE-help: keep the `<details>` "How to get a CSV from your bank" collapsed by default, and move the bank-specific lists to `/help#csv`. |
| import-wizard.tsx:532-537 generic steps | 6 steps | KEEP inside the collapsed details, and SHORTEN :536 → "Pick a month to start. Duplicates are skipped." |
| import-wizard.tsx:123/134/153/168 | Errors ("That file was empty." etc.) | KEEP |
| import-review.tsx:53 | "Fair guesses are marked Check. Only names with no good guess wait." | SHORTEN → "Check the guesses marked Check." |
| import-review.tsx:32 | "Nothing new. Those rows were already in this account." | KEEP |
| routes/import.tsx:12-15 | "Take the numbers elsewhere" / "Optional. The live ledger stays in your BudgetFlow account. If you want the same numbers in Google Sheets, Excel, Numbers, or another budget app, download a file below." | **FIX + MOVE**: this contradicts "on this device". Move export to Settings only. If kept → "Download for Excel or Sheets". |
| export-bar.tsx:96 | "One workbook for Excel and Google Sheets, plus a CSV. Totals match Home." | **FIX** → "Excel / Sheets workbook, plus CSV" ("Home" no longer exists) |
| export-bar.tsx:48/56/69 | "…Google Sheets: File, Import, Upload, Replace spreadsheet." | MOVE-i (keep the toast "Downloaded.") |
| export-bar.tsx:189 | "Type RESET to erase this device. Your bank is not touched." | KEEP (destructive). Layout FIX: don't put the red "Reset this device" button next to the exports. Move it to a "Danger zone" at the bottom of Settings behind a details element. |
| (data) | Two "Cash" accounts plus a "Demo bank file" account appear in the account picker | Logic: Phase 1, task 1.14 |

#### Text 5. Money (`funds-view.tsx`, `account-board.tsx`, `grow-pictures.tsx`, `grow/worth.tsx`)

| file:line | Current | Action → new text |
|---|---|---|
| funds-view.tsx:85 | "Goals, accounts, and what you own minus what you owe." | CUT (X10) |
| funds-view.tsx:87 | "Cash $ · Brokerage $ · Retirement $ · Debts $ · Net $" in one sentence | Turn into 5 number tiles (visual, not prose). Numbers must match Accounts and Plan (Phase 1, task 1.2). |
| funds-view.tsx:109 | "This month put in {$}. Used {$}." | SHORTEN → "+{$} in · {$} used" |
| funds-view.tsx:116 | "A fund is money you set aside. What you do not spend stays in it." | MOVE-i on "Goals" |
| funds-view.tsx:198 | "{label}: {$} put in, {$} used." | KEEP numbers, drop words → "{label}: +{$} / −{$}" |
| funds-view.tsx:212-215 | Pace sentences | SHORTEN → "{$}/mo to hit it by {Mon YYYY}" / "On pace for {Mon YYYY}" / "{$} to go" |
| funds-view.tsx:222-224 | "This goal is reached. {$} extra in this fund. Want to see what it could grow to?" | SHORTEN → "Goal reached · {$} extra · [Grow it]" |
| funds-view.tsx:229 | "An estimate, not financial advice." | CUT (X2) |
| funds-view.tsx:280 | "Put in {$}. Used {$}. At month end: {$}." | Make it 3 numbers. Also FIX: the Groceries fund shows −$780.73 while Budget says $239.27 left, with no label. Label it "Fund balance" vs "Left this month". |
| funds-view.tsx:283 | "From this month's budget: {$} funding, {$} set aside, {$} spent by linked categories." | MOVE-adv |
| funds-view.tsx:312 | "A new amount starts next month. Months already funded stay as they were." | SHORTEN → "Starts next month." |
| funds-view.tsx:315 | "Pause. Nothing is added until you turn this off." / "Paused. Turn this off to add money again." | SHORTEN → "Pause" / "Paused" |
| funds-view.tsx:330 | "Nothing is attached. Spending stays on the monthly budget." | SHORTEN → "No linked spending." |
| funds-view.tsx:373 | "This is not income and not spending. It only moves money you already have." | MOVE-i |
| funds-view.tsx:419 | "Add another fund if you want to move money out of this one." | SHORTEN → "Needs a second fund." |
| account-board.tsx:112 | "Net {$}. Loans of {$} are subtracted. Cards are already part of the account balances." | SHORTEN → "Net {$}". Put the rest in ⓘ. FIX: live shows "Loans of $5,000" (a Debt-calculator card) while the Car loan account is −$9,800. |
| account-board.tsx:201/202 | "No bank or investment accounts yet. Add cash or an investment, or import a bank file." | SHORTEN → "No accounts yet. Add one or import a file." (empty CTA) |
| account-board.tsx:240 | "Add a return and a monthly amount to estimate growth." | X8 → button "Estimate growth" |
| account-board.tsx:303 | "Typed balances, unless an investment is set to use its estimate." | MOVE-i |
| account-board.tsx:327/335 | "Estimated growth. Low, likely, and high." / "Estimate. Low, likely, and high. Not a typed balance." | Keep one; SHORTEN → "Estimate (low–high)" |
| grow-pictures.tsx:38 | "Each slice is a kind of account. Cards you owe are in the net total, not drawn as money you have." | SHORTEN → "Debts are in the net, not drawn." |
| grow-pictures.tsx:43 | "Last net worth you typed: {$} on {date}." | MOVE-adv. The old "$5,100" snapshot sits next to +$38,940, which confuses. Show snapshots only in the Net worth history. |
| grow-pictures.tsx:65-134 (6 places × 4 lines: what/fits/tax/risk) | 24 sentences | MOVE-i: show name + "Easy to reach / Locked" dot only; the 4 lines open on tap (already a "tap a dot" UI → make it the only place they show) |
| grow-pictures.tsx:144 | "One picture of where money can go. Tap a dot. These are not promised returns." | SHORTEN → "Tap a dot to compare." |
| grow-pictures.tsx:163 | "Positions are rough. Real products vary." | CUT (duplicate of :101) |
| grow/worth.tsx:25 | "Last snapshot you typed is {$} on {date}. Accounts minus loans are {$}." | SHORTEN → "Net worth {$}" (+ snapshot in the chart only) |
| grow/worth.tsx:29 | "Each account keeps its latest balance on or before that date. A card you owe lowers the total." | MOVE-i |

#### Text 6. Plan (`grow/*.tsx`, `retirement-card.tsx`)

Shared: apply X2–X5. Every calculator becomes **question → inputs → one big result number → picture → key numbers**. Tips, assumptions and "If a number moves" go in collapsed details.

##### Text 6a. Can I retire? (`grow/retirement.tsx`, `retirement-card.tsx`) — 70% prose now
| file:line | Current | Action → new text |
|---|---|---|
| grow/retirement.tsx:11 + retirement-card.tsx:105 | "Where do you stand for retirement?" + "Will I be able to retire?" (two headings) | CUT the H2 at retirement.tsx:11; keep "Can I retire?" once (match the tab) |
| retirement.ts:284 (result.sentence) | "At 67 you'd likely have about $3,004,808 ($1,383,161 to $7,058,822). That covers about 282 percent of what you want." | SHORTEN → big number "$3.0M at 67" + sub "Covers 282% of your goal" (and FIX "282 percent": cap the display at "More than enough" over 150%) |
| retirement-card.tsx:113 | "{p} percent of the income you want" (ring label) | SHORTEN → "{p}% of goal" |
| retirement-card.tsx:121 / :279 | YAxis raw ticks "0 2000000 4000000" | FIX: `tickFormatter` → "$2M" (also `grow-pictures.tsx:204`, `grow/worth.tsx:68`, `cash-chart.tsx:37`) |
| retirement-card.tsx:133-136 | "The likely path covers what you want." / "The gap is {$} a year. Save {$} more each month, or work about {n} more years." | SHORTEN → "On track" / "Gap {$}/yr · save +{$}/mo or work {n} yrs more" |
| retirement-card.tsx:140 | "Enter the yearly income you want to see how much of it this covers." | SHORTEN → "Add the yearly income you want." |
| retirement-card.tsx:152-205 factNote under 10 inputs | e.g. "From your income. A typical month of income, minus a typical month of spending." / "Market return, middle, as of 2026-01-01. BudgetFlow planning range, not a published series. Needs checking." | MOVE-i (X5) |
| retirement-card.tsx:172 | "50 means the employer adds half of your monthly saving, not half of your pay." | SHORTEN → placeholder "50 = half of what you save" |
| retirement-card.tsx:181-182 | placeholder "Blank counts as zero" + helper "Blank counts as zero." | CUT the helper; keep placeholder "0 if none" |
| retirement-card.tsx:190/194 | Low / High return inputs | MOVE-adv |
| retirement-card.tsx:208 | "Full Social Security age of 67 is for a birth year of 1960 or later. An earlier birth year has a lower full age. {$} saved is what the chart starts from." | CUT (it's in Assumptions; it repeats live) |
| retirement-card.tsx:238-242 | assumptions list (second copy) | CUT (X5) |
| retirement-card.tsx:247-254 | "If a number moves" rows "Return 2 points lower: $1,773,543.80, 167 percent covered" | MOVE-adv, and SHORTEN each → "Return −2 pts: $1.8M (167%)" |
| retirement-card.tsx:257 | "A thousand tries" | FIX → "Good years and bad years" (or "1,000 market paths") |
| retirement-card.tsx:259 | "Each year draws a return around {m}% with a spread of {s} points. Same seed, same result. After the retire age, spending rises with inflation. This is not a promise." | MOVE-i → "Random market years. Not a promise." |
| retirement-card.tsx:291 | "Estimates only, not financial advice." | CUT (X2) |
| (data) | "Saved so far" = $43,850 (retirement + brokerage) vs Money "Retirement $36,900" | FIX the label → "Invested so far", or use retirement only (Phase 1, task 1.2) |
| (placement) | Retirement inputs also live in Settings (`settings-view.tsx:185-226`) | MOVE: keep them only on Plan; CUT the Settings copy (`:185` "Retirement starts from these. Reset puts a number back to its default. A blank age is left unset.") |

##### Text 6b. Pay off debt (`grow/debt.tsx`, `grow-pictures.tsx` PayoffRace)
| file:line | Current | Action → new text |
|---|---|---|
| debt.tsx:54 | "This payment never pays it off, because it doesn't cover the interest. Add at least {$} a month." | SHORTEN → "Never paid off. Add {$}+/mo." (KEEP, it's the key message). FIX: live default "Card $5,000 at 24%" says "add at least $1.00", which looks wrong next to "never". Check the `extraNeeded` rounding when the minimum is 0 (logic). |
| debt.tsx:55 | "At this payment it takes more than 50 years. Add at least {$} a month to finish within 50 years." | SHORTEN → "Over 50 years. Add {$}/mo." |
| debt.tsx:59 | "Cards total {$}. Type the rate and the minimum, then add the debt." | SHORTEN → "Cards owe {$}. Add rate + minimum." |
| debt.tsx:60 | "Type each card or loan. The payoff shows once a debt is added." | SHORTEN → "Add a card or loan." |
| debt.tsx:64 | "Paying {$} a month, {name} is paid off in {when} with {$} in interest." | SHORTEN → big "Debt-free {Mon YYYY}" + sub "{$} interest · {$}/mo" |
| debt.tsx:65 | "Paying highest interest first, you're debt-free in {when} and pay {$} in interest." | same pattern as :64 |
| debt.tsx:74 | Assumption "Each month, interest is added first. Then every debt gets its minimum…" | KEEP (inside Assumptions) |
| debt.tsx:99 | "Enter {x} to add this debt." / "Enter a name to add this debt." | KEEP (validation) |
| debt.tsx:37/38 | "the interest rate (0 is fine)" / "the minimum payment (0 is fine)" | SHORTEN → "the rate" / "the minimum" |
| debt.tsx:122-125 | "When each debt is paid off" list | KEEP (useful numbers) |
| debt.tsx:94 tagOf line under the inputs | "typed" / "from your accounts" | CUT (X4) |
| grow-pictures.tsx:262-276 | "{less} costs {$} less interest in this estimate. An estimate, not financial advice." / "Two payoff orders. Shorter is finished sooner." / "Smallest balance first {n} months. Highest interest first {n} months." | SHORTEN → "Highest-rate first saves {$}". CUT :276 and the duplicate months sentence (:265, the bars show it). FIX layout: the chart is tiny and its labels overlap. |
| debt.tsx:79 | "Extra payment each month" | KEEP; FIX: a blank silently counts as 0 → placeholder "0" plus `readNumber` |
| (logic) | Adding or removing here changes saved accounts and net worth (#214) | Logic: Phase 1, task 1.1 |

##### Text 6c. Save for something (`goal.tsx`, `cushion.tsx`)
| file:line | Current | Action → new text |
|---|---|---|
| goal.tsx:46 | "Set aside {$} each month for {n} months." / "Type the price. Already saved starts from a savings account when one exists." | KEEP the first as the big number "{$}/mo". SHORTEN the second → "Enter the price." |
| goal.tsx:51 | "A goal is extra savings. It is not a budget category." | CUT |
| cushion.tsx:17 | "{$} covers about {n} months. {m} months is {$}." | SHORTEN → big "{n} months covered" + "Goal {$}" |
| cushion.tsx:18 | "Import a few months of spending. This uses that average." | KEEP (empty state) → "Import 3 months to see this." |

##### Text 6d. Grow my money (`put-to-work.tsx`, `monthly.tsx`, `double.tsx`, `inflation.tsx`, `overview.tsx`)
| file:line | Current | Action → new text |
|---|---|---|
| put-to-work.tsx:32-36 | "Left alone for {span} at {r} a year, {$} grows to about {$} before tax. In a taxable account, after {t} tax on the gain, you'd keep about {$}." | SHORTEN → big "{$} in {n} yrs" + sub "{$} after tax" |
| put-to-work.tsx:30 | "With 0 years there is no time to grow, so it stays {$}." | SHORTEN → "0 years: stays {$}." |
| put-to-work.tsx:50-53 | 4 assumption lines | KEEP in Assumptions; SHORTEN :50 → "Grows monthly at rate ÷ 12." |
| put-to-work.tsx:67 | tag "when you sell, in a taxable account" | SHORTEN → "taxable account" |
| monthly.tsx:26 | "{$} is money you put in. The ending balance is {$}." | SHORTEN → big "{$}" + "you put in {$}" |
| double.tsx:68 | "{$} doubles in about {n} years. Reaching the target takes {x}." | SHORTEN → "Doubles in {n} yrs · target in {x}" |
| double.tsx:58 | " Enter a target to see how long reaching it takes." | SHORTEN → "Add a target." |
| double.tsx:68 | "The rate has to be above zero." | KEEP (error) |
| inflation.tsx:38 | "{$} buys about {$} in {n} years if prices rise {i} percent." | SHORTEN → big "{$} of buying power" + "in {n} yrs at {i}%" |
| grow-pictures.tsx:197 | "After {n} years at {r} it is about {$} before tax… The shaded band shows… The flat band is the {$} you put in. An estimate, not financial advice." | SHORTEN → "Band: {r−2}–{r+2}%"; CUT the rest |
| grow-pictures.tsx:214 | "Before tax, at the rate you typed and 2 points either side. The put-in row does not grow." | MOVE-i |
| overview.tsx:8-12 | Card subtitles "Where you stand, and the gap." / "One amount, left alone." / "What to set aside each month." / "Months of spending, in cash." / "Highest rate, or smallest balance." | KEEP (≤ 6 words each), only if the overview page is still reachable; otherwise CUT |
| overview.tsx:23 | "Nothing of your own is here yet. Add a file, or open a calculator and type a number." | SHORTEN → "Add a file, or type numbers." |

##### Text 6e. Roth or traditional (`roth.tsx`)
| file:line | Current | Action → new text |
|---|---|---|
| roth.tsx:19 | "Both use the same pre-tax pay each year. Roth puts in what's left after today's tax and is tax-free later. Traditional puts in all of it and is taxed when you take it out. Deposits go in at the end of each year." | KEEP in Assumptions only; it must not show above the result |
| roth.tsx:11-13 | "Your income allows the full Roth amount." / "…phase-out range, so only part… may be allowed." / "…above the Roth limit, so a direct Roth contribution isn't allowed." | SHORTEN → "Full Roth allowed" / "Partial Roth only" / "Over the Roth income limit" |
| (layout) | "Fine-tune this question" disappears on Roth | FIX: Roth has one page, which is fine, but keep the control's space so the layout doesn't jump, or hide it on every single-page question consistently |

##### Text 6f. Loan (`loan.tsx`)
| file:line | Current | Action → new text |
|---|---|---|
| loan.tsx:38 | "The regular payment is {$}. Paying {$} extra saves {$}." | SHORTEN → big "{$}/mo" + "Extra {$} saves {$}" |
| loan.tsx:49 | "The regular payment matches this loan. Extra is added on top. A card balance is not filled in." | CUT |
| loan.tsx:37 | "This payment does not finish the loan in 50 years." | KEEP |
| (input) | Loan opened with Years = 5.5 | FIX: that's the placeholder "5.5" (`loan.tsx` Years input) looking like a value. Use the placeholder "e.g. 30", or an empty box with the label "Years". |

##### Text 6g. When work is optional (`work-optional.tsx`)
| file:line | Current | Action → new text |
|---|---|---|
| work-optional.tsx:43-52 | "Work becomes optional at about {$}, which is {x}× your {$} yearly spending. Starting from the {$} you have and saving {$} a month, growing {r} a year after inflation, that's about {n} years (age {a})." | SHORTEN → big "Age {a} (~{n} yrs)" + "Your number: {$}" |
| work-optional.tsx:48 | "…you don't get there within 100 years. Saving more or spending less brings it closer." | SHORTEN → "Not within 100 years." |
| work-optional.tsx:58 | "Coast number: {$}. If you stopped saving today, that much invested now would grow to the number by age {r} on its own. {where}" | SHORTEN → "Coast number {$}" + ⓘ |
| work-optional.tsx:60 | "Add your age in Account to see the coast number: what you'd need invested now…" | **FIX** → "Add your age to see your coast number." (and point to Plan, not "Account") |
| work-optional.tsx:56/57 | "You have {$}, so you're already past it." / "…so keep saving to get there." | SHORTEN → "Already there" / CUT |
| work-optional.tsx:74-77 | 4 assumption lines | KEEP in Assumptions; SHORTEN :75 → "Real growth = (1+return)÷(1+inflation)−1." |
| work-optional.tsx:81/84/87/97/100 tags | "before inflation, shared with other pages" / "shared with other pages" / "a common starting point" / "from your savings rate" / "no investment balance in your accounts" | CUT (X4); keep the last as a placeholder "0" |

#### Text 7. Settings (`settings-view.tsx`, `export-bar.tsx`) — 60% prose now

| file:line | Current | Action → new text |
|---|---|---|
| settings-view.tsx:35 | "Look, household, and the file. Accounts live on Money." | CUT |
| settings-view.tsx:81 | "The numbers stay the same. This only changes the paper." | CUT |
| settings-view.tsx:103-104 | "Lively — pages settle in" / "Calm — almost still" | SHORTEN → "Lively" / "Calm" |
| settings-view.tsx:112 | "Simple keeps the short notes. Advanced adds the workings. Payback, splits, merchants, and the year page stay available either way." | SHORTEN → "Advanced shows the math." Also FIX: Advanced appears ON by default live; the default should be Simple (`sample.ts:86` says simple, so check the toggle's real default). |
| settings-view.tsx:141 | "The name saves as you type." | CUT |
| settings-view.tsx:160 | "Opens the setup questions. Your transactions stay." | SHORTEN → "Your transactions stay." |
| settings-view.tsx:185-226 | Retirement defaults block | MOVE to Plan (6a) |
| settings-view.tsx:280-285 | "This choice is for spending categories only." / "What this does not change" / "Income is compared…" / "A fund is extra savings…" / "Switching never deletes…" | Keep only "Switching never deletes anything." (reassurance); CUT the rest (X6) |
| settings-view.tsx:378, :406 | "Mail is not connected yet, so the confirmation/reset link is here. Open it on this device. After you add Resend, this button emails it instead." | **FIX/CUT**: developer text. → "Your link:" (if mail is off), or hide the feature until email works |
| settings-view.tsx:461 | "Mail is not connected yet. Ask for a confirmation or reset link and it will show on this page until you add RESEND_API_KEY and HARBOR_FROM_EMAIL (Resend)." | **CUT** (it exposes env-var names to users) |
| settings-view.tsx:444 | "This ledger stays on this device until you sign in. Then it follows the account." | SHORTEN → "Saved on this device. Sign in to sync." |
| settings-view.tsx:485 | "For email accounts. Google and X do not have a password here." | SHORTEN → "Email sign-in only." |
| settings-view.tsx:499-510 | "Optional backup code" + "You do not need this. Email confirmation and the reset link are the way back in. A backup code is only if mail…" | MOVE-adv (collapse) |
| settings-view.tsx:516 | "Removes this sign-in and the ledger saved to it. Download a file first if you might want it." | KEEP (destructive) → "Deletes your account and budget. Download first." |
| settings-view.tsx:324/341/346/363/386/391/410/415/434 | Errors | KEEP |
| (nav) | Sidebar Settings link didn't navigate on the first click | FIX (logic: Phase 5, task 5.3) |
| (wording) | ledger / budget / file used interchangeably | FIX: use "budget" for the data, "bank file" for a CSV |

#### Text 8. Year / Sorting / Past imports (under Budget → More)

| file:line | Current | Action → new text |
|---|---|---|
| year-home.tsx:142 | "Open a month, or tap a category. The budget for those categories is on Budget." | CUT |
| year-home.tsx:147 | "What this year already shows" | SHORTEN → "This year" |
| year-home.tsx:211 / :223 / :230 | "Tap a month to edit its transactions." / "Tap one to see the year" ×2 | CUT |
| year-home.tsx:247 / :285 | "Green stayed. Red left. A purchase someone paid back is in neither bar." / "Green stayed. Red left. Paybacks are in neither." | Replace with a legend (two coloured dots: "In" / "Out"); CUT both sentences |
| year-home.tsx:319 | "Largest spending categories. Money a store gave back is already taken out." | SHORTEN → "Biggest categories" |
| year-sheet.tsx:122 | "Import a bank CSV and this page becomes a 12-month grid…" | SHORTEN → "Import a file to fill the year." |
| year-sheet.tsx:135 / :140 | "Months across, categories down. Scroll sideways on a phone." / "…Typical is the median of months with activity. A blank plan uses that typical…" | CUT :135; MOVE-i :140 |
| sorting-view.tsx:136 | "Each name has one default category. Those categories are the budget: rent, groceries, insurance, eating out. Changing a name here changes every month, except charges you set by hand." | SHORTEN → "Changes apply to every month." |
| sorting-view.tsx:143 | "Opens the same sort screen used everywhere else." | CUT |
| sorting-view.tsx:150 | "No names yet. A bank file is how they show up." | SHORTEN → "Import a file to see names." |
| routes/imports.tsx:13 | "Files already brought in. Nothing here deletes a charge." | SHORTEN → "Your imported files" |
| carry-start.tsx:27 | "Past months will show what you would have carried. This does not delete anything." | SHORTEN → "Nothing is deleted." |

#### Text 9. Setup and the welcome gate (`onboarding.tsx`, `welcome-gate.tsx`, `fund-wizard.tsx`)

| file:line | Current | Action → new text |
|---|---|---|
| onboarding.tsx:35-41 | 7 × "Why we ask: …" | MOVE-i (one ⓘ "Why?" per step) |
| onboarding.tsx:564 | "The name your bank shows, like your employer. It helps us recognize this income later." | SHORTEN → placeholder "e.g. ACME PAYROLL" |
| onboarding.tsx:621 | "Each spending category, like rent or groceries, starts over. Income is compared with what usually comes in. It is not carried over." | SHORTEN → "Each category resets monthly." (the only place the income-doesn't-carry idea stays → MOVE-i "Income never carries.") |
| onboarding.tsx:625 / :641 | "A jar empties, then fills again on the first of the month." / "The level left in the jar stays there for the next month." | SHORTEN → "Resets on the 1st" / "Leftovers roll over" |
| onboarding.tsx:631-636 | "Leftover in a category stays…" / "How leftovers start" / "Going over means next month has less…" / "Leftovers start at the first month of your file…" / "Past months show what you would have carried…" | Keep :631. CUT :634. MOVE-adv :633/:635/:636 |
| onboarding.tsx:644 | "Not sure? Either can be changed any time in Account. One category can do the other later…" | **FIX/SHORTEN** → "Not sure? Change it later in Settings." |
| onboarding.tsx:717 | "No income yet, so these start from a typical floor. You can change them." | SHORTEN → "Starter amounts. Edit any." |
| onboarding.tsx:791 / :860 | "Optional. Add the ones you use, and today's balance if you know it." / "Optional. One thing you are saving for." | SHORTEN → "Optional" |
| onboarding.tsx:537 | "No income yet. You can add it later, inside the app." | SHORTEN → "Add income later anytime." |
| welcome-gate.tsx:36 | "A few questions about you, then the app does most of the work. About five minutes. Nothing connects to your bank." | SHORTEN → "5 minutes. No bank login." (trust line: keep, bigger) |
| fund-wizard.tsx:136 | "A name makes this fund easy to find later." | CUT |
| fund-wizard.tsx:174 | "A goal is optional. You can just keep adding each month." | SHORTEN → "Optional." |
| fund-wizard.tsx:233 | "This is added on the 1st. The first month is added right away." | SHORTEN → "Added on the 1st, starting now." |
| fund-wizard.tsx:259 | "Pick Groceries for a food fund. Skip this for plain savings. A category you pick will no longer have a monthly amount, so it is not counted twice." | SHORTEN → "Optional. e.g. Groceries for a food fund." |
| fund-wizard.tsx:292 | "Optional. This is money you already set aside, before this month's add." | SHORTEN → "Optional. Already saved." |

#### Text 10. Sign-in and meta (`routes/login.tsx`, `routes/reset.tsx`, `routes/__root.tsx`)

| file:line | Current | Action → new text |
|---|---|---|
| __root.tsx:23 | meta description "Import bank CSVs, assign every dollar a job, and read week-to-week habits." | **FIX** → "A private budget from your bank's download. No bank login." (also og:description, og:image, Phase 6) |
| login.tsx:104 | "A private ledger for the files your bank already gives you." / "Your outlook is ready. Keep it." | SHORTEN → "Your budget, without a bank login." / "Your plan is ready. Save it." |
| login.tsx:108 | "Create an account so this setup is not stuck on this phone. Then import a CSV whenever you want." | SHORTEN → "Save it to use on any device." |
| login.tsx:109 | "Import a CSV, assign every dollar a job, and read the month and the year. Nothing logs into a bank." | **FIX** (jargon) → "See what's safe to spend. No bank login." |
| login.tsx:133-135 | "Saved to your account after you sign up — not this browser alone." / "Keyword matching you can override — no model guessing." / "Google, X, or email." | Replace with 3 icon trust chips: "🔒 No bank login" · "📄 Works with any bank CSV" · "🗑 Delete anytime". CUT "no model guessing". |
| login.tsx:151 / :154 | "Optional, but this is how the ledger follows you off this device." / "Takes a minute. Then confirm the email from Account." | SHORTEN → "Optional. Syncs across devices." / CUT |
| login.tsx:85-86 | "Mail is not connected on this host yet, so the confirmation link is here…After you add Resend…" | **CUT** (developer text) → "Confirm here:" |
| reset.tsx:108 | "Email yourself a link. It works for one hour. Google and X sign-in do not use a password." | SHORTEN → "We'll email a link (1 hour)." |
| reset.tsx:122 | "If you once saved an optional backup code from Account, you can use it here. New accounts do not get one…" | MOVE-adv / SHORTEN → "Have a backup code?" |
| reset.tsx:119 | "Email is not set up on this host" | FIX → "Email reset isn't available yet." |
| (route) | `/welcome` is a 404 | Add a route or a redirect to `/` (Phase 6) |
| (layout) | Sign-up is a small link; trust signals are small | The primary button should be "Create free account" (Phase 6) |

#### Text 11. Strings to KEEP as-is (groups, not exhaustive)
- All error and validation messages: `import-wizard.tsx:123,134,153,168`; `month-parts.tsx:532-535`; `settings-view.tsx:324-434`; `login.tsx:59,69,171`; `reset.tsx:34,39`; `confirm.tsx:33,50`; `export-bar.tsx:58,71,88,209`; `welcome-gate.tsx:24`; `debt.tsx:99`; `double.tsx:68` (rate > 0).
- Destructive confirmations: `export-bar.tsx:189,191`; `settings-view.tsx:516-521`; `funds-view.tsx:345,353`.
- Empty-state CTAs: `home-dashboard.tsx:113,116`; `budget-transactions.tsx:95,97`; `budget-amounts.tsx:278`; `year-home.tsx:114-120`; `sorting-view.tsx:152`; `overview.tsx:25`.
- Button labels, tab labels, field labels and toasts (Undo, Restored N transactions, Matched, etc.).

**Phase 3 acceptance (each part):**
- Every row of its sections above is done, or listed in the merge message as "kept, because …".
- `rg -n "general guidance\.|Not personal advice|RESEND_API_KEY|HARBOR_FROM_EMAIL|assign every dollar|no model guessing|Totals match Home|See it in Funds|in Account|A thousand tries|Same seed" src` returns no user-visible strings (code identifiers are fine).
- `rg -n "Income is (not carried|compared with what usually)" src/components` matches at most one place (setup) (#249).
- The `copy-rule.test.ts` test still passes. Extend it so it fails on any user-facing string over ~160 characters in `src/components` (allow-list errors and destructive confirmations).
- On each touched screen, the money numbers are the first thing below the heading.
- Tests that assert on exact sentences (`tips.test.ts`, `screen-plan.test.ts`, `readout.test.ts`, `reference.test.ts`) are updated to the new wording, never deleted.

---

### Phase 4 · Remaining calculator and math items (branch `phase-4-calculators`; split into 4a, 4.1–4.10, and 4b, the rest, if needed)

Run `math-checker` on this phase. Every result must come from a function in `src/lib/budget/` with a test.

**4.1 · #150 / #162 / #17 / #35 / #36 · One shared set of "my numbers", plus a full fake-household test.**
- **What:** Calculators start from past spending (or the demo's ~$1,408/mo) instead of the $4,065 plan. Retirement assumes $1,722 saved a month while When work is optional assumes $3,084.05. "Saving each month" defaulted to $2,541, which is 41–61% of take-home. "Income wanted" defaulted to $13,521 from the demo's spending.
- **Where:** new `src/lib/budget/my-numbers.ts`; `src/components/grow/session.tsx`; `retirement-card.tsx`; `grow/work-optional.tsx`; `grow/double.tsx`; `grow/inflation.tsx`; `grow/goal.tsx`; `grow/cushion.tsx`.
- **Change:** `myNumbers(state, ym)` returns `{ monthlyIncome, planTotal (from 1.12), typicalSpending, monthlySaving, cash, brokerage, retirement, debts, funds, age }`. `monthlySaving` = average over the last 3 complete months of money actually moved into savings/retirement (savings-transfer categories + fund adds + retirement contributions), not income − spending. Every calculator default reads from it. Spending-based defaults use `planTotal` when a plan exists, else `typicalSpending`, with a chip saying which ("from your plan" / "from your spending"). "Income wanted in retirement" starts **blank** with a one-tap suggestion "Use 80% of your plan: $X/yr".
- **Accept:** a fixture `src/lib/budget/fixtures/household-alex.ts` (income $4,200/mo; plan $4,065; Checking $5,000, Savings $6,130, Visa −$1,240, Car loan −$9,800, Roth $36,900, Brokerage $6,950; Student loan $18,500 @ 5.5% min $190; 3 months of transactions). A test `household.test.ts` checks that Today, Budget, Money and every calculator default read the same income, plan, cushion, net worth and monthly saving. Retirement and When work is optional use the same `monthlySaving`.

**4.2 · #20 (what's left) / #132 / #133 / #232 · Retirement gives one honest answer in today's dollars.**
- **What:** The headline and the Low/Likely/High boxes can come from different numbers. The "thousand tries" chart is in future dollars ($1.11M) next to a today's-dollars chart ($544K), unlabelled, and its axis once reached $80M. "Likely $1.62M / 153%" sits next to "79% of tries succeed". "282 percent of the income you want" isn't capped. Source lines print 2–3 times.
- **Where:** `src/lib/budget/retirement.ts`, `src/components/retirement-card.tsx`, `src/components/grow/retirement.tsx`.
- **Change:** (1) One result object feeds the headline, the boxes and the charts. (2) Show today's dollars by default everywhere on the page, with "in today's dollars" in the sub-line; convert the random-markets paths by ÷(1+inflation)^years. (3) Cap the chart's y-axis at the 90th percentile at the retirement age × 1.25. (4) Headline: "On track in about 8 of 10 futures" (from the simulation's success share), and the sub-line "Saving $150 more a month makes it 9 of 10" (solve for the extra monthly that reaches the next tenth; hide it if more than $2,000). (5) Coverage over 150% shows "More than enough" with the % in the ⓘ. (6) The source/assumption lines show once, in the Assumptions details.
- **Accept:** tests in `retirement.test.ts`: for scenario (d), the headline likely value equals the "Likely" box and equals **$543,829.77** in today's dollars; the simulation's median at 67 is converted to today's dollars (within 15% of $543,830, not ~$1.11M); coverage 282% prints "More than enough". `rg -c` for a source line on the page gives 1.

**4.3 · #45 / #154 (what's left) · Charts: readable money axes, no overlaps, sensible ranges.**
- **What:** Axes print "0 2000000 4000000". The debt chart is tiny, and "Smallest balance first" overlaps its line. The "Pick a place" dot chart is unlabelled.
- **Where:** `src/components/retirement-card.tsx:121, 279`, `src/components/grow-pictures.tsx:204` and the PayoffRace (~262–276), `src/components/grow/worth.tsx:68`, `src/components/cash-chart.tsx:37`, and every other Recharts `YAxis`/`XAxis`.
- **Change:** add `axisMoney(n)` in `src/lib/budget/money.ts` ("$0", "$500", "$12K", "$1.5M", "−$2K"). Every money axis uses it. Charts are at least 200px tall on phones. Line labels use Recharts `LabelList` at the line end, or a legend, never on top of the line. Debt: one line per debt, with its payoff month at the end. Give the "Pick a place" chart labelled axes ("Easy to reach ↔ Locked away", "Steadier ↔ Bigger swings").
- **Accept:** a test for `axisMoney` (0→"$0", 2,000,000→"$2M", 12,500→"$12.5K", −2,000→"−$2K"). `rg "<YAxis" src/components` shows a `tickFormatter` on each money axis.

**4.4 · #31 / #46 / #86 · Save for a goal: correct month count, carries the saved amount, really makes a fund.**
- **What:** The default goal ($4,225 = 3× spending) is already covered by the $6,200 saved, so it opens at "$0, 100%". "Make this a fund" uses 25 months instead of 24 (`goal.tsx:40` `shiftMonth(g.ym, monthCount)` with inclusive counting in `buckets.ts goalPace`) and drops the money already saved. The result was $480/mo in Funds, or $232/mo, vs $241.67 on the goal screen. The new-fund review doesn't show the starting balance.
- **Where:** `src/components/grow/goal.tsx`, `src/lib/budget/buckets.ts` (`goalPace`), `src/components/fund-wizard.tsx`.
- **Change:** the target starts blank ("Enter the price"). The due month is `shiftMonth(ym, months − 1)`, or make `goalPace` exclusive. Pick one and test it. "Make this a fund" opens the fund wizard pre-filled with name, target, date **and** opening balance = Already saved, or links to an existing fund with the same name. The review step shows "$6,200 already in it".
- **Accept:** test: target $12,000, saved $6,200, 24 months gives **$241.67/mo** on the goal screen **and** in the created fund's pace; the fund's last month is 24 months from now counting this month as month 1.

**4.5 · #32 / #135 / #89 (what's left) · Cushion: one honest definition and an explicit cushion fund.**
- **What:** The cushion divides by fixed bills while the page says "months of spending". The emergency fund is found by name only (emergency/cushion/rainy).
- **Where:** `src/lib/budget/picture.ts`, `src/components/grow/cushion.tsx`, `src/components/funds-view.tsx`, `src/lib/budget/types.ts` (fund: optional `isCushion?: boolean`).
- **Change (DECISION, default):** cushion = (savings + cash-in-wallet + cushion funds) ÷ **planned monthly spending** (`planTotal`), falling back to typical monthly spending. Label it "months of spending covered". Goal band 3–6 months. A fund has a "This is my emergency cushion" switch. The name match is only used when no fund has the switch on.
- **Accept:** test: savings $6,130 + cushion fund $1,000, plan $4,065/mo gives **1.75 months**. Today, Money and Plan show the same figure.

**4.6 · #34 / #87 · Fund pace means pace.**
- **What:** "Ahead $710.82" is money in minus money used, not progress against the schedule, and it sits next to "$90.82 extra". Setup's Used car figure ($666.67/mo) ignores the $1,650 already saved, while Funds says $483.34.
- **Where:** `src/lib/budget/buckets.ts` (`goalPace`), `src/components/funds-view.tsx:212–215`, `src/components/onboarding.tsx` (fund step).
- **Change:** ahead/behind = balance − the balance the schedule expects by today. One sentence: "You're $90 ahead of schedule" / "$120 behind" / "On schedule". Setup's monthly figure = (target − already saved) ÷ months left, the same function Funds uses.
- **Accept:** test: target $10,000 over 10 months from $0, after 3 months with $3,090 gives "$90 ahead". Setup and Funds show the same monthly figure for the Used car fund.

**4.7 · #37 / #149 (what's left) · What-if rows that change nothing are hidden, everywhere.**
- **Where:** `src/components/grow/loan.tsx` (~106), `src/components/grow/double.tsx`, `retirement-card.tsx:247–254`; new shared helper `whatIfRows()` in `src/lib/budget/`.
- **Change:** one helper builds what-if rows and drops any row whose result equals the base result (to the cent, or the same month count). Every calculator uses it.
- **Accept:** one shared test that runs every calculator's what-ifs on the fixture and asserts each shown row differs from the base and from the other rows.

**4.8 · #130 / #131 (what's left) · Follow the standard order before suggesting investing.**
- **What:** Alex has a 24.99% Visa, yet the app pushes "Put it to work". Only Put it to work warns now.
- **Where:** new `investingReadiness(myNumbers)` in `src/lib/budget/`; used by `put-to-work.tsx`, `monthly.tsx`, `double.tsx`, the Plan overview, the "Grow it" buttons from 1.5/#250, and Today.
- **Change:** it returns the first unmet step: (1) one month of spending saved; (2) no debt above 8% APR; (3) full employer match (if a match is entered); (4) 3–6 months saved. Wherever investing is suggested, show the step first: "Pay off your Visa first. It costs 24.99%, more than investing would earn." Investing content is still reachable.
- **Accept:** test: with Visa 24.99% it returns step 2 and that sentence; with no high-rate debt and 4 months saved it returns "ready".

**4.9 · #137 (what's left) · Debt: "paying $X extra saves $Y".**
- **Where:** `src/components/grow/debt.tsx`, `src/lib/budget/grow-math.ts`.
- **Change:** add a line under the result: "Paying $150 extra saves $Y in interest and N months", where Y and N compare `simulatePayoff(debts, extra)` with `simulatePayoff(debts, 0)`. Hide it when extra is 0 or blank.
- **Accept:** test on the reference debts: Y = interest(extra 0) − **$2,337.61**, N = months(extra 0) − **47**.

**4.10 · #138 / #195 (what's left) · Savings rate and labelled rules of thumb on Today.**
- **Where:** `src/components/home-dashboard.tsx` (Cushion · Saving · Net worth row), `src/lib/budget/my-numbers.ts`.
- **Change:** the Saving tile shows "7% of income" (`monthlySaving ÷ monthlyIncome`), with a small "goal 15–20%". The Cushion tile shows "goal 3–6 mo". Add a tiny 6-month trend sparkline for each tile where history exists (no chart library needed; an inline SVG is fine).
- **Accept:** test for the savings-rate function on the fixture. Tiles still pass `layout-check.mjs`.

**4.11 · #140 · Conservative, labelled default return. DECISION (default below).**
- **Change:** where a return rate box is blank and pre-filled by the app, the suggestion is **6%** nominal (was 7%), labelled "assumption". Never overwrite a rate the user typed or saved. Reference tests pass explicit rates, so they don't change.
- **Accept:** blank-profile defaults show 6%, and the existing reference tests are unchanged.

**4.12 · #156 · One compounding convention, documented. DECISION (default below).**
- **Change:** keep monthly compounding with end-of-month deposits for Put it to work, Add every month, Goal and Reach a number. Keep yearly deposits for Roth vs traditional and When work is optional, as they're designed and tested. Add a "How we calculate" line in each calculator's Assumptions ("Deposits at the end of each month" / "…of each year"). Label Doubling "compounded yearly". Write the convention in `DECISIONS.md` under "Current rules".
- **Accept:** every calculator's Assumptions says its convention. No reference number changes.

**4.13 · #203 / #236 · Retirement on the standard layout; its inputs only on Plan.**
- **What:** Retirement doesn't use the shared calculator frame. The employer match and savings goal aren't saved (so the "below your goal" tip can never appear). Retirement inputs also live in Settings.
- **Where:** `src/components/retirement-card.tsx`, `src/components/grow/retirement.tsx`, `src/components/settings-view.tsx:185–226`, `src/lib/budget/types.ts` (optional profile fields `employerMatchPercent?`, `retirementSavingGoal?`).
- **Change:** move Retirement into `CalcFrame` (question → ≤ 3 main boxes: age, saved so far, monthly saving → big answer → one chart → Fine-tune drawer with rates, inflation, retirement age, Social Security, match). Save the match and goal. Remove the Settings copy of these inputs (old saved values keep working).
- **Accept:** Settings has no retirement inputs. Retirement reference values unchanged. The "below your goal" tip appears when monthly saving < goal (test in `tips.test.ts`).

**4.14 · #217 (what's left) · Put it to work: one-tap "cash above your cushion".**
- **Where:** `src/components/grow/put-to-work.tsx`, `src/lib/budget/picture.ts`.
- **Change:** the amount stays blank. When cash − (3 × planned monthly spending) > 0, show a chip "Use $X (cash above a 3-month cushion)" that fills the box and tags it "from your accounts".
- **Accept:** test for the suggestion function: cash $20,000, plan $4,065 gives $7,805; cash below 3 months gives no chip.

**4.15 · #30 · Inflation: plain sentences and the plan.**
- **Where:** `src/components/grow/inflation.tsx`.
- **Change:** two one-line results: "Later price: $X (what today's $Y will cost)" and "Buying power: $Z (what $Y will buy then)". Default the amount from `planTotal`, not the demo's spending.
- **Accept:** the sentences show the right numbers for $1,000, 3%, 10 years (later price $1,343.92; buying power $744.09).

**4.16 · #67 · A category is a fund or a budget line, not both. DECISION (default below).**
- **What:** Groceries is a $750 fund and also a $0 category with an "add it?" suggestion.
- **Change:** a fund-linked category shows on Budget with the fund's monthly add as its amount, a "Fund" chip, and never an "Add it?" suggestion. Don't change stored data.
- **Accept:** test in `screen-plan.test.ts`: no "Add it?" idea for a fund-linked category.

**4.17 · #219 · Escape in the amount editor.**
- **Where:** `src/components/category-panel.tsx` (amount editor), `src/lib/budget/amount-input.ts` if the logic lives there.
- **Change:** the first Escape restores the old value and keeps the panel open. A second Escape closes the panel.
- **Accept:** manual check, plus a unit test for the editor's state reducer if one exists.

**4.18 · #234 · The Loan "Years" box.**
- **Where:** `src/components/grow/loan.tsx` (Years input).
- **Change:** the placeholder "5.5" → "e.g. 30". The box starts empty unless the user has a saved loan.
- **Accept:** a fresh profile's Loan page shows an empty Years box.

**4.19 · #148 (what's left), with #27 / #29 · Missing named reference tests.** (#27 Doubling and #29 Add every month are already correct; this only locks them in.)
- **Change:** add tests (or confirm and name existing ones) for: Add every month $10,000 + $200/mo @ 7% for 10 years = **$54,713.58**; Save for a goal $12,000 / $6,200 / 24 months = **$241.67**; Doubling at 7% = **10.24 years**; Inflation as in 4.15; mortgage **$1,896.20** and retirement (d) are already present, so cross-reference them in a comment.
- **Accept:** all listed values are asserted by name in `src/lib/budget/*.test.ts`.

---

### Phase 5 · Navigation, settings, danger zone, import and accounts (branch `phase-5-nav-settings`; split into 5a, 5.1–5.10, and 5b, 5.11–5.21)

**5.1 · #105 · "Reset this device" goes to a Danger zone.**
- **What:** It's red, but it still sits right next to "Download backup" and the exports, on two pages.
- **Where:** `src/components/export-bar.tsx` (~189–191), `src/routes/import.tsx`, `src/components/settings-view.tsx`.
- **Change:** remove Reset from the export bar and from Import. Settings gets a last section, "Danger zone", collapsed in a `<details>`, with "Reset this device" (type RESET to confirm, as now) and "Delete account" (signed-in). Above it, one line: "Download a backup first."
- **Accept:** `rg "Reset this device" src` matches only Settings. The type-to-confirm still works.

**5.2 · #176 · Confirm before removing an account, with Undo; Archive for accounts with imports.**
- **Where:** `src/components/account-board.tsx`, `src/store/budget-store.ts`, `src/lib/budget/types.ts` (account: optional `archived?: boolean`).
- **Change:** Remove asks "Remove Checking? Its 94 transactions stay in your budget." If the account has imports, offer **Archive** (hides it from lists and pickers, keeps totals in history) as the main choice. Show an Undo toast for 8 seconds.
- **Accept:** remove + Undo restores the account and its balances exactly (store test).

**5.3 · #235 · The Settings link works on the first click.**
- **Where:** `src/components/app-shell.tsx` (sidebar gear/link).
- **Change:** reproduce in dev (fresh load, then click Settings once). The likely cause is a click handler or an overlay (banner/FAB) intercepting, or a `<Link>` inside a button. Fix the cause.
- **Accept:** a Playwright step in `layout-check.mjs` (or a separate `nav-check.mjs`) clicks each nav item once from a fresh load and asserts the URL changes.

**5.4 · #237 / #106 · Simple is the default and really is simple.**
- **Where:** `src/components/settings-view.tsx` (Detail toggle), `src/lib/budget/normalize.ts` (profile default), `src/lib/budget/sample.ts:86`, every `nerd`/Advanced check.
- **Change:** confirm why Advanced shows on by default (the normalize default, or the toggle's initial state) and make **Simple** the default for new profiles. Don't flip a saved choice. In Simple, hide the random-markets chart, citations, what-if tables and "All the numbers". Remove any "Simple mode leaves this section out" text that shows while the section shows.
- **Accept:** test in `normalize` tests: a profile without the field normalizes to Simple. In Simple, none of those four blocks render.

**5.5 · #126 (what's left) · Motion defaults to Calm.**
- **Change:** new profiles default to Calm. Always honour `prefers-reduced-motion`. Don't change a saved choice.
- **Accept:** normalize test for the default.

**5.6 · #66 / #109 / #108 · One roll-over setting, in Settings.**
- **What:** It appears on both Budget and Settings as "When leftovers start" / "How leftover spending works".
- **Where:** `src/components/budget-amounts.tsx:33–54`, `src/components/settings-view.tsx:261–285`, `src/components/carry-start.tsx`.
- **Change:** remove the chooser from Budget. Settings shows one switch, "Unused money rolls into next month: On / Off", plus the per-category override in the category panel ("This one starts fresh" / "This one carries over"). **DECISION (default):** the "When leftovers start" start-month picker (`carry-start.tsx`) moves under Advanced, not deleted.
- **Accept:** `rg "When leftovers start|How leftover spending works" src/components` matches only Advanced-only code in Settings.

**5.7 · #181 · Tidy Settings into four sections.**
- **Where:** `src/components/settings-view.tsx` (729 lines).
- **Change:** sections **Look** (theme, text size, motion, Detail), **Household** (name, setup answers, "Reopen setup"), **Data and sign-in** (sign-in, backup, export, backup code collapsed), **Danger zone** (5.1). Shorten the backup-code explanation to two lines. Split the file into one component per section.
- **Accept:** Settings renders the 4 sections in this order. No behaviour lost (list each moved control in the merge message).

**5.8 · #125 · Undo after every change.**
- **Where:** a shared toast (one may already exist; look for "Undo" and "Restored"), `src/store/budget-store.ts`.
- **Change:** amount edits, category moves, removing a transaction/fund/account and roll-over switches show "Groceries set to $500 · Undo" for 8 seconds. Undo restores the exact previous state slice.
- **Accept:** store test: edit, then undo, gives a deep-equal earlier state for each action type.

**5.9 · #50 / #52 / #53 / #177 · Real calculator URLs, consistent menus, current page highlighted.**
- **Where:** `src/routes/grow.tsx` (and new `src/routes/grow.$question.tsx` or search-param validation), `src/components/grow/index.tsx`, `src/components/page-menu.tsx`, `src/components/app-shell.tsx`.
- **Change:** each Plan question has its own URL (`/grow/retire`, `/grow/debt`, `/grow/goal`, `/grow/cushion`, `/grow/put-to-work`, `/grow/roth`, `/grow/loan`, `/grow/work-optional`, `/grow/worth`). Old `/grow?q=debt` links redirect. The back button returns to the previous question. **Verify first** (these may be fixed by PR #9): every Budget sub-page (`/budget`, `/import`, `/year`, `/rules`, `/imports`) shows the same menu, and the nav highlights the area you're in (Import highlights Budget, not Today).
- **Accept:** `nav-check.mjs` visits each URL, checks the highlighted tab, and checks that Back works.

**5.10 · #54 · Week view (verify first).** If a week view still exists: the header shows the week ("Oct 5–11"), not "October 2026", and the picker reaches the current week. If it no longer exists, note that and skip.

**5.11 · #62 / #63 (what's left) · Budget rows: edit in place, last month's actual shown.**
- **Where:** `src/components/budget-amounts.tsx`, `src/components/category-panel.tsx`.
- **Change:** tapping the amount in a row turns it into an input right there (Enter/blur saves, Escape cancels, as 4.17). The row shows "last month $X" in small text next to the amount. The side panel stays for details.
- **Accept:** edit in the row, reload, and the value is kept (the PR #2 save logic).

**5.12 · #70 / #72 / #74 / #75 · Import happy path.**
- **Where:** `src/components/import-wizard.tsx`, `src/components/import-review.tsx`, `src/components/sort-queue.tsx`, `src/lib/budget/file-inference.ts`.
- **Change:** after the file is read, show one confirm card: "We found 94 transactions from Jul 1 to Oct 5: 8 deposits, 86 payments. Look right? [Yes] [Something's off]". Column settings ("Amount column used as-is…", "Flip the signs", the column role pickers) live behind "Something's off". Ask for the account's current balance in plain words, with an example ("What does your bank show today? e.g. 1,234.56"), and allow skip. Re-check the "19 repeating bills" count against the detection rule. Sort screen: remove "1 name covers 90 percent of what's left to sort" and "A choice for every charge from this name changes 4. 0 set by hand stay". Fix "4 CHARGES" listing only 3 (the count and the list must use the same filter).
- **Accept:** test in `file-inference.test.ts` for the deposit/payment counts on `alex_checking`-style data (the counts must add up to the total). The sort card's count equals its list length (test or manual).

**5.13 · #73 / #202 · Better category guesses.**
- **Where:** `src/lib/budget/keywords.ts`, `src/lib/budget/auto-sort.ts`, `src/lib/budget/presets.ts`.
- **Change:** built-in matches: rent and Zelle/ACH to apartments/property managers → Rent; loan servicers (Nelnet, Navient, MOHELA, Aidvantage, Great Lakes) → Student loan; card payments ("CARD PAYMENT", "AUTOPAY", "PAYMENT THANK YOU") → Debt payments; transfers to savings → Savings transfers. Never suggest Groceries for a payment over $1,000 or for a card payment. Keep "VISA CARD PAYMENT" as the display name (don't shorten it to "Payment"). Add a **Cash** category for ATM withdrawals (instead of Other). Repeating charges that match nothing don't land in Subscriptions automatically; they get "Check".
- **Accept:** tests in `keywords.test.ts`/`auto-sort.test.ts` for each rule.

**5.14 · #76 / #77 / #153 · Adding a transaction by hand; no future dates.**
- **Where:** the floating + (`app-shell.tsx`), `src/components/add-charge.tsx`, every date input.
- **Change:** **verify first** that + opens a form with amount, what for, category and a date defaulting to today, and that future dates are refused (PR #9 may have done this). Apply the same "today by default, no future unless chosen" rule to balance dates and fund dates.
- **Accept:** a store test: adding with tomorrow's date is refused or clamped. No date input defaults to anything but today.

**5.15 · #78 / #166 · "Add cash" asks for a name; no stray accounts.**
- **Where:** `src/components/account-board.tsx`, `src/store/budget-store.ts` (`addCashCharge`, `addAccount`), `src/components/category-panel.tsx`.
- **Change:** adding a cash account asks for a name (default "Cash in wallet"). Adding a cash charge never creates a "Cash · Checking" account at $0. Remove the stray "Bank text" link and the "Set by hand" label from the panel.
- **Accept:** store test: `addCashCharge` doesn't change `accounts.length`.

**5.16 · #79 · Dates read "Oct 19".**
- **Change:** one `formatDay(iso)` in `src/lib/budget/` (`Oct 19`, adding the year only when it isn't the current year). Use it for every user-visible date.
- **Accept:** `rg '\d{4}-\d{2}-\d{2}'` finds no ISO date rendered as text in components (data attributes are fine). Test for `formatDay`.

**5.17 · #175 · Account column and filter on Transactions.**
- **Where:** `src/components/budget-transactions.tsx`, `src/components/month-parts.tsx`.
- **Change:** when there's more than one account, show the account name in each row (small) and an account filter (All / each account).
- **Accept:** filtering by Savings shows only Savings rows, and the totals update.

**5.18 · #165 / #81 / #82 · Clear account types in groups.**
- **Where:** `src/lib/budget/accounts.ts`, `src/components/account-board.tsx` (Add account).
- **Change:** the Add account picker groups **Cash** (Checking, Savings, Cash in wallet), **Investments** (Brokerage, 401(k), Roth IRA, Traditional IRA, HSA, 529, Crypto) and **Debts** (Credit card, Car loan, Student loan, Mortgage, Personal loan). Old kinds map to these on load ("Roth IRA or other retirement" → Roth IRA; an existing 401(k) saved under it stays readable). Retirement = 401(k), Roth IRA, Traditional IRA; Brokerage = Brokerage, Crypto; HSA and 529 count as investments (DECISION, default: in "Brokerage & other"). Debt kinds never show the investment Return picker. Loan kinds ask for rate and minimum and feed Debt payoff (1.1) and Debts (1.2).
- **Accept:** test in `accounts` tests: every kind maps to exactly one group, and old kinds normalize without loss.

**5.19 · #174 · Match transfers between your own accounts.**
- **What:** "Transfer to HY Savings $300" out of checking should match the deposit into savings and show as "Moved to savings", never as spending or "Left out". The "Savings transfers" category is being suggested as $1,500 to move to Groceries.
- **Where:** `src/lib/budget/` (new `transfers.ts`), import review, `budget-transactions.tsx`.
- **Change:** after an import, pair rows across accounts with equal and opposite amounts within 3 days whose text mentions transfer/savings/the other account's name. Paired rows are tagged "Moved to savings" and are left out of spending and income. Unpaired outgoing transfers to savings stay in "Savings transfers". **DECISION · ask Liam first:** whether to remove the "Savings transfers" spending category completely. Don't remove it in this run.
- **Accept:** tests: a −$300 checking row and a +$300 savings row on adjacent days pair up. Spending excludes both.

**5.20 · #88 · Link savings goals to the Goal and Cushion calculators.**
- **Change:** each fund on Money has "Plan it" (opens `/grow/goal` with its target, date and balance) and, for the cushion fund, "Check cushion" (opens `/grow/cushion`).
- **Accept:** the numbers arrive pre-filled with the "from your accounts" chip.

**5.21 · #96 · Year review uses one paycheck figure.**
- **What:** It shows "every two weeks ~$1,740" next to "$3,360 typical/mo".
- **Where:** `src/components/year-home.tsx`, `src/lib/budget/year.ts`.
- **Change:** show monthly income only ("$3,360 a month"), from `myNumbers.monthlyIncome`. Pay frequency goes in the ⓘ.
- **Accept:** test in `year.test.ts`.

---

### Phase 6 · Onboarding and trust (branch `phase-6-onboarding`; split into 6a, 6.1–6.5, and 6b, 6.6–6.11)

**6.1 · #231 · `/welcome` is a 404.**
- **Where:** `src/routes/` (new `welcome.tsx`).
- **Change:** add `/welcome`, which redirects to `/` (or renders the welcome gate when there's no budget). Also add a friendly not-found page: "That page moved. [Go to Today]".
- **Accept:** `curl -I localhost:8080/welcome` isn't 404. An unknown URL shows the friendly page.

**6.2 · #243 / #265 (manifest part) · The installed app is called BudgetFlow, not "Grok App".**
- **What:** The web manifest at `/__grok/manifest.webmanifest` says "Grok App", has a black theme and one 180px icon. There's no og:image or og:description, and the meta description is old jargon ("assign every dollar a job").
- **Where:** `scripts/grok-pwa-plugin.mjs` (manifest generation; check whether it takes options from `vite.config.ts` before editing the plugin itself), `vite.config.ts`, `src/routes/__root.tsx:23` (meta), `public/` (icons).
- **Change:** manifest `name: "BudgetFlow"`, `short_name: "BudgetFlow"`, `description: "A private budget from your bank's download. No bank login."`, `theme_color`/`background_color` = the Light theme's background and primary colours, icons 192, 512 and a 512 maskable (generate PNGs from the existing BudgetFlow mark; `harbor-mark.tsx` holds the SVG). In `__root.tsx`: `<meta name="description">` = the same description; add `og:title` "BudgetFlow", `og:description` (same), `og:image` (a 1200×630 PNG in `public/og.png` with the mark and "Know what's safe to spend. No bank login."), `twitter:card` "summary_large_image", and `apple-mobile-web-app-title` "BudgetFlow".
- **Accept:** in dev, `curl localhost:8080/__grok/manifest.webmanifest` shows name BudgetFlow and 3 icons. The page head has og:image and the new description. `rg "Grok App" src scripts` is empty except in comments.

**6.3 · #256 / #254 (layout part) · Lead with privacy: pitch, trust strip, `/privacy`.**
- **Where:** `src/components/welcome-gate.tsx`, `src/routes/login.tsx`, new `src/routes/privacy.tsx`.
- **Change:** hero "Know what's safe to spend. No bank login." Below it, three trust chips: "🔒 No bank login · 📄 Works with any bank's file · 🗑 Delete anytime" (use icons with text, not emoji only). On sign-in, **Create free account** is the main button, and Sign in is secondary. `/privacy` in plain English, 6–8 short lines: what's stored where (on this device until you sign in; then one encrypted-in-transit copy in our database), no bank passwords ever, we never sell data and show no ads, how to export, how to delete. Link it from the welcome gate, sign-in and Settings.
- **Accept:** `/privacy` renders signed-out. The welcome gate and sign-in show the trust chips at 390px/150% without wrapping off-screen.

**6.4 · #90 · One clear start.**
- **Where:** `src/components/welcome-gate.tsx`.
- **Change:** one big "Start my budget" button, a small "Just look around with sample data" link, and "Sign in" in the corner. Move "Restore a backup" to Settings → Data.
- **Accept:** the welcome gate has exactly one primary button.

**6.5 · #257 / #91 / #183 / #92 / #93 / #94 / #95 / #155 · First useful number in under 2 minutes; a 4-screen setup.**
- **What:** Setup is 7 steps (1,042 lines) before any value. Income is asked in several formats. Reopening setup shows nothing selected. A rent change in step 1 doesn't reach step 5. There's no running total.
- **Where:** `src/components/onboarding.tsx`, `src/lib/budget/onboarding-plan.ts`, `src/components/welcome-gate.tsx`, `src/components/import-wizard.tsx`.
- **Change:**
  1. Add a **file-first path**: "Start with your bank file" → import (5.12's happy path) → Today shows Safe to spend estimated from the file (detected income and typical spending), labelled "estimate". Then show 3 "Make this more accurate" cards (take-home pay, rent, other bills) on Today.
  2. The questions path becomes **4 screens**: take-home pay ("How much lands in your account each month?", pay frequency optional), rent or mortgage, other bills (with a running "Left over: $X" as you type), and "Import your bank file, or skip". Keep everything else (funds, roll-over style, accounts) as optional cards after setup.
  3. Setup is **one form state** (one reducer/object), so Back and Next never lose values, a change in one screen shows on later screens, and "Reopen setup" pre-fills the saved answers.
  4. Keep `applyCompleteSetup`'s data rules (demo wipe, setup income as expected income; PR #9 behaviour).
- **Accept:** tests in `onboarding-plan.test.ts`: changing rent to $1,350 on screen 2 shows $1,350 in the summary; reopening setup returns the saved answers. Manually: from a fresh device, the file-first path reaches a Safe to spend number in 4 taps or fewer after choosing the file.

**6.6 · #182 · "Get started" checklist on Today.**
- **Change:** for the first days, Today shows a 5-item checklist (Add a bank file · Sort the top names · Confirm the plan · Add a balance · Set a goal), each ticked from real state. It disappears when done or dismissed, and replaces the scattered prompts.
- **Accept:** a unit test of the checklist-state function on an empty budget and on the fixture.

**6.7 · #258 · A demo that sells.**
- **Where:** `src/lib/budget/sample.ts`, new `src/routes/demo.tsx`.
- **Change:** re-tune the sample so the month is positive (Safe to spend > 0), there's a debt-free date, a reached goal and no contradictions (all Phase 1 tests run on it). Add a 4-stop tour (Safe to spend → a category row → Money's net worth → Plan's debt-free date), skippable. `/demo` loads the sample **into memory only**. It must never read, write or overwrite `harbor-ledger-v3` or any saved budget.
- **Accept:** a test that the sample's `safeBreakdown(...).safe > 0`. Opening `/demo` with an existing saved budget leaves localStorage byte-for-byte unchanged (check in `nav-check.mjs`).

**6.8 · #143 · Back-up reminder for on-device budgets.**
- **Change:** for signed-out budgets with at least one import, show a gentle card once a week: "Your budget lives only in this browser. [Download backup] [Create free account]". Remember the dismiss date under a new UI key.
- **Accept:** the reminder-timing function is tested (shows after 7 days, not before).

**6.9 · #144 (help part) / #252 · "How to get your bank file" help.**
- **Where:** `src/routes/help.tsx` (from Phase 3), `src/components/import-wizard.tsx:492–537`.
- **Change:** move the bank-by-bank steps (Chase, Bank of America, Wells Fargo, Capital One, and the others in `import-wizard.tsx:492–516`) to `/help#csv`, one short numbered list per bank, in text only. Import keeps a collapsed "How to get your bank file →" link.
- **Accept:** `/help#csv` renders signed-out. Import shows no bank lists unless the details block is expanded.

**6.10 · #104 / #188 · Friendly empty, loading and error states.**
- **Change:** every empty state has one sentence and one button (see the KEEP list in Phase 3). Empty Plan pages show example numbers labelled "example". Every error message says what to do next.
- **Accept:** list each screen's empty state in the merge message. No empty screen is only a heading.

**6.11 · #179 (what's left) · Slow loads.**
- **What:** Pages hung on "Opening BudgetFlow…" and some loads timed out.
- **Change:** measure (`vite build` output chunk sizes, and the time from first byte to the first real screen in `npm run dev` with the sample). Code-split Plan and Recharts (lazy routes), and make sure the signed-in load in `persist.ts` has a timeout with a friendly retry ("Taking longer than usual. [Try again] [Use this device's copy]").
- **Accept:** the main entry chunk is smaller than before (write both sizes in the merge message). The load timeout path is tested or shown manually.

---

### Phase 7 · Growth features that need no outside accounts (branch `phase-7-growth`; split per task if needed)

**7.1 · #259 · Share cards without amounts.**
- **Where:** new `src/lib/budget/share-card.ts` (text builder) and `src/components/share-card.tsx` (renders SVG → PNG with canvas; no new dependency).
- **Change:** four cards: "Debt-free by Aug 2028", "On plan in 7 of 9 categories this month", "Goal reached: Used car", "Work optional at 41". **Amounts are off by default.** An "Include amounts" switch is off each time. Footer: "Made with BudgetFlow · no bank login". Share with the Web Share API (files) where available, otherwise download the PNG. The entry points are a small "Share" on the matching result.
- **Accept:** a test that the text builder produces no "$" or digits-with-commas when amounts are off. Manually: the PNG renders at 1080×1080.

**7.2 · #262 (with #50) · Public calculator pages for search.**
- **Where:** new routes `src/routes/calculators.index.tsx` and `src/routes/calculators.$name.tsx`; `public/robots.txt`; a `sitemap.xml` route or a static file.
- **Change:** `/calculators/debt-payoff`, `/calculators/retirement`, `/calculators/loan`, `/calculators/savings-goal`, `/calculators/compound-growth`, `/calculators/emergency-fund`. They work signed-out, with **no access to the user's saved budget** (they use their own in-memory state). They use the same `src/lib/budget` math, are server-rendered with a unique title, description and og tags, show one worked example with the reference numbers (for example the debt example: 47 months, $2,337.61), and have a "Use your real numbers → Start my budget" button. Add `sitemap.xml` listing them, plus `/`, `/privacy`, `/help`, `/demo`.
- **Accept:** each page renders with JavaScript disabled (SSR) and shows the worked example; `sitemap.xml` lists every page; visiting a page doesn't change localStorage.

**7.3 · #264 / #145 · Privacy-safe funnel events (client side only). DECISION · ask Liam first for where events are stored.**
- **Where:** new `src/lib/analytics.ts`.
- **Change:** `track(name, props?)` with a fixed list of event names: `landing_view`, `demo_open`, `import_start`, `import_done`, `first_safe_to_spend` (activation), `signup`, `second_month_import` (retention), `share_card`, `invite_sent`, `setup_done`, `setup_quit_step_N`. Props allow only enums and booleans: **never amounts, merchants, names, emails or free text** (enforced by the type and a runtime filter). Add the calls at those points. The sink is a no-op unless `VITE_ANALYTICS_ENDPOINT` is set. Don't add a database table or a third-party script in this run.
- **Accept:** a test that `track` drops any numeric or string prop not in the allow-list. With no env var, there are zero network requests.

**7.4 · #265 (install part) · Prompt "Add to Home Screen" after the first import.**
- **Change:** after the first successful import, show a one-time card: on Chrome/Android use `beforeinstallprompt`; on iOS Safari show "Tap Share, then Add to Home Screen". Remember the dismissal under a new UI key. **Offline viewing (a service worker) is not in this run**; see Later.
- **Accept:** the card shows once and never again after dismiss.

**7.5 · #260 (interim) · "Send a copy to a partner".**
- **Change:** in Settings → Data: "Send a copy" downloads the backup file and opens the share sheet (or mailto) with a short text and a link to the app. No amounts in the text. Say plainly that it's a copy, not a shared budget.
- **Accept:** the share text has no numbers. The backup restores on another browser.

**7.6 · #261 (in-app part) · Monthly recap and "time to import" nudge.**
- **Change:** on the first visit of a new month, Today shows a recap card for last month: "On plan in 7 of 9 categories · Saved 7% · Biggest change: Eating out −$80", with Share (7.1). When the last import is more than 30 days old, show "Time to add this month's bank file". Show the streak "3 months in a row" from import dates (derived, not stored).
- **Accept:** tests for the recap builder and the streak count on the fixture.

---

### Phase 8 · Needs Liam: plan only, don't build (branch `phase-8-plans`, docs only)

For each item, write `docs/plans/<topic>.md` (1–2 pages): the user problem, the proposed design, the data/storage changes, outside services and costs, privacy impact, a rough effort (S/M/L), the risks, and the exact questions for Liam. Merge it into `main` and push like any other phase, before the final deploy commit. Each 8.x task's progress status is "Waiting on Liam (Dn)" once its plan is written. **No code, no migrations, no new accounts, no keys.**

**8.1 · #261 · Monthly recap and reminder emails via Resend.** Needs Liam's Resend account, a sending domain, `RESEND_API_KEY` and `HARBOR_FROM_EMAIL` set in Vercel, an unsubscribe link, and a scheduled job (Vercel Cron). Email bodies follow 7.1's no-amounts default.
**8.2 · #260 (full) · A shared household budget.** Needs a storage change: today it's one JSON payload per user; this needs a household id, members, invites, and conflict handling when two people edit. List the migration and the rollback.
**8.3 · #263 · Pricing.** Free core (import, budget, Today, calculators). Plus at about $3–4/mo or $29/yr (sync, household, recaps, share cards without the footer). Lifetime about $59. No ads, no data selling. Needs a payment provider (e.g. Stripe), entitlements and tax handling.
**8.4 · #172 / #171 / #196 / #170 · Investments.** Phase 1: contributions vs growth per account, from balance updates and deposits, and net worth over time split the same way (first check whether balance history is already kept for every "Update balance"; #170). Phase 2: holdings (ticker, shares, cost basis) with daily prices from a market-data API (key and cost), allocation mix, and an optional broker CSV import.
**8.5 · #144 (sync part) · Automatic bank syncing (Plaid or similar).** Write it down as a trade-off: it conflicts with the "No bank login" promise that the growth plan leads with. Recommend staying CSV-only unless Liam decides otherwise.
**8.6 · #190 · Remove "released" money.** Money leaving a category always goes somewhere: a fund, or an automatic "Extra savings" pool, so "saved this year", fund balances, Safe to spend and Left all agree. This changes the money model and stored data.
**8.7 · #264 (sink) · Where funnel events are stored:** a first-party table (a migration) vs Vercel Web Analytics custom events (needs enabling on Liam's account) vs nothing.
**8.8 · #265 (later) · Offline viewing and app stores:** a service worker (risk: stale versions after deploys) and a store wrapper (L).

---

## 5. Decisions for Liam

**D1–D10: build the default unless Liam says otherwise. D11–D20: ask Liam first, and don't build in this run.**

| ID | Task | Question | Default built in this run |
|---|---|---|---|
| D1 | 1.3 #223 | Should Safe to spend and Left be one number, or two with the reason shown? | Two numbers tied by `safe = left − still planned − funds still to add`, shown in the "?" |
| D2 | 1.1 #214 | How should old stored debts with no origin be treated? | As Money loans, unless they match a card account by name or balance (then calculator-only). Nothing deleted |
| D3 | 1.4 #64/#189 | Should fixed bills start fresh each month? | Yes for new budgets. Existing budgets get a one-tap suggestion |
| D4 | 1.2 #225 | Should Retirement's "saved so far" include brokerage? | Yes, labelled "Invested so far (retirement + brokerage)" with the split in ⓘ |
| D5 | 4.5 #32 | What does the cushion divide by? | Planned monthly spending, falling back to typical spending; "months of spending"; an explicit cushion switch on funds |
| D6 | 4.11 #140 | What's the default expected return? | 6% nominal for app-filled boxes only, labelled "assumption" |
| D7 | 4.12 #156 | One compounding method app-wide? | Keep monthly vs yearly as designed, and label each page |
| D8 | 5.6 #108 | Keep the "When leftovers start" picker? | Keep it, under Advanced |
| D9 | 4.16 #67 | Can a category be a fund and a budget line? | A fund-linked category shows the fund's add, with no "Add it?" |
| D10 | 5.18 #165 | Where do HSA and 529 go? | Investments → "Brokerage & other" |
| D11 | 5.19 #174 | Remove the "Savings transfers" spending category? | Ask first. Kept; transfers matched instead |
| D12 | 7.3 / 8.7 #264 | Where are funnel events stored? | Ask first. Client helper only, no sink |
| D13 | 8.1 #261 | Set up Resend for recap emails? | Ask first (needs his account and domain) |
| D14 | 8.2 #260 | Build a shared household budget (storage change)? | Ask first |
| D15 | 8.3 #263 | Pricing and payments? | Ask first |
| D16 | 8.4 #172 | Investment holdings with a paid market-data API? | Ask first |
| D17 | 8.5 #144 | Bank sync vs "no bank login"? | Ask first; the recommendation is to stay CSV-only |
| D18 | 8.6 #190 | Remove "released" money (money-model change)? | Ask first |
| D19 | #141 / #142 | Product focus: is Plan a bonus to an excellent budget, and should calculators be cut? | Ask first. Nothing removed in this run |
| D20 | #42 | A "Use my plan / Use my real spending" switch on calculators? | Ask first. Not built; 4.1's chips say which is used |

---

## 6. Later / backlog (low priority; don't build unless a phase finishes early)

Keep these open. List them in your final report as "not started".
- **Verify only (probably fixed by PR #9):** #163 accounts live only on Money (Settings just links there), #52 / #53 / #177 menus and highlighting (in 5.9), #58 Home contradictions, #180 the old Home layout (replaced by Today), #220 empty "Key numbers" heading, the "Harbor" theme label (#222; it now reads "Light"), #170 balance history, #76 / #77 the + form and future dates (in 5.14). Report each as "verified fixed" or "still open".
- **Visual consistency:** #124 one green/amber/red rule everywhere; #128 one big number per card and at most two lines of small text; #102 "one screen, one question, one answer" (the guiding rule for Phases 3–4).
- **Explaining controls:** #185 category change as a live preview ("Move 4 Amazon charges to Gifts" with this one / this month / always); #186 a waterfall chart behind Safe to spend (income → bills → spending → funds → left), which builds on 1.3's breakdown.
- **Roll-over chosen by the data:** #189 (the rest): the app picks each category's roll-over from its data, with a one-line reason.
- **New features:** #191 90-day cash calendar; #192 Bills and subscriptions page; #193 merchant explorer; #194 category analytics (weekday, time of month); #197 debt tracked from loan payments in imports; #198 goal chance of hitting the date; #199 what-if sandbox; #200 paycheck planner; #201 import gap detection and reconciliation; #204 take-home pay calculator and end-of-year review.
- **Engineering:** #147 / #208 automated end-to-end tests (setup, import, sorting, carry-over, amount editing with reload, account totals; Playwright is installed); #209 keyboard and screen-reader pass; #210 split the oversized files (month-parts 796 lines, category-panel 634, import-wizard 624, settings 729, onboarding 1,042), partly done by 5.7 and 6.5; #211 shrink `DECISIONS.md` to "Current rules" and update `README.md` to the four areas; #205 open the exported workbook in LibreOffice as a build check; #206 fix the production preview build (it fails on a missing PGLite data file).
- **Product process (for Liam, not code):** #146 test with 3–5 real non-technical people before each major release; #145 the success measures are defined in 7.3.

---

## 7. Definition of done for the whole run

The run is done when:
1. Phases 0–7 are each merged into `main` and pushed, and the Phase 8 docs are merged and pushed. Each phase's merge message has the plan, the tasks done (by ID), the tests added, the checks run with results, what to check by hand, and "Decisions taken (default)".
2. On `main` (and on each phase branch before its merge): `npm run typecheck` passes, `npm run lint` has 0 errors and no new warnings, all app tests pass (including the new ones, all added to the `test` script), and `npx vite build` passes. `npm test` passes after 0.4.
3. Every reference number in rule 9 still passes, unchanged.
4. On the sample budget and the Alex fixture: Safe to spend, Left, net worth, debts, cushion, retirement saved, monthly saving and the plan total show the same figures on every screen that shows them (`household.test.ts`).
5. `layout-check.mjs` passes at 390 and 465 wide with 150% text on the listed pages, and `nav-check.mjs` passes.
6. No user-visible developer text, no "Grok App", no "assign every dollar a job", and no stale area names (the Phase 3 `rg` checks are clean).
7. No commit or merge message you wrote contains `[deploy]`. (`main` already has one older commit, "Verify deploy trigger [deploy]", from setting up the deploy gate before this run. Ignore that one.) Check: `git log $(git log origin/main --format=%H --grep='Verify deploy trigger' -1)..origin/main --format=%B | grep -c '\[deploy\]'` prints 0. No storage key, migration, env var name, repo or URL was renamed. No migration was added. No saved data was deleted.
8. Phase 8 exists only as docs in `docs/plans/`.
9. **Final coverage audit passes:** in `docs/grok-progress.md` there are **no `[ ]` rows**. Every row is Done (commit hash), Verified already fixed, Waiting on Liam (Dn), or Backlog. Check with `grep -c '^- \[ \]' docs/grok-progress.md` (must print 0). Compare the IDs in the progress file with every `#NNN` and `N.N` ID in this brief (`grep -oE '#[0-9]{2,3}' docs/BudgetFlow_Grok_Prompt.md | sort -u`) and add any that are missing.

### The final step: the one deploy commit

Only when items 1–9 are all true on `main`:
1. `git checkout main && git pull --ff-only && git status` (it must be clean).
2. Run the full checks one last time on `main`: `npm run typecheck`, `npm run lint`, the app tests, `npm test`, `npx vite build`. **If any check fails, do NOT push the deploy commit.** Fix it in a normal commit (no `[deploy]`), push, and re-run. If you can't fix it, stop and report instead.
3. Commit the final `docs/grok-progress.md` update (no `[deploy]` in that message), and push.
4. Then push **exactly one** empty commit:
   ```
   git commit --allow-empty -m "Ship BudgetFlow updates [deploy]"
   git push origin main
   ```
   This triggers the single production deploy. Don't push anything else after it. Don't make a second deploy commit. If the deploy fails, report it; don't retry with another `[deploy]` commit (Liam will look at the Vercel logs).

**Final report** (print it at the end, plain text):
- One line per phase: its merge commit hash on `main`, and status (done / partly done).
- The hash of the deploy commit, or why it wasn't pushed.
- A table of every task ID: done / verified already fixed / partly done (what's left) / blocked (why) / skipped (why).
- The results of the checks (typecheck, lint warnings count, app test count, `npm test`, `vite build`) on the last branch.
- Every DECISION default you took, and the open "ask Liam first" questions (D11–D20) with anything you learned that helps him decide.
- Anything you found that isn't in this brief (new bugs), with where and how to reproduce.
- Every item skipped, moved to Backlog or left Waiting on Liam, and why.
- What Liam should check by hand on production after the deploy, in order.
