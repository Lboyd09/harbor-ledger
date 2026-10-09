# BudgetFlow

BudgetFlow is a private budget you keep on this device. You import a bank file, sort the charges, and see what you can spend. Nothing connects to a bank.

## The four areas

- **Today** is safe to spend, what needs you, and bills coming up.
- **Budget** is this month, the transactions, and an import. Year, sorting, and past imports sit under More.
- **Money** is goals, accounts, and net worth.
- **Plan** is five questions: retire, debt, a goal, growing money, and Roth or traditional.

Settings is the gear. It is not a fifth tab.

## One calculation

Every screen and the workbook read the same month and the same year. A screen does not add up its own total.

## Import

Use Budget or Settings and choose a CSV from your bank. BudgetFlow sorts a charge when it is sure, marks a fair guess as Check, and leaves the rest for you. You can change one charge, one month, or the default for that name.

## Export

Settings has three downloads: Excel, Google Sheets, and CSV. Excel and Google Sheets are the same workbook. The year total matches the year page. Google Sheets: File, Import, Upload, then Replace spreadsheet.

## Checks

```bash
npm install
npm run dev
npm run typecheck
npm run lint
```

The unit tests are listed in `package.json` under `test`. Run that list with `node --experimental-strip-types --test` and the files named there.
