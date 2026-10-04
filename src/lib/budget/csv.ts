import { parseAmountToken, roundMoney } from "./money.ts";
import { parseDateToken } from "./parse-date.ts";
import type { ColumnRole, CsvPreview, DetectedColumn, ParsePreviewRow } from "./types.ts";

const DATE_HEADERS = [
  "date",
  "posting date",
  "posted date",
  "post date",
  "transaction date",
  "trans date",
  "trans dt",
  "txn date",
  "run date",
  "trade date",
];

const DESC_HEADERS = [
  "description",
  "desc",
  "payee",
  "memo",
  "name",
  "merchant",
  "merchant name",
  "narrative",
  "particulars",
  "title",
  "transaction",
  "original description",
];

const AMOUNT_HEADERS = ["amount", "transaction amount", "amt", "value", "sum", "cad", "usd"];

const DEBIT_HEADERS = ["debit", "debits", "withdrawal", "withdrawals", "outflow", "spent", "expense"];

const CREDIT_HEADERS = ["credit", "credits", "deposit", "deposits", "inflow"];

const DIRECTION_HEADERS = [
  "details",
  "type",
  "direction",
  "transaction type",
  "dr cr",
  "debit credit",
  "cr dr",
];

const IGNORE_EXACT = new Set([
  "status",
  "pending",
  "balance",
  "running bal",
  "running balance",
  "check or slip",
  "check",
  "reference",
  "currency",
  "category",
  "id",
  "account",
  "account id",
  "account number",
  "card",
  "card no",
  "fitid",
]);

function normHeader(h: string): string {
  return String(h || "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^\w\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBalanceHeader(n: string): boolean {
  return n === "balance" || n === "running bal" || n === "running balance" || n.includes("balance");
}

function roleForHeader(h: string): ColumnRole {
  const n = normHeader(h);
  if (!n) return "ignore";
  if (isBalanceHeader(n)) return "balance";
  if (IGNORE_EXACT.has(n) || n.includes("check or") || n.endsWith(" id")) {
    return "ignore";
  }
  if (n === "category" || n.includes("category")) return "ignore";
  if (DIRECTION_HEADERS.some((x) => n === x)) return "direction";
  if (DATE_HEADERS.some((x) => n === x) || (n.includes("date") && !n.includes("update") && !n.includes("birth"))) {
    return "date";
  }
  if (DEBIT_HEADERS.some((x) => n === x || n.includes("debit") || n.includes("withdrawal"))) return "debit";
  if (n === "credit" || CREDIT_HEADERS.some((x) => n === x) || (n.includes("deposit") && !n.includes("direct"))) {
    return "credit";
  }
  if (AMOUNT_HEADERS.some((x) => n === x || n.endsWith(" amount") || n === "amount")) return "amount";
  if (DESC_HEADERS.some((x) => n === x || n.includes("description") || n.includes("payee") || n.includes("memo") || n.includes("merchant"))) {
    return "description";
  }
  if (n === "name") return "description";
  return "ignore";
}

export function splitCsvLine(line: string, delimiter: string): string[] {
  return parseCsv(line, delimiter)[0] ?? [];
}

export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = String(text || "").replace(/^\uFEFF/, "");
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function mostCommon(nums: number[]): number {
  const counts = new Map<number, number>();
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [n, c] of counts) {
    if (c > bestN || (c === bestN && n > best)) {
      best = n;
      bestN = c;
    }
  }
  return best;
}

