import { useState } from "react";
import type { IraRules } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { Input } from "../ui/field";
import { Field } from "./frame";
import { useGrow } from "./session";

export function SharedRates() {
  const g = useGrow();
  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-2">
      <Field label="Inflation %" tag="typed">
        <Input className="mt-1" inputMode="decimal" aria-label="Inflation percent" value={g.inflation} onChange={(e) => g.setInflation(e.target.value)} />
      </Field>
      <Field label="Rate %" tag={g.facts.returns.source === "typed" ? "typed" : "typed"}>
        <Input className="mt-1" inputMode="decimal" aria-label="Yearly rate" value={g.rate} onChange={(e) => g.setRate(e.target.value)} />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={g.today} onChange={(e) => g.setToday(e.target.checked)} />
        Today's dollars
      </label>
    </div>
  );
}

export function IraEditors() {
  const ira = useBudgetStore((s) => s.ira);
  const patchIra = useBudgetStore((s) => s.patchIra);
  const g = useGrow();
  if (!ira) return null;
  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-2">
      <Field label="Household income" tag="from your income">
        <Input className="mt-1" inputMode="decimal" aria-label="Household income" value={g.magi} onChange={(e) => g.setMagi(e.target.value)} />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={g.age50} onChange={(e) => g.setAge50(e.target.checked)} />
        Age 50 or older
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={g.joint} onChange={(e) => g.setJoint(e.target.checked)} />
        Married filing jointly
      </label>
      <LimitField label="Under 50 limit" aria="Under 50" year={ira.year} field="under50" value={ira.under50} onSave={patchIra} />
      <LimitField label="Catch-up" aria="Catch-up" year={ira.year} field="catchUp" value={ira.catchUp} onSave={patchIra} />
      <LimitField label="Roth single start" aria="Roth single start" year={ira.year} field="rothSingleStart" value={ira.rothSingleStart} onSave={patchIra} />
      <LimitField label="Roth single end" aria="Roth single end" year={ira.year} field="rothSingleEnd" value={ira.rothSingleEnd} onSave={patchIra} />
      <LimitField label="Roth joint start" aria="Roth joint start" year={ira.year} field="rothJointStart" value={ira.rothJointStart} onSave={patchIra} />
      <LimitField label="Roth joint end" aria="Roth joint end" year={ira.year} field="rothJointEnd" value={ira.rothJointEnd} onSave={patchIra} />
    </div>
  );
}

type LimitKey = "under50" | "catchUp" | "rothSingleStart" | "rothSingleEnd" | "rothJointStart" | "rothJointEnd";

/**
 * An IRS figure box that saves when you leave it or press Enter.
 * A blank or unreadable box puts the saved figure back instead of saving 0.
 */
function LimitField({
  label,
  aria,
  year,
  field,
  value,
  onSave,
}: {
  label: string;
  aria: string;
  year: number;
  field: LimitKey;
  value: number;
  onSave: (patch: Partial<IraRules>) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft == null) return;
    const cleaned = draft.replace(/[$,\s]/g, "");
    const next = /^(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : NaN;
    if (Number.isFinite(next) && next !== value) onSave({ [field]: next });
    setDraft(null);
  }
  return (
    <Field label={label} tag={`${year}, editable`}>
      <Input
        className="mt-1"
        inputMode="decimal"
        aria-label={aria}
        value={draft ?? String(value)}
        onFocus={() => setDraft(String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </Field>
  );
}
