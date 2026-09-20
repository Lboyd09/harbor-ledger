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

export function merchantKey(description: string): string {
  let s = String(description || "").toUpperCase();
  s = s.replace(/['’]/g, "");
  s = s.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, " ");
  s = s.replace(/#\s*\d+/g, " ");
  s = s.replace(/\b\d{4,}\b/g, " ");
  s = s.replace(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g, " ");
  for (const re of NOISE) s = s.replace(re, " ");
  s = s.replace(/[^A-Z0-9 &]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
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