function detectDelimiter(text: string): string {
  const sample = text.slice(0, 8000);
  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestScore = -1;
  for (const d of candidates) {
    const rows = parseCsv(sample, d).slice(0, 10);
    if (rows.length < 1) continue;
    const widths = rows.map((r) => r.length);
    const mode = mostCommon(widths);
    if (mode < 2) continue;
    const consistent = widths.filter((w) => w === mode).length;
    const score = consistent * 10 + mode;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function headerScore(cells: string[]): number {
  let score = 0;
  for (const cell of cells) {
    const role = roleForHeader(cell);
    if (role !== "ignore") score += 2;
    const n = normHeader(cell);
    if (!n) continue;
    if (n.includes("date") || n === "amount" || n.includes("description") || n === "payee" || n === "debit" || n === "credit") {
      score += 1;
    }
  }
  return score;
}

function looksLikeHeaderRow(cells: string[]): boolean {
  if (headerScore(cells) >= 4) return true;
  const dateHits = cells.filter((c) => parseDateToken(c)).length;
  return dateHits === 0 && headerScore(cells) >= 2;
}

function dedupeRoles(columns: DetectedColumn[]): DetectedColumn[] {
  const seen = new Map<ColumnRole, number>();
  return columns.map((col) => {
    if (col.role === "ignore" || col.role === "description") return col;
    if (col.role === "debit" || col.role === "credit") return col;
    const prev = seen.get(col.role);
    if (prev != null) return { ...col, role: "ignore" as const };
    seen.set(col.role, col.index);
    return col;
  });
}

function inferColumns(records: string[][]): DetectedColumn[] {
  const width = Math.max(0, ...records.map((r) => r.length));
  const sample = records.slice(0, 40);
  const cols: DetectedColumn[] = [];
  for (let i = 0; i < width; i++) {
    const cells = sample.map((r) => (r[i] ?? "").trim());
    const dateHits = cells.filter((c) => parseDateToken(c)).length;
    const amountHits = cells.filter((c) => {
      const n = parseAmountToken(c);
      return n != null && /[\d]/.test(c);
    }).length;
    const avgLen = cells.reduce((s, c) => s + c.length, 0) / Math.max(cells.length, 1);
    let role: ColumnRole = "ignore";
    if (dateHits >= sample.length * 0.45) role = "date";
    else if (amountHits >= sample.length * 0.45 && avgLen < 18) role = "amount";
    else if (avgLen >= 6) role = "description";
    cols.push({ index: i, header: `Column ${i + 1}`, role });
  }
  const amountIdx = cols.filter((c) => c.role === "amount").map((c) => c.index);
  if (amountIdx.length >= 2) {
    cols[amountIdx[0]].role = "debit";
    cols[amountIdx[1]].role = "credit";
    for (const idx of amountIdx.slice(2)) cols[idx].role = "ignore";
  }
  const descCandidates = cols.filter((c) => c.role === "description");
  if (descCandidates.length > 1) {
    let best = descCandidates[0].index;
    let bestLen = -1;
    for (const c of descCandidates) {
      const avg = sample.reduce((s, r) => s + (r[c.index] ?? "").length, 0);
      if (avg > bestLen) {
        bestLen = avg;
        best = c.index;
      }
    }
    for (const c of descCandidates) {
      if (c.index !== best) cols[c.index].role = "ignore";
    }
  }
  return dedupeRoles(cols);
}

function guessSource(fileName: string, headers: string[]): string {
  const blob = `${fileName} ${headers.join(" ")}`.toLowerCase();
  if (blob.includes("chase")) return "Chase";
  if (blob.includes("bank of america") || blob.includes("bofa") || /\bbofa\b/.test(blob)) return "Bank of America";
  if (blob.includes("wells")) return "Wells Fargo";
  if (blob.includes("citi")) return "Citi";
  if (blob.includes("capital one")) return "Capital One";
  if (blob.includes("amex") || blob.includes("american express")) return "American Express";
  if (blob.includes("us bank") || blob.includes("usbank")) return "U.S. Bank";
  if (blob.includes("ally")) return "Ally";
  if (blob.includes("discover")) return "Discover";
  if (blob.includes("navy")) return "Navy Federal";
  if (blob.includes("schwab")) return "Schwab";
  if (headers.some((h) => normHeader(h) === "details") && headers.some((h) => normHeader(h).includes("posting"))) {
    return "Chase";
  }
  if (headers.some((h) => /running bal/i.test(h))) return "Bank of America";
  if (headers.some((h) => normHeader(h) === "direction") && headers.some((h) => normHeader(h) === "name")) {
    return "Generic export";
  }
  return "Bank CSV";
}

function firstCell(record: string[], columns: DetectedColumn[], role: ColumnRole, test: (v: string) => boolean): string {
  for (const col of columns) {
    if (col.role !== role) continue;
    const v = (record[col.index] ?? "").trim();
    if (test(v)) return v;
  }
  return "";
}

function parseDirectionToken(raw: string): "in" | "out" | null {
  const n = String(raw || "").trim().toUpperCase();
  if (!n) return null;
  if (n === "IN" || n === "CREDIT" || n === "CR" || n === "DEPOSIT" || n === "ACH_CREDIT") return "in";
  if (n.includes("CREDIT") && !n.includes("DEBIT")) return "in";
  if (n === "OUT" || n === "DEBIT" || n === "DR" || n === "WITHDRAWAL" || n === "DEBIT_CARD" || n === "ACH_DEBIT") {
    return "out";
  }
  if (n.includes("DEBIT") || n.includes("WITHDRAW")) return "out";
  return null;
}

function amountFromRecord(record: string[], columns: DetectedColumn[]): { amount: number | null; usedSplit: boolean } {
  const debitCol = columns.find((c) => c.role === "debit");
  const creditCol = columns.find((c) => c.role === "credit");
  const amountCol = columns.find((c) => c.role === "amount");
  if (debitCol || creditCol) {
    const d = debitCol ? parseAmountToken(record[debitCol.index] ?? "") : null;
    const c = creditCol ? parseAmountToken(record[creditCol.index] ?? "") : null;
    if (d == null && c == null) return { amount: null, usedSplit: true };
    return { amount: roundMoney(Math.abs(c ?? 0) - Math.abs(d ?? 0)), usedSplit: true };
  }
  if (!amountCol) return { amount: null, usedSplit: false };
  return { amount: parseAmountToken(record[amountCol.index] ?? ""), usedSplit: false };
}

function applyDirectionIfNeeded(rows: ParsePreviewRow[], columns: DetectedColumn[]): { rows: ParsePreviewRow[]; applied: boolean } {
  const dirCol = columns.find((c) => c.role === "direction");
  if (!dirCol) return { rows, applied: false };
  const nums = rows.map((r) => r.amount).filter((n): n is number => n != null && n !== 0);
  const mixed = nums.some((n) => n > 0) && nums.some((n) => n < 0);
  if (mixed) return { rows, applied: false };
  let applied = false;
  const next = rows.map((r) => {
    if (r.amount == null) return r;
    const dir = parseDirectionToken(r.raw[dirCol.index] ?? "");
    if (!dir) return r;
    applied = true;
    const mag = Math.abs(r.amount);
    return { ...r, amount: dir === "out" ? -mag : mag };
  });
  return { rows: next, applied };
}

function runsNewestFirst(dates: string[]): boolean {
  if (dates.length < 2) return true;
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first > last) return true;
  if (first < last) return false;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) return true;
    if (dates[i] > dates[i - 1]) return false;
  }
  return true;
}

