export function tagOf(source: string) {
  if (source.includes("account")) return "from your accounts";
  if (source.includes("spending") || source.includes("income")) return source.includes("income") ? "from your income" : "from your spending";
  return "typed";
}
