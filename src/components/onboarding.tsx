import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  GOAL_LABELS,
  HOUSEHOLD_LABELS,
  HOUSING_LABELS,
  SPEND_BUCKETS,
  STAGE_LABELS,
  buildPresetCategories,
  defaultBuckets,
} from "@/lib/budget/presets";
import { formatMoney } from "@/lib/budget/money";
import { plannedTotals } from "@/lib/budget/totals";
import type { BudgetGoal, BudgetPeriod, Category, Household, Housing, IncomeStream, LifeStage, Profile } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";

const GOALS: BudgetGoal[] = ["track", "save", "debt", "purchase", "live-within"];
const STEPS = ["Welcome", "Household", "Life", "Income", "Spending", "Goals", "Categories", "Outlook"];

export function Onboarding({ initialStep = 0 }: { initialStep?: number }) {
  const existing = useBudgetStore((s) => s.profile);
  const hasData = useBudgetStore((s) => s.transactions.length > 0 || s.categories.length > 0);
  const completeSetup = useBudgetStore((s) => s.completeSetup);
  const cancelSetup = useBudgetStore((s) => s.cancelSetup);
  const loadSample = useBudgetStore((s) => s.loadSample);
  const restoreBackup = useBudgetStore((s) => s.restoreBackup);
  const signedIn = Boolean(useCurrentUser());
  const navigate = useNavigate();

  const updating = existing.completedOnboarding === false && hasData;

  const [step, setStep] = useState(updating ? 1 : initialStep);
  const [ledgerName, setLedgerName] = useState(existing.ledgerName || "");
  const [household, setHousehold] = useState<Household>(existing.household || "single");
  const [dependents, setDependents] = useState(existing.dependents || 0);
  const [lifeStage, setLifeStage] = useState<LifeStage>(existing.lifeStage || "early-career");
  const [housing, setHousing] = useState<Housing>(existing.housing || "rent");
  const [hasVehicle, setHasVehicle] = useState(existing.hasVehicle);
  const [usesTransit, setUsesTransit] = useState(existing.usesTransit);
  const [hasPets, setHasPets] = useState(existing.hasPets);
  const [streams, setStreams] = useState<IncomeStream[]>(
    existing.incomeStreams?.length ? existing.incomeStreams : [{ name: "Paycheck", monthly: existing.monthlyIncome || 0 }],
  );
  const [buckets, setBuckets] = useState<string[]>(existing.buckets?.length ? existing.buckets : []);
  const [goals, setGoals] = useState<BudgetGoal[]>(existing.goals?.length ? existing.goals : ["track"]);
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>(existing.budgetPeriod || "month");
  const [cats, setCats] = useState<Category[]>([]);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const monthlyIncome = streams.reduce((s, x) => s + (Number(x.monthly) || 0), 0);

  const profile: Profile = useMemo(
    () => ({
      ledgerName: ledgerName.trim() || "My ledger",
      household,
      dependents,
      lifeStage,
      housing,
      hasVehicle,
      usesTransit,
      hasPets,
      monthlyIncome,
      incomeStreams: streams,
      buckets,
      goals,
      completedOnboarding: true,
      budgetPeriod,
    }),
    [ledgerName, household, dependents, lifeStage, housing, hasVehicle, usesTransit, hasPets, monthlyIncome, streams, buckets, goals, budgetPeriod],
  );

  function toggleGoal(g: BudgetGoal) {
    setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  }

  function toggleBucket(slug: string) {
    setBuckets((cur) => (cur.includes(slug) ? cur.filter((x) => x !== slug) : [...cur, slug]));
  }

  function enterSpending() {
    setBuckets((cur) => (cur.length ? cur : defaultBuckets({ housing, hasVehicle, usesTransit, hasPets, lifeStage, dependents, goals })));
    setStep(4);
  }

  function goReview() {
    const nextBuckets = new Set(buckets);
    if (goals.includes("debt")) nextBuckets.add("debt");
    if (goals.includes("save") || goals.includes("purchase")) nextBuckets.add("savings");
    const list = [...nextBuckets];
    setBuckets(list);
    setCats(buildPresetCategories({ ...profile, buckets: list }));
    setStep(6);
  }

  async function onRestore(file: File) {
    setRestoreError(null);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const result = restoreBackup(raw);
      if (!result.ok) setRestoreError(result.error);
    } catch {
      setRestoreError("That file is not valid JSON.");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8 md:py-12">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
      {step > 0 ? (
        <div className="mt-4 flex gap-1" aria-label={`Step ${step} of ${STEPS.length - 1}`}>
          {STEPS.slice(1).map((label, i) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full ${i + 1 <= step ? "bg-primary" : "bg-chip"}`}
              title={label}
            />
          ))}
        </div>
      ) : null}

      {step === 0 ? (
        <div className="mt-4 space-y-6">
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Pick up where you left off.</h1>
          <p className="text-muted">
            Sign in if you already have an account. Try the demo if you want to look around. Or set up a new ledger for
            your household. Nothing logs into a bank.
          </p>
          <div className="flex flex-col gap-2">
            {signedIn ? null : (
              <Button className="w-full sm:w-auto" onClick={() => void navigate({ to: "/login" })}>
                Sign in
              </Button>
            )}
            <Button variant={signedIn ? "primary" : "outline"} onClick={() => loadSample()}>
              Try the demo
            </Button>
            <Button variant={signedIn ? "outline" : "ghost"} onClick={() => setStep(1)}>
              Set up a new household
            </Button>
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline-offset-2 hover:underline">
            Restore a backup JSON
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onRestore(f);
                e.target.value = "";
              }}
            />
          </label>
          {restoreError ? <p className="text-sm text-danger">{restoreError}</p> : null}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">Who is this for?</h1>
          <p className="text-sm text-muted">
            {updating
              ? "Transactions already in this browser stay. New category names remap by slug where they match."
              : "Put in your own details. The demo is only if you want to look around first."}
          </p>
          <Field label="Name this ledger">
            <Input value={ledgerName} onChange={(e) => setLedgerName(e.target.value)} placeholder="Household 2026" />
          </Field>
          <Field label="Household">
            <Select value={household} onChange={(e) => setHousehold(e.target.value as Household)}>
              {Object.entries(HOUSEHOLD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dependents you budget for">
            <Input
              type="number"
              min={0}
              max={12}
              value={dependents}
              onChange={(e) => setDependents(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <div className="flex flex-wrap gap-2 pt-2">
            {updating ? (
              <Button variant="outline" onClick={() => cancelSetup()}>
                Back to ledger
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
            )}
            <Button onClick={() => setStep(2)}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">How you live</h1>
          <Field label="Stage of life">
            <Select value={lifeStage} onChange={(e) => setLifeStage(e.target.value as LifeStage)}>
              {Object.entries(STAGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Housing">
            <Select value={housing} onChange={(e) => setHousing(e.target.value as Housing)}>
              {Object.entries(HOUSING_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vehicle you pay for">
            <Select value={hasVehicle ? "yes" : "no"} onChange={(e) => setHasVehicle(e.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
          <Field label="Regular transit or rideshare">
            <Select value={usesTransit ? "yes" : "no"} onChange={(e) => setUsesTransit(e.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
          <Field label="Pets you pay for">
            <Select value={hasPets ? "yes" : "no"} onChange={(e) => setHasPets(e.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">Money in</h1>
          <p className="text-sm text-muted">
            Name every regular source — paycheck, side work, benefits, whatever you actually receive. Typical monthly
            take-home after tax. Zero is fine; it only sizes starting plans.
          </p>
          <ul className="space-y-3">
            {streams.map((stream, i) => (
              <li key={i} className="grid grid-cols-2 gap-2">
                <Field label={i === 0 ? "Source name" : " "}>
                  <Input
                    value={stream.name}
                    onChange={(e) =>
                      setStreams((list) => list.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))
                    }
                    placeholder="Paycheck"
                  />
                </Field>
                <Field label={i === 0 ? "Typical monthly" : " "}>
                  <Input
                    inputMode="decimal"
                    value={stream.monthly ? String(stream.monthly) : ""}
                    onChange={(e) =>
                      setStreams((list) =>
                        list.map((s, j) => (j === i ? { ...s, monthly: Number(e.target.value) || 0 } : s)),
                      )
                    }
                    placeholder="0"
                  />
                </Field>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStreams((list) => [...list, { name: "", monthly: 0 }])}
            >
              Add another source
            </Button>
            {streams.length > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setStreams((list) => list.slice(0, -1))}>
                Remove last
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted">Together {formatMoney(monthlyIncome)} / month</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={enterSpending}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">What you budget for</h1>
          <p className="text-sm text-muted">
            Checked items become categories you can rename. Uncheck anything you do not use. You can add more later.
          </p>
          <div className="flex flex-col gap-2">
            {SPEND_BUCKETS.map((b) => {
              const on = buckets.includes(b.slug);
              return (
                <button
                  key={b.slug}
                  type="button"
                  onClick={() => toggleBucket(b.slug)}
                  className={`min-h-12 rounded-md border px-3 py-2 text-left ${on ? "border-primary bg-chip" : "border-border bg-surface"}`}
                >
                  <div className="text-sm font-medium">{b.label}</div>
                  <div className="text-xs text-muted">{b.hint}</div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button onClick={() => setStep(5)}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">What this budget is for</h1>
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => {
              const on = goals.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGoal(g)}
                  className={`min-h-12 rounded-md border px-3 text-left text-sm ${on ? "border-primary bg-chip" : "border-border bg-surface"}`}
                >
                  {GOAL_LABELS[g]}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(4)}>
              Back
            </Button>
            <Button onClick={goReview} disabled={goals.length === 0}>
              Build starting categories
            </Button>
          </div>
        </div>
      ) : null}

      {step === 6 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">Starting categories</h1>
          <p className="text-sm text-muted">
            Rename anything. Plans are monthly targets, not locks. Importing a CSV does not need these numbers to be
            perfect.
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {cats.map((c) => (
              <li key={c.id} className="flex gap-2 p-3">
                <Input
                  value={c.name}
                  onChange={(e) =>
                    setCats((list) => list.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))
                  }
                />
                <Input
                  className="w-28 shrink-0"
                  inputMode="decimal"
                  value={String(c.plannedMonthly)}
                  onChange={(e) =>
                    setCats((list) =>
                      list.map((x) => (x.id === c.id ? { ...x, plannedMonthly: Number(e.target.value) || 0 } : x)),
                    )
                  }
                />
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Income plan {formatMoney(cats.filter((c) => c.kind === "income").reduce((s, c) => s + c.plannedMonthly, 0))} ·
            Expense plan {formatMoney(cats.filter((c) => c.kind === "expense").reduce((s, c) => s + c.plannedMonthly, 0))}
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(5)}>
              Back
            </Button>
            <Button onClick={() => setStep(7)}>Review the outlook</Button>
          </div>
        </div>
      ) : null}

      {step === 7 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">A clear outlook</h1>
          <p className="text-sm text-muted">
            This is the plan before any CSV. Importing real activity will replace guesses with what actually happened.
          </p>
          {(() => {
            const monthly = plannedTotals(cats, "month");
            const weekly = plannedTotals(cats, "week");
            const housing = cats.find((c) => c.slug === "housing");
            const dining = cats.find((c) => c.slug === "dining");
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="text-xs uppercase tracking-wide text-muted">Monthly leftover</div>
                    <div className={`mt-1 font-display text-2xl tabular ${monthly.leftover < 0 ? "text-danger" : "text-good"}`}>
                      {formatMoney(monthly.leftover, { signed: true })}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      In {formatMoney(monthly.income)} · out {formatMoney(monthly.expenses)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="text-xs uppercase tracking-wide text-muted">Weekly envelope</div>
                    <div className={`mt-1 font-display text-2xl tabular ${weekly.leftover < 0 ? "text-danger" : "text-good"}`}>
                      {formatMoney(weekly.leftover, { signed: true })}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Spend ceiling {formatMoney(weekly.expenses)} / week
                    </div>
                  </div>
                </div>
                {monthly.leftover > 0 ? (
                  <p className="text-sm">
                    {formatMoney(monthly.leftover)} still has no job. On Plan, give it to savings or debt so every
                    dollar is assigned.
                  </p>
                ) : (
                  <p className="text-sm">
                    Planned expenses use all of take-home
                    {monthly.leftover < 0 ? ` and then some (${formatMoney(-monthly.leftover)} over)` : ""}. Trim
                    {dining ? ` dining (${formatMoney(dining.plannedMonthly)})` : " an envelope"} if that is tighter
                    than you want to live.
                  </p>
                )}
                {housing ? (
                  <p className="text-sm text-muted">
                    Housing is planned at {formatMoney(housing.plannedMonthly)}
                    {monthlyIncome > 0
                      ? ` (${Math.round((housing.plannedMonthly / monthlyIncome) * 100)}% of take-home)`
                      : ""}
                    . A common ceiling is about 30%.
                  </p>
                ) : null}
                <p className="text-sm text-muted">
                  Week view is for groceries, dining, and impulse spend. Month view is for rent, subscriptions, and
                  the leftover. You can switch any time.
                </p>
              </div>
            );
          })()}
          <Field label="Default review period">
            <Select value={budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value as BudgetPeriod)}>
              <option value="month">Month to month</option>
              <option value="week">Week to week</option>
            </Select>
          </Field>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(6)}>
              Back
            </Button>
            <Button onClick={() => completeSetup({ ...profile, budgetPeriod }, cats)}>
              {signedIn ? "Save and open the ledger" : "Open the ledger"}
            </Button>
          </div>
          {!signedIn ? (
            <p className="text-sm text-muted">You can sign in from the ledger whenever you want it saved to an account.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
