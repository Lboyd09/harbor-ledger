import { useEffect, useState } from "react";
import { fullLineOf, goalPace, monthName, monthsInclusive } from "@/lib/budget/buckets";
import { formatMoney, roundMoney } from "@/lib/budget/money";
import { currentMonthKey } from "@/lib/budget/parse-date";
import type { MoneyBucket } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { FillJar } from "./money-visual";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

const NAMES = ["Vacation", "Emergency fund", "Car", "Groceries", "Gifts", "Something else"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const FUND_LINK_KEY = "harbor-fund-link";
export const FUND_PREFILL_KEY = "harbor-fund-prefill";

export const queueFundWizard = (categoryId?: string) => {
  sessionStorage.setItem(FUND_LINK_KEY, categoryId ?? "");
};

export function queueFundFromGoal(prefill: { name: string; target: number; by: string | null; monthly: number }) {
  sessionStorage.setItem(FUND_PREFILL_KEY, JSON.stringify(prefill));
  sessionStorage.setItem(FUND_LINK_KEY, "");
}

function readFundPrefill() {
  try {
    const raw = sessionStorage.getItem(FUND_PREFILL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { name?: string; target?: number; by?: string | null; monthly?: number };
  } catch {
    return null;
  }
}

export function FundWizard({
  linkedCategoryId = null,
  onDone,
  onSkip,
}: {
  linkedCategoryId?: string | null;
  onDone: () => void;
  onSkip: () => void;
}) {
  const categories = useBudgetStore((s) => s.categories);
  const funds = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const activeMonth = useBudgetStore((s) => s.activeMonth);
  const addBucket = useBudgetStore((s) => s.addBucket);
  const linkBucketCategory = useBudgetStore((s) => s.linkBucketCategory);
  const start = /^\d{4}-\d{2}$/.test(activeMonth) ? activeMonth : currentMonthKey();
  const prefill = useState(readFundPrefill)[0];
  useEffect(() => {
    sessionStorage.removeItem(FUND_PREFILL_KEY);
  }, []);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(prefill?.name ?? "");
  const [custom, setCustom] = useState(Boolean(prefill?.name && !NAMES.includes(prefill.name)));
  const [wantsGoal, setWantsGoal] = useState<boolean | null>(prefill ? true : null);
  const [target, setTarget] = useState(prefill?.target ? String(prefill.target) : "");
  const [byMonth, setByMonth] = useState(prefill?.by?.slice(5, 7) ?? "");
  const [byYear, setByYear] = useState(prefill?.by?.slice(0, 4) ?? "");
  const [per, setPer] = useState<"month" | "year">("month");
  const [amount, setAmount] = useState(prefill?.monthly ? String(prefill.monthly) : "");
  const [seeded, setSeeded] = useState(Boolean(prefill?.monthly));
  const [chosen, setChosen] = useState<string[]>(linkedCategoryId ? [linkedCategoryId] : []);
  const [opening, setOpening] = useState("");

  const yearNow = Number(start.slice(0, 4));
  const years = Array.from({ length: 16 }, (_, i) => String(yearNow + i));
  const by = byMonth && byYear ? `${byYear}-${byMonth}` : null;
  const targetN = Number(target) > 0 ? Number(target) : 0;
  const span = by && by >= start ? monthsInclusive(start, by) : 0;
  const suggested = wantsGoal && targetN > 0 && span > 0 ? Math.ceil((targetN / span) * 100) / 100 : null;
  const typed = Number(amount) || 0;
  const monthly = per === "year" ? roundMoney(typed / 12) : roundMoney(typed);
  const yearly = per === "year" && typed > 0 ? roundMoney(typed) : null;
  const taken = new Set(funds.flatMap((b) => b.categoryIds));
  const available = categories.filter(
    (c) => c.kind === "expense" && !c.parentId && (!taken.has(c.id) || c.id === linkedCategoryId),
  );

  function goAmount(goal: boolean | null = wantsGoal) {
    const useSuggested = goal && suggested;
    if (!seeded && useSuggested && !amount) {
      setAmount(String(suggested));
      setPer("month");
      setSeeded(true);
    }
    setStep(2);
  }

  function create() {
    const id = addBucket({
      name: name.trim(),
      monthly,
      yearly,
      categoryIds: [],
      target: wantsGoal && targetN > 0 ? targetN : null,
      by: wantsGoal ? by : null,
      startMonth: start,
      opening: Math.max(0, Number(opening) || 0),
      fullLine: null,
    });
    if (!id) return;
    for (const categoryId of chosen) linkBucketCategory(id, categoryId);
    onDone();
  }

  const preview: MoneyBucket = {
    id: "preview",
    name: name.trim() || "Fund",
    monthly,
    yearly,
    categoryIds: chosen,
    target: wantsGoal && targetN > 0 ? targetN : null,
    by: wantsGoal ? by : null,
    startMonth: start,
    opening: Math.max(0, Number(opening) || 0),
    fullLine: null,
  };
  const line = fullLineOf(preview);
  const pace = goalPace(preview, preview.opening, start);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {step < 5 ? `Question ${step + 1} of 5` : "Review"}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-chip">
        <div className="h-full bg-primary" style={{ width: `${((Math.min(step, 4) + 1) / 5) * 100}%` }} />
      </div>

      {step === 0 ? (
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-semibold">What are you setting money aside for?</h1>
          <p className="text-sm text-muted">A name makes this fund easy to find later.</p>
          <div className="flex flex-wrap gap-2">
            {NAMES.map((label) => (
              <button
                key={label}
                type="button"
                className={`min-h-11 rounded-full border px-3 text-sm ${name === label || (label === "Something else" && custom) ? "border-primary bg-chip" : "border-border bg-surface"}`}
                onClick={() => {
                  if (label === "Something else") {
                    setCustom(true);
                    setName("");
                  } else {
                    setCustom(false);
                    setName(label);
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {custom || (name && !NAMES.includes(name)) ? (
            <Input aria-label="Fund name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!name.trim()} onClick={() => setStep(1)}>
              Continue
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              Not now
            </Button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-semibold">Is there a goal amount?</h1>
          <p className="text-sm text-muted">A goal is optional. You can just keep adding each month.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className={`min-h-16 rounded-lg border p-3 text-left ${wantsGoal === true ? "border-primary bg-chip" : "border-border bg-surface"}`} onClick={() => setWantsGoal(true)}>
              Yes, there is an amount
            </button>
            <button type="button" className={`min-h-16 rounded-lg border p-3 text-left ${wantsGoal === false ? "border-primary bg-chip" : "border-border bg-surface"}`} onClick={() => setWantsGoal(false)}>
              No, just keep adding
            </button>
          </div>
          {wantsGoal ? (
            <div className="space-y-2">
              <label className="block text-sm text-muted">
                Goal amount
                <Input className="mt-1" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
              </label>
              <p className="text-sm text-muted">By when? Optional.</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm text-muted">
                  Month
                  <select className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-2" value={byMonth} onChange={(e) => setByMonth(e.target.value)}>
                    <option value="">No month</option>
                    {MONTHS.map((label, index) => (
                      <option key={label} value={String(index + 1).padStart(2, "0")}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-muted">
                  Year
                  <select className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-2" value={byYear} onChange={(e) => setByYear(e.target.value)}>
                    <option value="">No year</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button disabled={wantsGoal === null || (wantsGoal === true && !(targetN > 0))} onClick={() => goAmount()}>
              Continue
            </Button>
            <Button variant="ghost" onClick={() => { setWantsGoal(false); goAmount(false); }}>
              Skip
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-semibold">How much goes in each month?</h1>
          <p className="text-sm text-muted">This is added on the 1st. The first month is added right away.</p>
          <div className="flex gap-2">
            <button type="button" className={`min-h-11 rounded-md px-3 text-sm ${per === "month" ? "bg-primary text-primary-fg" : "border border-border bg-surface"}`} onClick={() => setPer("month")}>
              Each month
            </button>
            <button type="button" className={`min-h-11 rounded-md px-3 text-sm ${per === "year" ? "bg-primary text-primary-fg" : "border border-border bg-surface"}`} onClick={() => setPer("year")}>
              Each year
            </button>
          </div>
          <Input aria-label={per === "year" ? "Amount each year" : "Amount each month"} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {per === "year" ? <p className="text-sm">{formatMoney(typed)} a year is {formatMoney(monthly)} a month.</p> : null}
          {suggested && per === "month" ? (
            <p className="text-sm text-muted">{formatMoney(suggested)} a month reaches {formatMoney(targetN)}{by ? ` by ${monthName(by)} ${by.slice(0, 4)}` : ""}.</p>
          ) : null}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-semibold">Should spending come out of this fund?</h1>
          <p className="text-sm text-muted">Pick Groceries for a food fund. Skip this for plain savings. A category you pick will no longer have a monthly amount, so it is not counted twice.</p>
          <ul className="space-y-2">
            {available.map((c) => {
              const on = chosen.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`min-h-11 w-full rounded-md border px-3 text-left text-sm ${on ? "border-primary bg-chip" : "border-border bg-surface"}`}
                    onClick={() => setChosen((cur) => (cur.includes(c.id) ? cur.filter((id) => id !== c.id) : [...cur, c.id]))}
                  >
                    {c.name}
                  </button>
                </li>
              );
            })}
          </ul>
          {available.length === 0 ? <p className="text-sm text-muted">No spending categories are free to attach.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => setStep(4)}>Continue</Button>
            <Button variant="ghost" onClick={() => { setChosen(linkedCategoryId ? [linkedCategoryId] : []); setStep(4); }}>
              Skip
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-semibold">Is there money in it already?</h1>
          <p className="text-sm text-muted">Optional. This is money you already set aside, before this month’s add.</p>
          <Input aria-label="Money already in the fund" inputMode="decimal" placeholder="0" value={opening} onChange={(e) => setOpening(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button onClick={() => setStep(5)}>Continue</Button>
            <Button variant="ghost" onClick={() => { setOpening(""); setStep(5); }}>
              Skip
            </Button>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-semibold">Review</h1>
          <div className="flex gap-3 rounded-lg border border-border bg-surface p-4">
            <FillJar pct={line > 0 ? (preview.opening / line) * 100 : 0} />
            <div>
              <div className="font-medium">{preview.name}</div>
              <p className="mt-1 text-sm text-muted">
                {monthly > 0
                  ? `${formatMoney(monthly)} goes in on the 1st of every month starting this month.`
                  : "Nothing is added automatically. You can move money in later."}
              </p>
              {pace && preview.target ? (
                <p className="mt-1 text-sm text-muted">
                  {pace.required != null && preview.by
                    ? `${formatMoney(pace.required)} a month gets you there by ${monthName(preview.by)} ${preview.by.slice(0, 4)}.`
                    : `${formatMoney(preview.target)} is the goal.`}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(4)}>
              Back
            </Button>
            <Button onClick={create}>Create fund</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
