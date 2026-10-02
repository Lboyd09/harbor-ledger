import { orderedCategories } from "@/lib/budget/plans";
import type { Category, CategoryKind } from "@/lib/budget/types";
import { Select } from "./ui/field";

function labels(list: Category[]) {
  return orderedCategories(list).map((c) => {
    const parent = c.parentId ? list.find((p) => p.id === c.parentId) : undefined;
    return { id: c.id, label: parent ? `${parent.name} — ${c.name}` : c.name, kind: c.kind };
  });
}

export function CategorySelect({
  categories,
  value,
  onChange,
  allowEmpty = true,
  kind,
  className,
  payback = false,
  onPayback,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowEmpty?: boolean;
  kind?: CategoryKind;
  className?: string;
  /** Expense rows can mark a repayment from this list. */
  payback?: boolean;
  onPayback?: () => void;
}) {
  const selected = categories.find((c) => c.id === value);
  const income = labels(categories.filter((c) => c.kind === "income" && (!kind || kind === "income")));
  const expense = labels(categories.filter((c) => c.kind === "expense" && (!kind || kind === "expense")));
  const emptyLabel = kind === "income" ? "Pick an income category" : kind === "expense" ? "Pick an expense category" : "Needs category";
  const shown = value === "__payback__" ? "__payback__" : (value ?? "");
  return (
    <Select
      className={className}
      value={shown}
      aria-label={kind === "income" ? "Income category" : kind === "expense" ? "Expense category" : "Category"}
      onChange={(e) => {
        if (e.target.value === "__payback__") {
          onPayback?.();
          return;
        }
        onChange(e.target.value || null);
      }}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {selected && kind && selected.kind !== kind ? <option value={selected.id}>{selected.name} (move this)</option> : null}
      {income.length ? (
        <optgroup label="Income">
          {income.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </optgroup>
      ) : null}
      {expense.length ? (
        <optgroup label="Expenses">
          {expense.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          {payback ? <option value="__payback__">Payback</option> : null}
        </optgroup>
      ) : payback ? (
        <option value="__payback__">Payback</option>
      ) : null}
    </Select>
  );
}