/** Balance on the latest date. Same-day rows: first if the file is newest-first, last if oldest-first. */
export function endingBalanceFrom(rows: ParsePreviewRow[], columns: DetectedColumn[]): CsvPreview["endingBalance"] {
  const col = columns.find((c) => c.role === "balance");
  if (!col) return null;
  const points: { date: string; amount: number }[] = [];
  for (const row of rows) {
    if (!row.date) continue;
    const amount = parseAmountToken(row.raw[col.index] ?? "");
    if (amount == null) continue;
    points.push({ date: row.date, amount });
  }
  if (!points.length) return null;
  const latest = points.reduce((max, point) => (point.date > max ? point.date : max), points[0].date);
  const onDay = points.filter((point) => point.date === latest);
  const newestFirst = runsNewestFirst(points.map((point) => point.date));
  const pick = newestFirst ? onDay[0] : onDay[onDay.length - 1];
  return { amount: pick.amount, asOf: pick.date };
}

function buildRows(records: string[][], columns: DetectedColumn[]): ParsePreviewRow[] {
  return records.map((raw) => {
    const dateRaw = firstCell(raw, columns, "date", (v) => Boolean(parseDateToken(v)));
    const description = firstCell(raw, columns, "description", (v) => v.length > 0);
    const { amount } = amountFromRecord(raw, columns);
    return {
      date: dateRaw ? parseDateToken(dateRaw) : null,
      description,
      amount,
      raw,
    };
  });
}

