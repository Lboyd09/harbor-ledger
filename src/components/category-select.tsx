import type { Category } from "@/lib/budget/types";
import { Select } from "./ui/field";

export function CategorySelect({
  categories,
  value,
  onChange,
  allowEmpty = true,
  className,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowEmpty?: boolean;
  className?: string;
}) {
  const income = categories.filter((c) => c.kind === "income");
  const expense = categories.filter((c) => c.kind === "expense");
  return (
    <Select
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      {allowEmpty ? <option value="">Needs category</option> : null}
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
