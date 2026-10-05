import { latestBalance } from "./accounts.ts";
import { bucketBalance } from "./buckets.ts";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as XLSX from "xlsx";
import { displayMerchant } from "./merchant.ts";
import { monthLabel } from "./parse-date.ts";
import { categoryLabel } from "./plans.ts";
import { FIGURES } from "./reference.ts";
import { yearLedger, type LedgerSource } from "./ledger-month.ts";
import { piecesOf } from "./splits.ts";
import type { Account, BalancePoint, BucketMove, Category, DebtItem, IraRules, MerchantRule, MoneyBucket, MonthBudget, NetWorthPoint, Profile, SavingsGoal, SetAside, Transaction } from "./types.ts";

type Cell = string | number | { v: string | number; f?: string; z?: string };

const CUR = '"$"#,##0.00';
const PCT = "0.00%";
const DATE = "yyyy-mm-dd";

const SHEETS = [
  "Start here",
  "Home year",
  "Budget month",
  "Categories",
  "Funds",
  "Accounts",
  "Net worth",
  "Debts",
  "Transactions",
  "Rules",
  "Charts",
  "Assumptions",
] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function money(n: number): Cell {
  return { v: round2(n), z: CUR };
}

function formula(v: number, f: string): Cell {
  return { v: round2(v), f, z: CUR };
}

function dateCell(iso: string): Cell {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  const serial = Date.UTC(year, month - 1, day) / 86400000 + 25569;
  return { v: serial, z: DATE };
}

function colLetter(index: number) {
  let s = "";
  let n = index + 1;
  while (n) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function toSheet(rows: Cell[][], opts?: { filter?: boolean; widths?: number[]; headerRow?: number }) {
  const aoa = rows.map((row) => row.map((cell) => (typeof cell === "object" ? cell.v : cell)));
  const ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [[""]]);
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell == null || typeof cell !== "object") return;
      const addr = XLSX.utils.encode_cell({ r, c });
      const existing = (ws[addr] ?? { v: cell.v }) as XLSX.CellObject;
      existing.v = cell.v;
      existing.t = typeof cell.v === "number" ? "n" : "s";
      if (cell.f) existing.f = cell.f;
      if (cell.z) existing.z = cell.z;
      ws[addr] = existing;
    });
  });
  const header = opts?.headerRow ?? 1;
  ws["!views"] = [{ state: "frozen", ySplit: header, topLeftCell: `A${header + 1}`, activePane: "bottomLeft" }];
  if (opts?.widths) ws["!cols"] = opts.widths.map((wch) => ({ wch }));
  if (opts?.filter && rows.length > header) {
    const width = Math.max(1, ...rows.map((row) => row.length));
    ws["!autofilter"] = { ref: `A${header}:${colLetter(width - 1)}${rows.length}` };
  }
  return ws;
}

