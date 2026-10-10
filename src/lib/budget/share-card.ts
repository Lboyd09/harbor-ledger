export type ShareKind = "debt-free" | "on-plan" | "goal" | "work-optional";

export function shareCardText(kind: ShareKind, amounts: boolean, extra?: { month?: string; count?: string; age?: string; name?: string }): string {
  const lines: string[] = [];
  if (kind === "debt-free") lines.push(amounts && extra?.month ? `Debt-free by ${extra.month}` : "Debt-free by a date I can see");
  if (kind === "on-plan") lines.push(amounts && extra?.count ? `On plan in ${extra.count} this month` : "On plan in most categories this month");
  if (kind === "goal") lines.push(extra?.name ? `Goal reached: ${extra.name}` : "Goal reached");
  if (kind === "work-optional") lines.push(amounts && extra?.age ? `Work optional at ${extra.age}` : "Work optional at a date I can see");
  lines.push("Made with BudgetFlow · no bank login");
  return lines.join("\n");
}
