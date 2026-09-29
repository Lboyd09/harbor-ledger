import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as XLSX from "xlsx";
import { displayMerchant } from "./merchant.ts";
import { monthLabel } from "./parse-date.ts";
import { categoryLabel, orderedCategories, planAmount } from "./plans.ts";
import { groupPayees } from "./payees.ts";
import { monthlySeries } from "./totals.ts";
import { buildYearWorkbook } from "./year.ts";
import type { Category, MonthBudget, Profile, Transaction } from "./types.ts";

type Row = (string | number)[];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function catKind(categories: Category[], id: string | null) {
  return categories.find((c) => c.id === id)?.kind ?? "";
}

function sheet(rows: Row[]) {
  return XLSX.utils.aoa_to_sheet(rows.length ? rows : [[""]]);
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
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>16</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>32</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Income and spending"/><xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId1"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>9</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>16</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>16</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>32</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="3" name="Spending by category"/><xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId2"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function rels(pairs: [string, string, string][]) {
  const body = pairs
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
}

/** Drop chart drawings into a SheetJS workbook so Excel and Google Sheets both get the pictures. */
function withCharts(bytes: Uint8Array, monthRows: number, categoryRows: number): Uint8Array {
  if (monthRows < 1 && categoryRows < 1) return bytes;
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
    sheetXml = sheetXml.replace(
      "<worksheet",
      '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    );
  }
  if (!sheetXml.includes("<drawing ")) {
    sheetXml = sheetXml.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>');
  }
  files[sheetPath] = strToU8(sheetXml);

  const relPath = sheetPath.replace("worksheets/", "worksheets/_rels/") + ".rels";
  files[relPath] = strToU8(
    rels([
      [
        "rId1",
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
        "../drawings/drawing1.xml",
      ],
    ]),
  );

  const lastMonth = Math.max(2, monthRows + 1);
  const lastCat = Math.max(2, categoryRows + 1);
  files["xl/charts/chart1.xml"] = strToU8(
    chartXml("Income and spending", `Charts!$A$2:$A$${lastMonth}`, [
      { name: "Charts!$B$1", values: `Charts!$B$2:$B$${lastMonth}` },
      { name: "Charts!$C$1", values: `Charts!$C$2:$C$${lastMonth}` },
    ]),
  );
  files["xl/charts/chart2.xml"] = strToU8(
    chartXml("Spending by category", `Charts!$F$2:$F$${lastCat}`, [
      { name: "Charts!$G$1", values: `Charts!$G$2:$G$${lastCat}` },
    ]),
  );
  files["xl/drawings/drawing1.xml"] = strToU8(drawingXml());
  files["xl/drawings/_rels/drawing1.xml.rels"] = strToU8(
    rels([
      ["rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart", "../charts/chart1.xml"],
      ["rId2", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart", "../charts/chart2.xml"],
    ]),
  );

  let types = strFromU8(files["[Content_Types].xml"]);
  const extras = [
    `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    `<Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
  ].filter((line) => !types.includes(line.slice(0, 40)));
  types = types.replace("</Types>", `${extras.join("")}</Types>`);
  files["[Content_Types].xml"] = strToU8(types);

  const packed: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) packed[name] = data;
  return zipSync(packed);
}

