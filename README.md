# Harbor Ledger

A private budget ledger. Import a bank CSV, set categories from your household, mark refunds and transfers, and review week-to-week or month-to-month. Nothing logs into a bank.

## How it works

1. Answer the household setup (income, housing, what you actually pay for).
2. Create an account so that setup is saved.
3. Import a CSV from your bank and correct categories as you go.

Sign-in: Google, X, or email. Email accounts get a recovery code instead of reset mail.

## Run locally

```bash
npm install
npm run dev
```

The app expects Postgres in production (`DATABASE_URL`). Locally it falls back to an in-memory database.

## Deploy on Vercel

Required environment variables (Project → Settings → Environment Variables):

| Name | Notes |
| --- | --- |
| `DATABASE_URL` | Neon (or any Postgres) connection string |
| `BETTER_AUTH_SECRET` | Long random string |
| `BETTER_AUTH_URL` | The live site URL, e.g. `https://your-app.vercel.app` |
| `VITE_AUTH_ENABLED` | `true` |

Build command is `npm run build`. That also applies database migrations.

Create a Neon project, paste `DATABASE_URL`, then redeploy.
