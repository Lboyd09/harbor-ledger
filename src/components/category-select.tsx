import type { Category, CategoryKind } from "@/lib/budget/types";
import { Select } from "./ui/field";

export function CategorySelect({
  categories,
  value,
  onChange,
  allowEmpty = true,
  kind,
  className,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowEmpty?: boolean;
  kind?: CategoryKind;
  className?: string;
}) {
  const selected = categories.find((c) => c.id === value);
  const income = categories.filter((c) => c.kind === "income" && (!kind || kind === "income"));
  const expense = categories.filter((c) => c.kind === "expense" && (!kind || kind === "expense"));
  const emptyLabel = kind === "income" ? "Pick an income category" : kind === "expense" ? "Pick an expense category" : "Needs category";
  return (
    <Select className={className} value={value ?? ""} aria-label={kind === "income" ? "Income category" : kind === "expense" ? "Expense category" : "Category"} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {selected && kind && selected.kind !== kind ? (
        <option value={selected.id}>{selected.name} (move this)</option>
      ) : null}
      {income.length ? (
        <optgroup label="Income">
          {income.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {expense.length ? (
        <optgroup label="Expenses">
          {expense.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </Select>
  );
}