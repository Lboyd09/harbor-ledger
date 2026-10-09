# BudgetFlow

Current work order: docs/BudgetFlow_Grok_Prompt.md — read it fully before starting.

Personal budgeting app with four areas: Today, Budget, Money, and Plan. Settings is a gear, not a fifth tab. Deployed on Vercel. Every push to `main` goes live in production.

Nothing connects to a bank. Import a CSV, sort the charges, and keep the ledger on this device until sign-in. A signed-in ledger is one JSON payload per user in Postgres.

`README.md` and `DECISIONS.md` still describe the older five tabs (Home, Budget, Funds, Grow, Account). The live nav is `src/components/app-shell.tsx`.

## Stack

- React 19, TypeScript, Vite 8, TanStack Start, TanStack Router
- Tailwind CSS 4
- Zustand for the ledger, Zod, Better Auth
- Postgres: Neon when `DATABASE_URL` is set, otherwise in-memory PGLite
- Production build uses Nitro with `preset: "vercel"` in `vite.config.ts`
- Tests use Node's built-in runner (`node --test`)

## Commands

Copied from `package.json`. Run these. Do not invent replacements.

- Install: `npm install`
- Dev: `npm run dev` — `node scripts/with-app-env.mjs vite dev --host 0.0.0.0 --port 8080`
- Type-check: `npm run typecheck` — `tsc --noEmit`
- Lint: `npm run lint` — `eslint .`
- Test: `npm test` — `node --test 'scripts/**/*.test.mjs' && node --experimental-strip-types --test` and the `src/lib/**/*.test.ts` files named in the `test` script
- Build: `npm run build` — `node scripts/with-app-env.mjs vite build && npm run db:migrate`

Dev listens on `0.0.0.0:8080`. Leave that host and port alone.

## Where things live

- Pages: `src/routes/`. `/` is Today (`home-dashboard.tsx`). `/budget` is Budget, with `?page=amounts` and `?page=transactions`. Import, year, sorting, and past imports are `/import`, `/year`, `/rules`, and `/imports`, and they stay under Budget. `/funds` is Money (Goals, Accounts, Net worth). `/grow` is Plan. `/settings` is Settings. `/login`, `/reset`, and `/confirm` are signed-out pages.
- UI: `src/components/`. Plan calculators are `src/components/grow/`.
- State: `src/store/budget-store.ts`. Unsigned ledgers persist in localStorage as `harbor-ledger-v3`. Signed-in load and save go through `src/lib/budget/persist.ts`.
- Money math: `src/lib/budget/`. One month total comes from `monthLedger` in `ledger-month.ts`. Screens read that result. They do not add their own month total. Display formatting is `formatMoney` in `money.ts`. Blank number boxes use `readNumber` in `calc-input.ts`. Roth, debt payoff, and growth are `grow-math.ts`. Retirement is `retirement.ts`. When work is optional is `work-optional.ts`. IRA limits are `ira.ts`.

## Editing

You may change, refactor, or rewrite any file when the task needs it, or to fix a real problem you find.

Small and medium changes: do them, then say what you changed.

Big changes: explain the plan and ask first. Big means redesigning a whole page, changing how data is stored, deleting a feature, adding a dependency, or touching more than about 10 files.

## Money

Keep money math in its own functions under `src/lib/budget/`, not inside components. Round to cents only for display (`formatMoney`). A blank input is missing. It must not become `NaN` or a wrong `$0`. A zero someone typed stays zero. `simulatePayoff` rounds each month's interest to the cent because that is how a card charges interest. Do not round a running balance anywhere else.

## Done

`npm run typecheck` and `npm run build` both pass. List every file you changed, and anything to test by hand.

## Workflow

One task per session. Make a new git branch for that task, commit, and push it. Never commit straight to `main`.

For a large feature, show a short plan before coding.

## Helper agents

Do not run helper agents on your own. Use `reviewer`, `tester`, or `math-checker` in `.grok/agents/` only when asked, or when the task is a large feature or it changes money math.

- `reviewer` is read-only. It reviews the current git diff against the task.
- `tester` runs type-check, lint, test, and build, and may add or fix tests.
- `math-checker` is read-only. It checks budget, savings, Roth, and debt-payoff math in the diff with numbers worked by hand.