function chartXml(title: string, cats: string, series: { name: string; values: string }[]) {
  const sers = series
    .map(
      (s, i) => `<c:ser>
        <c:idx val="${i}"/><c:order val="${i}"/>
        <c:tx><c:strRef><c:f>${s.name}</c:f></c:strRef></c:tx>
        <c:cat><c:strRef><c:f>${cats}</c:f></c:strRef></c:cat>
        <c:val><c:numRef><c:f>${s.values}</c:f></c:numRef></c:val>
      </c:ser>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${title}</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:plotArea>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        ${sers}
        <c:axId val="1"/>
        <c:axId val="2"/>
      </c:barChart>
      <c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/></c:catAx>
      <c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/><c:crosses val="autoZero"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

function drawingXml() {
  const anchor = (fromCol: number, fromRow: number, toCol: number, toRow: number, id: number, name: string, rel: string) => `<xdr:twoCellAnchor>
    <xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="${name}"/><xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="${rel}"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  ${anchor(0, 16, 8, 32, 2, "Money in and out", "rId1")}
  ${anchor(9, 16, 16, 32, 3, "Spending by category", "rId2")}
  ${anchor(0, 34, 12, 50, 4, "Balances by account", "rId3")}
</xdr:wsDr>`;
}

function rels(pairs: [string, string, string][]) {
  const body = pairs.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
}

function withCharts(bytes: Uint8Array, monthRows: number, categoryRows: number, balanceRows: number, accountCount: number): Uint8Array {
  const files = unzipSync(bytes);
  const workbook = strFromU8(files["xl/workbook.xml"]);
  const relFile = strFromU8(files["xl/_rels/workbook.xml.rels"]);
  const sheetMatch = workbook.match(/name="Charts"[^>]*r:id="([^"]+)"/);
  if (!sheetMatch) return bytes;
  const rel = relFile.match(new RegExp(`Id="${sheetMatch[1]}"[^>]*Target="([^"]+)"`));
  if (!rel) return bytes;
  const target = rel[1].replace(/^\//, "");
  const sheetPath = target.startsWith("xl/") ? target : `xl/${target}`;
  if (!files[sheetPath]) return bytes;

  let sheetXml = strFromU8(files[sheetPath]);
  if (!sheetXml.includes("xmlns:r=")) {
    sheetXml = sheetXml.replace("<worksheet", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
  }
  if (!sheetXml.includes("<drawing ")) {
    sheetXml = sheetXml.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>');
  }
  files[sheetPath] = strToU8(sheetXml);
  const relPath = sheetPath.replace("worksheets/", "worksheets/_rels/") + ".rels";
  files[relPath] = strToU8(rels([["rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing", "../drawings/drawing1.xml"]]));

  const lastMonth = Math.max(2, monthRows + 1);
  const lastCat = Math.max(2, categoryRows + 1);
  const lastBal = Math.max(2, balanceRows + 1);
  const accounts = Math.max(1, accountCount);
  files["xl/charts/chart1.xml"] = strToU8(chartXml("Money in and out", `Charts!$A$2:$A$${lastMonth}`, [
    { name: "Charts!$B$1", values: `Charts!$B$2:$B$${lastMonth}` },
    { name: "Charts!$C$1", values: `Charts!$C$2:$C$${lastMonth}` },
  ]));
  files["xl/charts/chart2.xml"] = strToU8(chartXml("Spending by category", `Charts!$E$2:$E$${lastCat}`, [
    { name: "Charts!$F$1", values: `Charts!$F$2:$F$${lastCat}` },
  ]));
  const balanceSeries = Array.from({ length: accounts }, (_, index) => {
    const letter = colLetter(7 + index);
    return { name: `Charts!$${letter}$1`, values: `Charts!$${letter}$2:$${letter}$${lastBal}` };
  });
  files["xl/charts/chart3.xml"] = strToU8(chartXml("Balances by account", `Charts!$G$2:$G$${lastBal}`, balanceSeries));
  files["xl/drawings/drawing1.xml"] = strToU8(drawingXml());
  files["xl/drawings/_rels/drawing1.xml.rels"] = strToU8(rels([
    ["rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart", "../charts/chart1.xml"],
    ["rId2", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart", "../charts/chart2.xml"],
    ["rId3", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart", "../charts/chart3.xml"],
  ]));

  let types = strFromU8(files["[Content_Types].xml"]);
  const extras = [1, 2, 3].map((n) => `<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
  extras.push(`<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
  types = types.replace("</Types>", `${extras.filter((line) => !types.includes(line.slice(0, 48))).join("")}</Types>`);
  files["[Content_Types].xml"] = strToU8(types);
  const packed: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) packed[name] = data;
  return zipSync(packed);
}

function yearsOf(transactions: Transaction[]) {
  const years = [...new Set(transactions.map((row) => row.date.slice(0, 4)).filter((year) => /^\d{4}$/.test(year)))].sort();
  if (!years.length) years.push(String(new Date().getFullYear()));
  return years;
}

function howSorted(row: Transaction) {
  if (row.pinned || row.userSet) return "hand";
  if (row.auto?.provisional) return "Check";
  if (row.auto?.source === "rule") return "rule";
  return "";
}

function asideFor(setAsides: SetAside[], categoryId: string, ym: string) {
  return round2(setAsides.filter((row) => row.ym === ym && row.categoryId === categoryId && row.amount > 0).reduce((sum, row) => sum + row.amount, 0));
}

function sourceOf(input: {
  transactions: Transaction[];
  categories: Category[];
  monthBudgets?: MonthBudget[];
  moneyBuckets?: MoneyBucket[];
  bucketMoves?: BucketMove[];
  setAsides?: SetAside[];
  profile: Profile;
}): LedgerSource {
  return {
    transactions: input.transactions,
    categories: input.categories,
    budgets: input.monthBudgets ?? [],
    buckets: input.moneyBuckets ?? [],
    moves: input.bucketMoves ?? [],
    setAsides: input.setAsides ?? [],
    style: input.profile.budgetStyle === "buckets" ? "buckets" : "monthly",
    carryStartMonth: input.profile.carryStartMonth ?? null,
    profile: input.profile,
  };
}

export function buildHarborWorkbook(input: {
  profile: Profile;
  categories: Category[];
  transactions: Transaction[];
  monthBudgets?: MonthBudget[];
  savingsGoals?: SavingsGoal[];
  moneyBuckets?: MoneyBucket[];
  bucketMoves?: BucketMove[];
  netWorth?: NetWorthPoint[];
  debts?: DebtItem[];
  ira?: IraRules;
  accounts?: Account[];
  balances?: BalancePoint[];
  setAsides?: SetAside[];
  merchantRules?: MerchantRule[];
}): Uint8Array {
  const categories = input.categories;
  const transactions = input.transactions;
  const accounts = input.accounts ?? [];
  const balances = input.balances ?? [];
  const buckets = input.moneyBuckets ?? [];
  const moves = input.bucketMoves ?? [];
  const debts = input.debts ?? [];
  const netWorth = input.netWorth ?? [];
  const rules = input.merchantRules ?? [];
  const setAsides = input.setAsides ?? [];
  const source = sourceOf(input);
  const years = yearsOf(transactions);
  const books = years.map((year) => yearLedger(source, year));
  const chartYear = books[books.length - 1];

  const home: Cell[][] = [["Year", "Month", "Received", "Spent", "Saved to funds", "Left"]];
  for (const book of books) {
    const start = home.length + 1;
    for (const month of book.months) {
      const row = home.length + 1;
      home.push([
        book.year,
        monthLabel(month.ym),
        money(month.totals.received),
        money(month.totals.spent),
        money(month.totals.savedToFunds),
        formula(month.totals.leftOver, `=C${row}-D${row}-E${row}`),
      ]);
    }
    const end = home.length;
    const totalRow = end + 1;
    home.push([
      book.year,
      "Year total",
      formula(book.totals.received, `=SUM(C${start}:C${end})`),
      formula(book.totals.spent, `=SUM(D${start}:D${end})`),
      formula(book.totals.savedToFunds, `=SUM(E${start}:E${end})`),
      formula(book.totals.leftOver, `=C${totalRow}-D${totalRow}-E${totalRow}`),
    ]);
  }

  const budget: Cell[][] = [["Year", "Month", "Category", "Planned", "Spent", "Carry in", "Carry out", "Aside", "Carries", "Left"]];
  for (const book of books) {
    for (const month of book.months) {
      for (const line of month.spending) {
        const row = budget.length + 1;
        const aside = asideFor(setAsides, line.id, month.ym);
        const left = line.carries ? round2(line.carryIn + line.planned - line.spent - aside) : round2(line.planned - line.spent);
        budget.push([
          book.year,
          monthLabel(month.ym),
          line.name,
          money(line.planned),
          money(line.spent),
          money(line.carryIn),
          money(line.carryOut),
          money(aside),
          line.carries ? "yes" : "no",
          formula(left, `=IF(I${row}="yes",F${row}+D${row}-E${row}-H${row},D${row}-E${row})`),
        ]);
      }
    }
  }
  if (budget.length > 1) {
    const row = budget.length + 1;
    budget.push(["", "Total", "", formula(0, `=SUM(D2:D${row - 1})`), formula(0, `=SUM(E2:E${row - 1})`), "", "", "", "", formula(0, `=SUM(J2:J${row - 1})`)]);
    const planned = budget[budget.length - 1][3];
    const spent = budget[budget.length - 1][4];
    const left = budget[budget.length - 1][9];
    if (typeof planned === "object") planned.v = round2(books.reduce((sum, book) => sum + book.months.reduce((inner, month) => inner + month.spending.reduce((n, line) => n + line.planned, 0), 0), 0));
    if (typeof spent === "object") spent.v = round2(books.reduce((sum, book) => sum + book.months.reduce((inner, month) => inner + month.spending.reduce((n, line) => n + line.spent, 0), 0), 0));
    if (typeof left === "object") left.v = round2(books.reduce((sum, book) => sum + book.months.reduce((inner, month) => inner + month.spending.reduce((n, line) => n + line.left, 0), 0), 0));
  }

  const spend = new Map<string, number>();
  for (const month of chartYear.months) {
    for (const line of month.spending) spend.set(line.name, (spend.get(line.name) ?? 0) + line.spent);
  }
  const spendRows = [...spend.entries()].filter(([, n]) => Math.abs(n) >= 0.005).sort((a, b) => b[1] - a[1]);

  const dates = [...new Set(balances.map((point) => point.date))].sort();
  const balanceRows = dates.map((date) => {
    const cells: Cell[] = [dateCell(date)];
    for (const account of accounts) {
      const point = balances
        .filter((row) => row.accountId === account.id && row.date <= date)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      cells.push(money(point?.amount ?? 0));
    }
    return cells;
  });

  const chartWidth = Math.max(chartYear.months.length, spendRows.length, balanceRows.length, 1);
  const charts: Cell[][] = [["Month", "Received", "Spent", "", "Category", "Spent", "Date"]];
  for (const account of accounts) charts[0].push(account.name);
  if (!accounts.length) charts[0].push("Balance");
  for (let i = 0; i < chartWidth; i++) {
    const month = chartYear.months[i];
    const cat = spendRows[i];
    const bal = balanceRows[i];
    const row: Cell[] = [
      month ? monthLabel(month.ym) : "",
      month ? money(month.totals.received) : "",
      month ? money(month.totals.spent) : "",
      "",
      cat ? cat[0] : "",
      cat ? money(cat[1]) : "",
      bal ? bal[0] : "",
    ];
    if (bal) row.push(...bal.slice(1));
    else if (!accounts.length) row.push("");
    charts.push(row);
  }

  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Cell[][], opts?: { filter?: boolean; widths?: number[] }) => {
    XLSX.utils.book_append_sheet(wb, toSheet(rows, opts), name.slice(0, 31));
  };

  add("Start here", [
    [input.profile.ledgerName || "Harbor Ledger"],
    ["Start here", "What this sheet is"],
    ["Home year", "Each month: received, spent, saved to funds, and what is left."],
    ["Budget month", "Each category: planned, spent, carry in, carry out, and left."],
    ["Categories", "Spending and income names, and the usual plan."],
    ["Funds", "Money set aside, and moves between funds."],
    ["Accounts", "Each account and its latest balance."],
    ["Net worth", "Snapshots you typed."],
    ["Debts", "Balances, rates, and minimums you typed."],
    ["Transactions", "Every charge, with how it was sorted."],
    ["Rules", "A name and the category it uses."],
    ["Charts", "Money in versus out, spending by category, balances over time."],
    ["Assumptions", "Reference figures, with the date and whether they need checking."],
    ["Google Sheets", "File, Import, Upload, then Replace spreadsheet."],
  ], { widths: [22, 72] });

  add("Home year", home, { widths: [12, 16, 16, 16, 18, 16] });
  add("Budget month", budget, { widths: [10, 14, 22, 14, 14, 14, 14, 12, 12, 14] });
  add("Categories", [
    ["Category", "Kind", "Usual plan", "Part of"],
    ...categories.map((category) => [category.name, category.kind === "income" ? "Income" : "Spending", money(category.plannedMonthly), category.parentId ? categoryLabel(categories, category.parentId) : ""]),
  ], { widths: [24, 14, 16, 24] });
  const through = chartYear.months.at(-1)?.ym ?? `${chartYear.year}-12`;
  add("Funds", [
    ["Name", "Monthly", "Yearly", "Opening", "Start", "Target", "By", "Balance", "Paused"],
    ...buckets.map((bucket) => [
      bucket.name,
      money(bucket.monthly),
      bucket.yearly ?? "",
      money(bucket.opening),
      bucket.startMonth,
      bucket.target ?? "",
      bucket.by ?? "",
      money(bucketBalance(bucket, through, transactions, categories, moves)),
      bucket.paused ? "yes" : "",
    ]),
    [],
    ["Moves", "Month", "Amount", "From", "To"],
    ...moves.map((move) => [
      move.id,
      move.ym,
      money(move.amount),
      move.fromId ? (buckets.find((bucket) => bucket.id === move.fromId)?.name ?? "") : "Not given a job yet",
      buckets.find((bucket) => bucket.id === move.toId)?.name ?? "",
    ]),
  ], { widths: [22, 14, 14, 14, 12, 14, 12, 14, 12] });
  add("Accounts", [
    ["Account", "Kind", "Latest balance", "As of"],
    ...accounts.map((account) => {
      const latest = latestBalance(account.id, balances);
      return [account.name, account.kind, latest ? money(latest.amount) : "", latest ? dateCell(latest.date) : ""];
    }),
  ], { widths: [24, 16, 18, 14] });
  add("Net worth", [
    ["Date", "Amount", "Note"],
    ...netWorth.map((point) => [dateCell(point.date), money(point.amount), point.note]),
  ], { widths: [14, 16, 32] });
  add("Debts", [
    ["Name", "Balance", "Rate", "Minimum"],
    ...debts.map((debt) => [debt.name, money(debt.balance), { v: round2(debt.apr) / 100, z: PCT }, money(debt.minimum)]),
  ], { widths: [24, 16, 12, 14] });
  add("Transactions", [
    ["Date", "Account", "Clean name", "Bank text", "Category", "How it was sorted", "Amount", "Month"],
    ...[...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).map((row) => {
      const pieces = piecesOf(row);
      const categoryText = pieces
        ? pieces.map((part) => `${categoryLabel(categories, part.categoryId)} ${part.amount.toFixed(2)}`).join("; ")
        : categoryLabel(categories, row.categoryId);
      return [
        dateCell(row.date),
        accounts.find((account) => account.id === row.accountId)?.name ?? row.sourceLabel,
        displayMerchant(row.description),
        row.description,
        categoryText,
        howSorted(row),
        money(row.amount),
        monthLabel(row.date.slice(0, 7)),
      ];
    }),
  ], { filter: true, widths: [14, 18, 22, 32, 22, 18, 14, 16] });
  add("Rules", [
    ["Name", "Category", "Side"],
    ...rules.map((rule) => [rule.merchantKey, categoryLabel(categories, rule.categoryId), rule.side ?? "both"]),
  ], { widths: [24, 24, 12] });
  add("Charts", charts, { widths: [16, 14, 14, 4, 22, 14, 14, 16, 16, 16] });
  add("Assumptions", [
    ["Name", "Value", "As of", "Source", "Status"],
    ...FIGURES.map((figure) => [
      figure.name,
      figure.unit === "rate" ? { v: figure.value, z: PCT } : figure.unit === "usd" ? money(figure.value) : figure.value,
      dateCell(figure.asOf),
      figure.source,
      figure.status,
    ]),
  ], { widths: [36, 14, 14, 42, 18] });

  const raw = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer | Uint8Array;
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  return withCharts(bytes, chartYear.months.length, spendRows.length, Math.max(balanceRows.length, 1), Math.max(accounts.length, 1));
}

export const WORKBOOK_SHEETS = SHEETS;
