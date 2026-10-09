import { useState } from "react";
import { readNumber } from "@/lib/budget/calc-input";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A short form for a charge you paid in cash. The date cannot be in the future. */
export function AddCharge({ onClose }: { onClose: () => void }) {
  const categories = useBudgetStore((s) => s.categories);
  const addCashCharge = useBudgetStore((s) => s.addCashCharge);
  const expenses = categories.filter((category) => category.kind === "expense");
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const [categoryId, setCategoryId] = useState(expenses[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();

  function save() {
    const value = readNumber(amount);
    if (value == null || value <= 0) {
      setError("Enter an amount.");
      return;
    }
    if (!categoryId) {
      setError("Pick a category.");
      return;
    }
    if (date > today) {
      setError("That date is still in the future. Use today, or pick a past day.");
      return;
    }
    addCashCharge({ categoryId, amount: value, date, description: what.trim() || "Cash" });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Add a transaction">
      <form
        className="w-full max-w-md space-y-3 rounded-lg border border-border bg-surface p-4 shadow-lg"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <h2 className="font-display text-xl font-semibold">Add a transaction</h2>
        <p className="text-sm text-muted">Cash you spent. It lands in this month’s budget.</p>
        <Field label="Amount">
          <Input inputMode="decimal" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="What for">
          <Input aria-label="What for" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Farmers market" />
        </Field>
        <Field label="Category">
          <Select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {expenses.length === 0 ? <option value="">No categories yet</option> : null}
            {expenses.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" aria-label="Date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}
