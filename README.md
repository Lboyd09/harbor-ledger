# BudgetFlow

BudgetFlow is a private budget you keep on this device. You import a bank file, sort the charges, and see the month and the year. Nothing connects to a bank.

## The five tabs

- **Home** is the year. The menu on the title also opens the year review, an import, sorting rules, and past imports.
- **Budget** is the month. The menu opens the amounts and the charges.
- **Funds** is money set aside for one purchase. It is not the budget.
- **Grow** asks what you want to do, then opens one calculator at a time.
- **Account** is you, the file, the look, and the export.

## One calculation

Every screen and the workbook read the same month and the same year. A screen does not add up its own total.

## Import

Use Home or Account and choose a CSV from your bank. BudgetFlow sorts a charge when it is sure, marks a fair guess as Check, and leaves the rest for you. You can change one charge, one month, or the default for that name.

## Export

Account has three downloads: Excel, Google Sheets, and CSV. Excel and Google Sheets are the same workbook. The year total matches Home. Google Sheets: File, Import, Upload, then Replace spreadsheet.

## Checks

```bash
npm install
npm run dev
npm run typecheck
npm run lint
```

The unit tests are listed in `package.json` under `test`. Run that list with `node --experimental-strip-types --test` and the files named there.
