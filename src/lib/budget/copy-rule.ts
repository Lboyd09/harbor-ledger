const BANNED = /\b(bucket|envelope|rollover|allocate|reconcile|Nerd)\b/;

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
    if (text.length > 220) problems.push(`long: ${text.slice(0, 80)}`);
    if (BANNED.test(text)) problems.push(`banned: ${text.slice(0, 80)}`);
  }
  return problems;
}
