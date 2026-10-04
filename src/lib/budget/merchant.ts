const NOISE = [
  /\bPOS\b/g,
  /\bDEBIT\b/g,
  /\bCREDIT\b/g,
  /\bPURCHASE\b/g,
  /\bCARD\b/g,
  /\bWEB ID:?\s*\w+/g,
  /\bPPD ID:?\s*\w+/g,
  /\bID:\s*\w+/g,
  /\bACH\b/g,
  /\bCHECKCARD\b/g,
  /\bVISA\b/g,
  /\bMASTERCARD\b/g,
  /\bRECURRING\b/g,
];

/** Same cleaning as merchantKey, without the six-word cap. */
export function merchantNormalized(description: string): string {
  let s = String(description || "").toUpperCase();
  s = s.replace(/['’]/g, "");
  s = s.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, " ");
  s = s.replace(/#\s*\d+/g, " ");
  s = s.replace(/\b\d{4,}\b/g, " ");
  s = s.replace(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g, " ");
  for (const re of NOISE) s = s.replace(re, " ");
  s = s.replace(/[^A-Z0-9 &]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function merchantKey(description: string): string {
  const s = merchantNormalized(description);
  if (!s) return "UNKNOWN";
  const words = s.split(" ").filter(Boolean);
  return words.slice(0, 6).join(" ");
}

export function displayMerchant(description: string): string {
  const key = merchantKey(description);
  if (key === "UNKNOWN") return description.trim() || "Unknown";
  return key
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

const FAMILY_PREFIX = /^(?:SQ \*|TST\*|PP\*|PAYPAL \*|AMZN MKTP\s*|AMZN\*|GOOGLE \*|DD \*|UBER \*|LYFT \*)\s*/;

/**
 * A shorter name shared by store numbers and card processors.
 * Does not change merchantKey or the keys already saved on rules.
 */
export function merchantFamily(description: string): string {
  let raw = String(description || "").toUpperCase();
  raw = raw.replace(FAMILY_PREFIX, "");
  raw = raw.replace(/\b[A-Z][A-Z .'-]{2,30},\s*[A-Z]{2}\b/g, " ");
  raw = raw.replace(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g, " ");
  raw = raw.replace(/[X*]{2,}\d*/g, " ");
  raw = raw.replace(/#\s*\d+/g, " ");
  raw = raw.replace(/\b\d{3,}\b/g, " ");
  const cleaned = merchantNormalized(raw);
  const dropped = new Set(["SQ", "TST", "PP", "PAYPAL", "GOOGLE", "DD"]);
  let words = cleaned.split(" ").filter((word) => word && !/^\d+$/.test(word));
  while (words.length > 1 && (dropped.has(words[0]) || words[0] === "AMZN")) {
    if (words[0] === "AMZN" && words[1] === "MKTP") words = words.slice(2);
    else words = words.slice(1);
  }
  return words.slice(0, 2).join(" ") || "UNKNOWN";
}

/** 0 to 1. Shared words over the longer name. */
export function tokenOverlap(a: string, b: string): number {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j - 1], row[j]) + 1;
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}