function finishPreview(
  fileName: string,
  delimiter: string,
  headers: string[],
  columns: DetectedColumn[],
  records: string[][],
  guessedSource: string,
): CsvPreview {
  let rows = buildRows(records, columns);
  const dir = applyDirectionIfNeeded(rows, columns);
  rows = dir.rows;
  const issues: string[] = [];
  if (!columns.some((c) => c.role === "date")) issues.push("No date column detected — map one below.");
  if (!columns.some((c) => c.role === "amount" || c.role === "debit" || c.role === "credit")) {
    issues.push("No amount column detected — map Amount, or Debit + Credit.");
  }
  if (!columns.some((c) => c.role === "description")) issues.push("No description column detected — map one below.");
  const missingDate = rows.filter((r) => !r.date).length;
  const missingAmt = rows.filter((r) => r.amount == null).length;
  if (missingDate) issues.push(`${missingDate} row${missingDate === 1 ? "" : "s"} missing a readable date.`);
  if (missingAmt) issues.push(`${missingAmt} row${missingAmt === 1 ? "" : "s"} missing a readable amount.`);

  const usedSplit = columns.some((c) => c.role === "debit" || c.role === "credit");
  let amountNote = "Amount column used as-is (negative = money out).";
  if (usedSplit) amountNote = "Debit and credit columns combined. Credits are inflows; debits are outflows.";
  else if (dir.applied) amountNote = "Amounts were unsigned, so in/out (or debit/credit) markers set the sign.";

  return {
    fileName,
    delimiter,
    headers,
    columns,
    rows,
    rawRowCount: records.length,
    guessedSource,
    amountNote,
    issues,
    endingBalance: endingBalanceFrom(rows, columns),
  };
}

export function parseCsvText(text: string, fileName: string): CsvPreview {
  const delimiter = detectDelimiter(text);
  const table = parseCsv(text, delimiter);
  if (!table.length) {
    return {
      fileName,
      delimiter,
      headers: [],
      columns: [],
      rows: [],
      rawRowCount: 0,
      guessedSource: "Bank CSV",
      amountNote: "File had no rows.",
      issues: ["That file did not contain any rows."],
      endingBalance: null,
    };
  }

  let headerIndex = -1;
  const scan = Math.min(table.length, 16);
  let bestScore = -1;
  for (let i = 0; i < scan; i++) {
    const score = headerScore(table[i]);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }

  const firstIsData = table[0] && table[0].some((c) => parseDateToken(c)) && !looksLikeHeaderRow(table[0]);
  let headers: string[] = [];
  let records: string[][];
  let columns: DetectedColumn[];

  if (!firstIsData && headerIndex >= 0 && bestScore >= 2 && looksLikeHeaderRow(table[headerIndex])) {
    headers = table[headerIndex].map((h, i) => h.trim() || `Column ${i + 1}`);
    records = table.slice(headerIndex + 1);
    columns = dedupeRoles(
      headers.map((header, index) => ({
        index,
        header,
        role: roleForHeader(header),
      })),
    );
  } else {
    records = table;
    columns = inferColumns(records);
    headers = columns.map((c) => c.header);
  }

  const source = guessSource(fileName, headers);
  return finishPreview(fileName, delimiter, headers, columns, records, source);
}

export function remapPreview(preview: CsvPreview, columns: DetectedColumn[]): CsvPreview {
  const records = preview.rows.map((r) => r.raw);
  return finishPreview(preview.fileName, preview.delimiter, preview.headers, columns, records, preview.guessedSource);
}

export function applyAmountFlip(preview: CsvPreview, flip: boolean): ParsePreviewRow[] {
  if (!flip) return preview.rows;
  return preview.rows.map((r) => ({
    ...r,
    amount: r.amount == null ? null : roundMoney(-r.amount),
  }));
}
