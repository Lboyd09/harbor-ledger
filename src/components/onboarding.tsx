import { useMemo, useState } from "react";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { parseCsvText } from "@/lib/budget/csv";
import { formatMoney } from "@/lib/budget/money";
import { currentMonthKey } from "@/lib/budget/parse-date";
import { SPEND_BUCKETS, buildPresetCategories, defaultBuckets } from "@/lib/budget/presets";
import type { Category, DetailMode, Household, Housing, Profile } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { CategorizeCoach } from "./categorize-coach";
import { HarborMark } from "./harbor-mark";
import { FillJar, SpendMeter } from "./money-visual";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";

const STEPS = ["How it works", "About you", "What you spend on", "Your file", "Categorize", "Monthly amounts", "Saving", "Where to go"];

export function Onboarding({ initialStep = 0 }: { initialStep?: number }) {
  const existing = useBudgetStore((s) => s.profile);
  const transactions = useBudgetStore((s) => s.transactions);
  const hasData = transactions.length > 0 || useBudgetStore((s) => s.categories.length > 0);
  const completeSetup = useBudgetStore((s) => s.completeSetup);
  const cancelSetup = useBudgetStore((s) => s.cancelSetup);
  const importPreview = useBudgetStore((s) => s.importPreview);
  const addBucket = useBudgetStore((s) => s.addBucket);
  const open = transactions.filter((t) => !t.categoryId && !t.excluded && t.status !== "transfer").length;
  const updating = existing.completedOnboarding === false && hasData && initialStep > 0;

  const [step, setStep] = useState(open > 0 && initialStep > 0 ? 4 : initialStep);
  const [detail, setDetail] = useState<DetailMode>(existing.detail === "nerd" ? "nerd" : "simple");
  const [picked, setPicked] = useState(Boolean(existing.detailChosen));
  const [ledgerName, setLedgerName] = useState(existing.ledgerName || "");
  const [household, setHousehold] = useState<Household>(existing.household || "single");
  const [housing, setHousing] = useState<Housing>(existing.housing || "rent");
  const [hasVehicle, setHasVehicle] = useState(existing.hasVehicle);
  const [income, setIncome] = useState(existing.monthlyIncome ? String(existing.monthlyIncome) : "");
  const [buckets, setBuckets] = useState<string[]>(existing.buckets?.length ? existing.buckets : []);
  const [cats, setCats] = useState<Category[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveMonthly, setSaveMonthly] = useState("");

  const monthlyIncome = Math.max(0, Number(income) || 0);
  const profile: Profile = useMemo(
    () => ({
      ...existing,
      ledgerName: ledgerName.trim() || "My ledger",
      household,
      housing,
      hasVehicle,
      monthlyIncome,
      incomeStreams: [{ name: "Paycheck", monthly: monthlyIncome }],
      buckets,
      goals: existing.goals?.length ? existing.goals : ["track"],
      completedOnboarding: true,
      budgetPeriod: existing.budgetPeriod || "month",
      detail,
      detailChosen: true,
    }),
    [existing, ledgerName, household, housing, hasVehicle, monthlyIncome, buckets, detail],
  );

  function stageCategories() {
    const list = buckets.length ? buckets : defaultBuckets({ ...profile, lifeStage: profile.lifeStage || "early-career", dependents: profile.dependents || 0, usesTransit: profile.usesTransit, hasPets: profile.hasPets, goals: profile.goals });
    setBuckets(list);
    const built = buildPresetCategories({ ...profile, buckets: list });
    setCats(built);
    useBudgetStore.setState({ profile: { ...profile, completedOnboarding: false, buckets: list }, categories: built });
    return built;
  }

  function finish() {
    const built = cats.length ? cats : stageCategories();
    if (saveName.trim() && Number(saveMonthly) > 0) {
      addBucket({
        name: saveName.trim(),
        monthly: Number(saveMonthly) || 0,
        yearly: null,
        categoryIds: [],
        target: null,
        by: null,
        startMonth: currentMonthKey(),
        opening: 0,
      });
    }
    completeSetup(profile, built);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HarborMark className="size-5 text-primary" />
          <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
        </div>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">
        {STEPS[step]} · {step + 1} of {STEPS.length}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
        <div className="h-full bg-primary" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {step === 0 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-3xl font-semibold">Three things, then you’re in.</h1>
          <ol className="space-y-3 text-sm">
            <li className="rounded-lg border border-border bg-surface p-3">
              <div className="font-medium">1. Bring in the bank file</div>
              <p className="text-muted">A CSV. Harbor does not log into a bank. Then you tap a category for anything it couldn’t guess.</p>
            </li>
            <li className="rounded-lg border border-border bg-surface p-3">
              <div className="font-medium">2. Give each category a monthly amount</div>
              <div className="mt-2">
                <SpendMeter spent={40} plan={100} />
              </div>
              <p className="mt-2 text-muted">The bar is what you spent against what you allowed. Next month it starts over.</p>
            </li>
            <li className="flex gap-3 rounded-lg border border-border bg-surface p-3">
              <FillJar pct={55} />
              <div>
                <div className="font-medium">3. Turn on Keep leftovers only when you’re saving</div>
                <p className="text-muted">A car or a trip keeps what you don’t spend. Groceries usually should not.</p>
              </div>
            </li>
          </ol>
          <p className="text-sm">How much detail do you want after setup? You can change this in Account.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => { setDetail("simple"); setPicked(true); }} className={`min-h-16 rounded-lg border p-3 text-left ${picked && detail === "simple" ? "border-primary bg-chip" : "border-border bg-surface"}`}>
              <div className="font-medium">Simple</div>
              <p className="text-xs text-muted">The few numbers, and what to do next.</p>
            </button>
            <button type="button" onClick={() => { setDetail("nerd"); setPicked(true); }} className={`min-h-16 rounded-lg border p-3 text-left ${picked && detail === "nerd" ? "border-primary bg-chip" : "border-border bg-surface"}`}>
              <div className="font-medium">More detail</div>
              <p className="text-xs text-muted">Extra charts and a plan sandbox. Same ledger.</p>
            </button>
          </div>
          <Button disabled={!picked} onClick={() => setStep(1)}>Continue</Button>
          {updating ? (
            <Button variant="ghost" onClick={() => cancelSetup()}>Back to the ledger</Button>
          ) : null}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">About you</h1>
          <p className="text-sm text-muted">This only picks starting categories and a take-home number. You can rename everything later.</p>
          <Field label="Name this ledger">
            <Input value={ledgerName} placeholder="Household" onChange={(e) => setLedgerName(e.target.value)} />
          </Field>
          <Field label="Household">
            <Select value={household} onChange={(e) => setHousehold(e.target.value as Household)}>
              <option value="single">Just me</option>
              <option value="partnered">With a partner</option>
              <option value="married">Married</option>
            </Select>
          </Field>
          <Field label="Housing">
            <Select value={housing} onChange={(e) => setHousing(e.target.value as Housing)}>
              <option value="rent">I rent</option>
              <option value="own">I own</option>
              <option value="family">I don’t pay housing</option>
            </Select>
          </Field>
          <Field label="Do you pay for a car?">
            <Select value={hasVehicle ? "yes" : "no"} onChange={(e) => setHasVehicle(e.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
          <Field label="Typical monthly take-home">
            <Input inputMode="decimal" value={income} placeholder="0" onChange={(e) => setIncome(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={() => { if (!buckets.length) setBuckets(defaultBuckets(profile)); setStep(2); }}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">What should have a category?</h1>
          <p className="text-sm text-muted">Leave on what you actually pay. You’ll set the monthly amounts after the file is in.</p>
          <div className="flex flex-col gap-2">
            {SPEND_BUCKETS.map((b) => {
              const on = buckets.includes(b.slug);
              return (
                <button key={b.slug} type="button" onClick={() => setBuckets((cur) => (cur.includes(b.slug) ? cur.filter((x) => x !== b.slug) : [...cur, b.slug]))} className={`min-h-12 rounded-md border px-3 py-2 text-left ${on ? "border-primary bg-chip" : "border-border bg-surface"}`}>
                  <div className="text-sm font-medium">{b.label}</div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => { stageCategories(); setStep(3); }}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">Add your bank file</h1>
          <p className="text-sm text-muted">Download a CSV from the bank, then drop it here. You can skip and do this later from Account. The demo is only if you want fake data to click around.</p>
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface px-4 text-center">
            <span className="font-medium">Choose a CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void file.text().then((text) => {
                  if (!cats.length) stageCategories();
                  const preview = parseCsvText(text, file.name);
                  const result = importPreview(preview, false);
                  setNote(`Added ${result.added}. ${result.uncategorized} still need a category.`);
                });
              }}
            />
          </label>
          {note ? <p className="text-sm">{note}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(open > 0 || (note && note.includes("need")) ? 4 : 5)}>
              {note ? "Next" : "I’ll import later"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">Put each charge in a category</h1>
          {open > 0 ? (
            <CategorizeCoach doneLabel="Continue to monthly amounts" onClose={() => setStep(5)} />
          ) : (
            <>
              <p className="text-sm text-muted">Nothing is waiting. When you import, Month will show a button that walks you through anything without a category.</p>
              <Button onClick={() => setStep(5)}>Continue</Button>
            </>
          )}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">Monthly amounts</h1>
          <p className="text-sm text-muted">This is what the category resets to each month. Leave 0 if you don’t want a limit yet.</p>
          <ul className="space-y-2">
            {(cats.length ? cats : buildPresetCategories(profile))
              .filter((c) => c.kind === "expense")
              .map((c) => (
                <li key={c.id} className="grid grid-cols-[1fr_7rem] items-center gap-2">
                  <span className="text-sm">{c.name}</span>
                  <Input
                    inputMode="decimal"
                    aria-label={`Monthly amount for ${c.name}`}
                    value={c.plannedMonthly ? String(c.plannedMonthly) : ""}
                    onChange={(e) => {
                      const plannedMonthly = Number(e.target.value) || 0;
                      setCats((list) => (list.length ? list : buildPresetCategories(profile)).map((x) => (x.id === c.id ? { ...x, plannedMonthly } : x)));
                    }}
                  />
                </li>
              ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={() => setStep(6)}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 6 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">Saving for something?</h1>
          <div className="flex items-center gap-3">
            <FillJar pct={40} />
            <p className="text-sm text-muted">Optional. This keeps what you add. It is not a bill, and it is not income. You can also turn on Keep leftovers later on a category in Plan.</p>
          </div>
          <Field label="Name">
            <Input value={saveName} placeholder="Car, trip, emergency" onChange={(e) => setSaveName(e.target.value)} />
          </Field>
          <Field label="Add this much each month">
            <Input inputMode="decimal" value={saveMonthly} placeholder="0" onChange={(e) => setSaveMonthly(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(5)}>Back</Button>
            <Button onClick={() => setStep(7)}>{saveName.trim() ? "Save this and continue" : "Skip"}</Button>
          </div>
        </div>
      ) : null}

      {step === 7 ? (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-semibold">Where everything is</h1>
          <ul className="space-y-2 text-sm">
            <li><span className="font-medium">Month</span> — your charges. If any need a category, the button is at the top. Open a row to split it or tap “Someone paid me back.”</li>
            <li><span className="font-medium">Plan</span> — monthly amounts, the bar, and Keep leftovers. Saving for something is on this page.</li>
            <li><span className="font-medium">Grow</span> — emergency fund, debt payoff, net worth, and the other calculators. You type debts and net worth. Nothing connects to a bank.</li>
            <li><span className="font-medium">Year</span> — tap a month, or tap a category under it.</li>
            <li><span className="font-medium">Account</span> — import another file, the look, Simple or More detail, Excel.</li>
          </ul>
          <Button onClick={finish}>Open the ledger</Button>
          <p className="text-sm text-muted">Planned income {formatMoney(monthlyIncome)}.</p>
        </div>
      ) : null}
    </div>
  );
}
