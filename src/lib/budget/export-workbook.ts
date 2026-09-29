import { monthLabel } from "./parse-date.ts";
import { findRecurringAll } from "./recurring.ts";
import { monthlySeries, plannedTotals, sumByCategory } from "./totals.ts";
import type { Category, Profile, Transaction } from "./types.ts";

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function xmlEscape(s: string) {
  return String(s)
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function catName(categories: Category[], id: string | null) {
  return categories.find((c) => c.id === id)?.name ?? "";
}

export function transactionsCsv(transactions: Transaction[], categories: Category[]): string {
  const lines = ["date,description,amount,category,merchant,source,status,excluded"];
  for (const t of transactions) {
    lines.push(
      [
        t.date,
        csvEscape(t.description),
        t.amount.toFixed(2),
        csvEscape(catName(categories, t.categoryId)),
        csvEscape(t.merchantKey),
        csvEscape(t.sourceLabel),
        t.status,
        t.excluded ? "yes" : "no",
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function sheetsTsv(transactions: Transaction[], categories: Category[]): string {
  const lines = ["Date\tDescription\tAmount\tCategory\tMerchant"];
  for (const t of transactions) {
    lines.push(
      [t.date, t.description.replace(/\t/g, " "), t.amount.toFixed(2), catName(categories, t.categoryId), t.merchantKey].join(
        "\t",
      ),
    );
  }
  return lines.join("\n");
}

export function similarAppCsv(transactions: Transaction[], categories: Category[]): string {
  const lines = ["Date,Payee,Category,Memo,Amount"];
  for (const t of transactions) {
    lines.push(
      [t.date, csvEscape(t.description), csvEscape(catName(categories, t.categoryId)), "", t.amount.toFixed(2)].join(","),
    );
  }
  return lines.join("\n");
}

type Cell = { type: "String" | "Number"; value: string | number };

function cellXml(cell: Cell): string {
  if (cell.type === "Number") {
    const n = typeof cell.value === "number" ? cell.value : Number(cell.value);
    return `<Cell><Data ss:Type="Number">${Number.isFinite(n) ? n : 0}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(String(cell.value))}</Data></Cell>`;
}

export function ledgerCsv(transactions: Transaction[], categories: Category[]): string {
  const lines = ["Date,Description,Income,Expense,Category,Counts"];
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  for (const t of sorted) {
    const income = t.amount > 0 ? t.amount.toFixed(2) : "";
    const expense = t.amount < 0 ? Math.abs(t.amount).toFixed(2) : "";
    const counts =
      t.excluded || t.status === "transfer"
        ? "Left out"
        : t.status === "reimbursement"
          ? "Payback"
          : t.status === "refund"
            ? "Money back from a store"
            : "Yes";
    lines.push(
      [t.date, csvEscape(t.description), income, expense, csvEscape(catName(categories, t.categoryId)), counts].join(","),
    );
  }
  return lines.join("\r\n");
}

function sheetXml(name: string, rows: Cell[][]): string {
  const cols = Math.max(1, ...rows.map((row) => row.length));
  const body = rows.map((row) => `<Row>${row.map(cellXml).join("")}</Row>`).join("");
  const safe = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
  return `<Worksheet ss:Name="${xmlEscape(safe)}"><Table ss:ExpandedColumnCount="${cols}" ss:ExpandedRowCount="${Math.max(rows.length, 1)}">${body}</Table></Worksheet>`;
}

export function spreadsheetXml(opts: {
  profile: Profile;
  categories: Category[];
  transactions: Transaction[];
}): string {
  const { profile, categories, transactions } = opts;
  const months = monthlySeries(transactions, categories);
  const plan = plannedTotals(categories);
  const lastYm = months.length ? months[months.length - 1].ym : "";
  const exp = lastYm ? sumByCategory(transactions, lastYm, "expense", categories) : new Map<string, number>();
  const inc = lastYm ? sumByCategory(transactions, lastYm, "income", categories) : new Map<string, number>();
  const rec = findRecurringAll(transactions);

  const overview: Cell[][] = [
    [{ type: "String", value: profile.ledgerName || "Harbor Ledger" }],
    [{ type: "String", value: "Import this file in Google Sheets: File → Import → Upload. Also opens in Excel and Numbers." }],
    [],
    [{ type: "String", value: "Planned income" }, { type: "Number", value: plan.income }],
    [{ type: "String", value: "Planned expenses" }, { type: "Number", value: plan.expenses }],
    [{ type: "String", value: "Planned leftover" }, { type: "Number", value: plan.leftover }],
  ];

  const monthHeader: Cell[] = [
    { type: "String", value: "Category" },
    { type: "String", value: "Kind" },
    { type: "String", value: "Monthly plan" },
    ...months.map((m) => ({ type: "String" as const, value: monthLabel(m.ym) })),
  ];
  const byMonth = months.map((m) => ({
    ym: m.ym,
    inc: sumByCategory(transactions, m.ym, "income", categories),
    exp: sumByCategory(transactions, m.ym, "expense", categories),
  }));
  const pivot: Cell[][] = [monthHeader];
  for (const c of categories) {
    const row: Cell[] = [
      { type: "String", value: c.name },
      { type: "String", value: c.kind },
      { type: "Number", value: c.plannedMonthly },
    ];
    for (const m of byMonth) {
      const map = c.kind === "income" ? m.inc : m.exp;
      row.push({ type: "Number", value: Math.round((map.get(c.id) ?? 0) * 100) / 100 });
    }
    pivot.push(row);
  }

  const monthlyRows: Cell[][] = [
    [
      { type: "String", value: "Month" },
      { type: "String", value: "Income" },
      { type: "String", value: "Expenses" },
      { type: "String", value: "Net" },
      { type: "String", value: "Uncategorized" },
    ],
    ...months.map((m) => [
      { type: "String" as const, value: monthLabel(m.ym) },
      { type: "Number" as const, value: Math.round(m.income * 100) / 100 },
      { type: "Number" as const, value: Math.round(m.expenses * 100) / 100 },
      { type: "Number" as const, value: Math.round(m.net * 100) / 100 },
      { type: "Number" as const, value: m.uncategorized },
    ]),
  ];

  const txRows: Cell[][] = [
    [
      { type: "String", value: "Date" },
      { type: "String", value: "Description" },
      { type: "String", value: "Amount" },
      { type: "String", value: "Category" },
      { type: "String", value: "Merchant" },
      { type: "String", value: "Source" },
    ],
    ...transactions.map((t) => [
      { type: "String" as const, value: t.date },
      { type: "String" as const, value: t.description },
      { type: "Number" as const, value: t.amount },
      { type: "String" as const, value: catName(categories, t.categoryId) },
      { type: "String" as const, value: t.merchantKey },
      { type: "String" as const, value: t.sourceLabel },
    ]),
  ];

  const planRows: Cell[][] = [
    [
      { type: "String", value: "Category" },
      { type: "String", value: "Kind" },
      { type: "String", value: "Plan" },
      { type: "String", value: lastYm ? `Actual ${monthLabel(lastYm)}` : "Actual" },
    ],
    ...categories.map((c) => {
      const actual = c.kind === "income" ? (inc.get(c.id) ?? 0) : (exp.get(c.id) ?? 0);
      return [
        { type: "String" as const, value: c.name },
        { type: "String" as const, value: c.kind },
        { type: "Number" as const, value: c.plannedMonthly },
        { type: "Number" as const, value: Math.round(actual * 100) / 100 },
      ];
    }),
  ];

  const recRows: Cell[][] = [
    [
      { type: "String", value: "Direction" },
      { type: "String", value: "Merchant" },
      { type: "String", value: "Interval" },
      { type: "String", value: "Count" },
      { type: "String", value: "Typical amount" },
      { type: "String", value: "Category" },
      { type: "String", value: "Last date" },
    ],
    ...rec.map((g) => [
      { type: "String" as const, value: g.direction === "in" ? "In" : "Out" },
      { type: "String" as const, value: g.sampleDescription },
      { type: "String" as const, value: g.interval },
      { type: "Number" as const, value: g.count },
      { type: "Number" as const, value: g.avgAmount },
      { type: "String" as const, value: catName(categories, g.categoryId) },
      { type: "String" as const, value: g.lastDate },
    ]),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${sheetXml("Overview", overview)}
${sheetXml("By category", pivot)}
${sheetXml("Months", monthlyRows)}
${sheetXml("Transactions", txRows)}
${sheetXml("Plan", planRows)}
${sheetXml("Repeating", recRows)}
</Workbook>`;
}
