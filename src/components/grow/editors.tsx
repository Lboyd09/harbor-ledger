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
      <Field label="Under 50 limit" tag={`${ira.year}, editable`}>
        <Input className="mt-1" inputMode="decimal" aria-label="Under 50" value={String(ira.under50)} onChange={(e) => patchIra({ under50: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="Catch-up" tag={`${ira.year}, editable`}>
        <Input className="mt-1" inputMode="decimal" aria-label="Catch-up" value={String(ira.catchUp)} onChange={(e) => patchIra({ catchUp: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="Roth single start" tag={`${ira.year}, editable`}>
        <Input className="mt-1" inputMode="decimal" aria-label="Roth single start" value={String(ira.rothSingleStart)} onChange={(e) => patchIra({ rothSingleStart: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="Roth single end" tag={`${ira.year}, editable`}>
        <Input className="mt-1" inputMode="decimal" aria-label="Roth single end" value={String(ira.rothSingleEnd)} onChange={(e) => patchIra({ rothSingleEnd: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="Roth joint start" tag={`${ira.year}, editable`}>
        <Input className="mt-1" inputMode="decimal" aria-label="Roth joint start" value={String(ira.rothJointStart)} onChange={(e) => patchIra({ rothJointStart: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="Roth joint end" tag={`${ira.year}, editable`}>
        <Input className="mt-1" inputMode="decimal" aria-label="Roth joint end" value={String(ira.rothJointEnd)} onChange={(e) => patchIra({ rothJointEnd: Number(e.target.value) || 0 })} />
      </Field>
    </div>
  );
}
