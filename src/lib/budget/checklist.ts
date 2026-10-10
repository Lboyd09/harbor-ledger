export type ChecklistItem = { id: string; label: string; done: boolean };

export function startedChecklist(state: {
  hasImport: boolean;
  unsorted: number;
  hasPlan: boolean;
  hasBalance: boolean;
  hasGoal: boolean;
}): ChecklistItem[] {
  return [
    { id: "file", label: "Add a bank file", done: state.hasImport },
    { id: "sort", label: "Sort the top names", done: state.unsorted === 0 && state.hasImport },
    { id: "plan", label: "Confirm the plan", done: state.hasPlan },
    { id: "balance", label: "Add a balance", done: state.hasBalance },
    { id: "goal", label: "Set a goal", done: state.hasGoal },
  ];
}

export function checklistOpen(items: ChecklistItem[], dismissed: boolean): boolean {
  if (dismissed) return false;
  return items.some((item) => !item.done);
}