export function buildHarborWorkbook(input: {
  profile: Profile;
  categories: Category[];
  transactions: Transaction[];
  monthBudgets?: MonthBudget[];
}): Uint8Array {
  const { profile, categories, transactions } = input;
  const budgets = input.monthBudgets ?? [];
  const months = monthlySeries(transactions, categories);
  const years = [...new Set(transactions.map((t) => t.date.slice(0, 4)).filter((y) => y.length === 4))].sort();
  const year = years.at(-1) ?? String(new Date().getFullYear());
  const book = buildYearWorkbook(transactions, categories, year);
  const payees = groupPayees(transactions);

  const spendByCat = new Map<string, number>();
  for (const t of transactions) {
    if (t.excluded || t.status === "transfer" || t.status === "reimbursement") continue;
    const cat = t.categoryId ? categories.find((c) => c.id === t.categoryId) : undefined;
    if (!cat || cat.kind !== "expense") {
      if (t.status === "refund") spendByCat.set("__refund__", (spendByCat.get("__refund__") ?? 0) - Math.abs(t.amount));
      continue;
    }
    const delta = t.status === "refund" ? -Math.abs(t.amount) : t.amount < 0 ? -t.amount : 0;
    spendByCat.set(cat.id, (spendByCat.get(cat.id) ?? 0) + delta);
  }
  const spendRows = [...spendByCat.entries()]
    .filter(([, n]) => Math.abs(n) >= 0.005)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const chartAoa: Row[] = [
    ["Month", "Income", "Spending", "Left", "", "Category", "Spent"],
    ...Array.from({ length: Math.max(months.length, spendRows.length, 1) }, (_, i) => {
      const m = months[i];
      const cat = spendRows[i];
      return [
        m ? monthLabel(m.ym) : "",
        m ? round2(m.income) : "",
        m ? round2(m.expenses) : "",
        m ? round2(m.net) : "",
        "",
        cat ? (cat[0] === "__refund__" ? "Money a store gave back" : categoryLabel(categories, cat[0])) : "",
        cat ? round2(cat[1]) : "",
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Row[]) => XLSX.utils.book_append_sheet(wb, sheet(rows), name.slice(0, 31));

  add("Start here", [
    [profile.ledgerName || "Harbor Ledger"],
    ["This file is the same ledger as Harbor: months, plan, splits, merchants, and charts."],
    ["Excel opens it directly. The charts are drawn on the Charts sheet."],
    ["Google Sheets: File → Import → Upload → choose this file → Replace spreadsheet."],
    ["Money back from a store lowers spending. It is not income."],
    ["Paid back means someone repaid a purchase, so neither row is income or spending."],
    ["A month budget replaces the usual plan for that month only."],
  ]);

  add("Overview", [
    ["Year", year],
    ["Income", round2(book.income)],
    ["Spending", round2(book.expenses)],
    ["Left", round2(book.net)],
    ["Usual income plan", round2(book.planIncome)],
    ["Usual spending plan", round2(book.planExpenses)],
    ["Rows still needing a category", book.uncategorized],
  ]);

  add("Months", [
    ["Month", "Income", "Spending", "Left", "Needs a category", "Status"],
    ...book.monthSummaries.map((m) => [
      monthLabel(m.ym),
      round2(m.income),
      round2(m.expenses),
      round2(m.net),
      m.uncategorized,
      m.status,
    ]),
  ]);

  add("Categories", [
    ["Category", "Group", "Kind", "Usual plan", "Split of"],
    ...orderedCategories(categories).map((c) => [
      c.name,
      categoryLabel(categories, c.id),
      c.kind === "income" ? "Income" : "Spending",
      c.plannedMonthly,
      c.parentId ? categoryLabel(categories, c.parentId) : "",
    ]),
  ]);

  const budgetMonths = [...new Set(budgets.map((b) => b.ym))].sort();
  add("Month budgets", [
    ["Category", "Kind", "Usual plan", ...budgetMonths.map((ym) => monthLabel(ym))],
    ...orderedCategories(categories).map((c) => [
      categoryLabel(categories, c.id),
      c.kind,
      c.plannedMonthly,
      ...budgetMonths.map((ym) => {
        const custom = budgets.find((b) => b.categoryId === c.id && b.ym === ym);
        return custom ? custom.amount : planAmount(c, null, []);
      }),
    ]),
  ]);

  add("Plan", [
    ["Category", "Kind", "Usual monthly plan"],
    ...orderedCategories(categories).map((c) => [categoryLabel(categories, c.id), c.kind, c.plannedMonthly]),
  ]);

  add("Transactions", [
    ["Date", "Description", "Amount", "Income", "Spending", "Category", "Kind", "What it means", "Merchant", "Source", "Notes"],
    ...[...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => {
        const meaning =
          t.excluded || t.status === "transfer"
            ? "Left out"
            : t.status === "reimbursement"
              ? "Paid back — not in the budget"
              : t.status === "refund"
                ? "Money a store gave back — lowers spending"
                : "Counts";
        return [
          t.date,
          t.description,
          t.amount,
          t.amount > 0 && t.status !== "refund" && t.status !== "reimbursement" ? t.amount : "",
          t.amount < 0 ? Math.abs(t.amount) : t.status === "refund" ? -Math.abs(t.amount) : "",
          categoryLabel(categories, t.categoryId),
          catKind(categories, t.categoryId),
          meaning,
          displayMerchant(t.description),
          t.sourceLabel,
          t.notes.startsWith("payback") ? "Payback" : t.notes,
        ];
      }),
  ]);

  const incomePayees = payees.filter((g) => g.totalIn > 0);
  const expensePayees = payees.filter((g) => g.totalOut > 0 || g.returned > 0);
  const payeeHead = ["Name", "Times", "Money in", "Money out", "Money a store gave back", "Category"];
  const payeeRow = (g: (typeof payees)[number]): Row => [
    displayMerchant(g.sample),
    g.count,
    round2(g.totalIn),
    round2(g.totalOut),
    round2(g.returned),
    categoryLabel(categories, g.categoryId),
  ];
  add("Income merchants", [payeeHead, ...incomePayees.map(payeeRow)]);
  add("Spending merchants", [payeeHead, ...expensePayees.map(payeeRow)]);
  add("Charts", chartAoa);

  const raw = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer | Uint8Array;
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  return withCharts(bytes, months.length, spendRows.length);
}
