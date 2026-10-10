const BANNED = /\b(bucket|envelope|rollover|allocate|reconcile|Nerd)\b/;

/** User-facing sentences in components. Errors and destructive confirmations may run longer. */
export const MAX_VISIBLE = 160;

/**
 * Screens later text phases still own. Exact openings, so a shorter rewrite drops off this list.
 * Do not add Plan copy here.
 */
const LATER_PHASE_LONG = [
  "Mail is not connected on this host yet",
  "Each name has one default category",
  "You do not need this.",
  "Income is not part of this choice",
  "Optional. The live ledger stays",
];

export function allowedLongCopy(text: string): boolean {
  if (LATER_PHASE_LONG.some((prefix) => text.startsWith(prefix))) return true;
  if (/\bRESET\b/.test(text)) return true;
  if (/erase this device|Deletes your account|delete this/i.test(text)) return true;
  if (/^That file was empty\b/.test(text)) return true;
  if (/^Enter /.test(text)) return true;
  if (/^Pick /.test(text)) return true;
  if (/both amounts|add up to/i.test(text)) return true;
  return false;
}

/** Visible sentences in a component file. Skips code, class names, and enum ids. */
export function visibleSentences(source: string): string[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/className=(?:"[^"]*"|\{[^}]*\})/g, "");
  const out: string[] = [];
  for (const match of stripped.matchAll(/>([^<>{}]+)</g)) {
    const text = match[1].replace(/\s+/g, " ").trim();
    if (text.split(" ").length < 4) continue;
    if (!/[A-Za-z]/.test(text)) continue;
    if (/=>|const |function |useState|className/.test(text)) continue;
    out.push(text);
  }
  return out;
}

export function copyProblems(source: string): string[] {
  const problems: string[] = [];
  for (const text of visibleSentences(source)) {
    if (text.length > MAX_VISIBLE && !allowedLongCopy(text)) problems.push(`long: ${text.slice(0, 80)}`);
    if (BANNED.test(text)) problems.push(`banned: ${text.slice(0, 80)}`);
  }
  return problems;
}
