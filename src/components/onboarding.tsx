import { useMemo, useState } from "react";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { parseCsvText } from "@/lib/budget/csv";
import { formatMoney } from "@/lib/budget/money";
import { currentMonthKey } from "@/lib/budget/parse-date";
import { SPEND_BUCKETS, buildPresetCategories, defaultBuckets } from "@/lib/budget/presets";
import type { Category, Housing, Profile } from "@/lib/budget/types";
import { buildYearWorkbook, recommendedPlans } from "@/lib/budget/year";
import { useBudgetStore } from "@/store/budget-store";
import { CategorizeCoach } from "./categorize-coach";
import { FundWizard } from "./fund-wizard";
import { HarborMark } from "./harbor-mark";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/field";

const PATH_A = [
  { title: "What do you bring home each month?", why: "Harbor uses this to suggest a monthly amount for each category." },
  { title: "What do you pay for?", why: "These become your categories. Turn off anything you do not pay." },
  { title: "How much for each?", why: "A budget starts over every month. You can change these later." },
  { title: "Want to set money aside?", why: "A fund keeps what you do not spend. Skip this if you only want a monthly budget." },
  { title: "Add a bank file?", why: "A file from your bank fills in real charges. Harbor never logs into a bank." },
  { title: "You’re set", why: "This is your plan. Next, look at one month." },
];

const PATH_B = [
  { title: "Add your bank file", why: "Most charges come from a file you download. Harbor does not log into a bank." },
  { title: "Put each charge in a category", why: "A category is how you will see this spending every month." },
  { title: "How much for each?", why: "These start from the average in your file. A budget starts over every month." },
  { title: "What do you bring home?", why: "This starts from the deposits in the file. Fix it if a deposit was not pay." },
  { title: "Want to set money aside?", why: "Optional. A fund keeps what you do not spend." },
  { title: "You’re set", why: "Your file is in. Next, look at this month." },
];

export function Onboarding({ initialPath = null, onExit }: { initialPath?: "income" | "file" | null; onExit?: () => void }) {
  const existing = useBudgetStore((s) => s.profile);
  const transactions = useBudgetStore((s) => s.transactions);
  const completeSetup = useBudgetStore((s) => s.completeSetup);
  const cancelSetup = useBudgetStore((s) => s.cancelSetup);
  const importPreview = useBudgetStore((s) => s.importPreview);
  const categories = useBudgetStore((s) => s.categories);
  const hasData = transactions.length > 0 || categories.length > 0;
  const open = transactions.filter((t) => !t.categoryId && !t.excluded && t.status !== "transfer").length;

  const [path, setPath] = useState<"income" | "file" | null>(initialPath);
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState(existing.monthlyIncome ? String(existing.monthlyIncome) : "");
  const [housing, setHousing] = useState<Housing>(existing.housing || "rent");
  const [hasVehicle, setHasVehicle] = useState(existing.hasVehicle);
  const [picked, setPicked] = useState<string[] | null>(existing.buckets?.length ? existing.buckets : null);
  const [cats, setCats] = useState<Category[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const monthlyIncome = Math.max(0, Number(income) || 0);
  const steps = path === "file" ? PATH_B : PATH_A;
  const defaults = defaultBuckets({
    housing,
    hasVehicle,
    usesTransit: false,
    hasPets: false,
    lifeStage: existing.lifeStage || "early-career",
    dependents: existing.dependents || 0,
    goals: existing.goals?.length ? existing.goals : ["track"],
  });
  const slugs = picked ?? defaults;

  const profile: Profile = useMemo(
    () => ({
      ...existing,
      ledgerName: existing.ledgerName || "My ledger",
      housing,
      hasVehicle,
      monthlyIncome,
      incomeStreams: [{ id: "income_paycheck", name: "Paycheck", amount: monthlyIncome, cadence: "monthly", matchHints: [] }],
      buckets: slugs,
      goals: existing.goals?.length ? existing.goals : ["track"],
      completedOnboarding: true,
      budgetPeriod: existing.budgetPeriod || "month",
      detail: existing.detail === "nerd" ? "nerd" : "simple",
      detailChosen: true,
    }),
    [existing, housing, hasVehicle, monthlyIncome, slugs],
  );

  function stageCategories(list = slugs) {
    const built = buildPresetCategories({ ...profile, buckets: list });
    setCats(built);
    useBudgetStore.setState({ profile: { ...profile, completedOnboarding: false, buckets: list }, categories: built });
    return built;
  }

  function prefillFromFile() {
    const state = useBudgetStore.getState();
    const year = currentMonthKey().slice(0, 4);
    const recs = recommendedPlans(state.transactions, state.categories, year);
    const next = state.categories.map((c) => {
      const hit = recs.find((r) => r.id === c.id);
      return hit && c.kind === "expense" ? { ...c, plannedMonthly: hit.plannedMonthly } : c;
    });
    setCats(next);
    const book = buildYearWorkbook(state.transactions, state.categories, year);
    if (book.avgMonthlyIncome > 0) setIncome(String(Math.round(book.avgMonthlyIncome)));
  }

  function finish() {
    const built = cats.length ? cats : stageCategories();
    completeSetup(profile, built);
  }

  function back() {
    if (step === 0) {
      if (onExit) onExit();
      else setPath(null);
      return;
    }
    setStep(step - 1);
  }

  if (!path) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-5 py-8">
        <h1 className="font-display text-3xl font-semibold">How do you want to start?</h1>
        <p className="text-sm text-muted">Either way takes a few short steps. You can add the other part later.</p>
        <Button onClick={() => setPath("income")}>Start with my income and goals</Button>
        <Button variant="outline" onClick={() => setPath("file")}>Start with my bank file</Button>
        {hasData ? (
          <Button variant="ghost" onClick={() => cancelSetup()}>
            Back to the ledger
          </Button>
        ) : null}
      </div>
    );
  }

  const current = steps[step];
  const showingFund = (path === "income" && step === 3) || (path === "file" && step === 4);

  function afterFund() {
    const state = useBudgetStore.getState();
    const linked = new Set((state.moneyBuckets ?? []).flatMap((b) => b.categoryIds));
    setCats((local) => {
      const base = local.length ? local : state.categories;
      return state.categories.map((live) => {
        const edited = base.find((c) => c.id === live.id);
        return { ...live, plannedMonthly: linked.has(live.id) ? 0 : (edited?.plannedMonthly ?? live.plannedMonthly) };
      });
    });
    setStep(step + 1);
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
        Step {step + 1} of {steps.length}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
        <div className="h-full bg-primary" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      {showingFund ? null : <h1 className="mt-6 font-display text-3xl font-semibold">{current.title}</h1>}
      {showingFund ? null : <p className="mt-2 text-sm text-muted">{current.why}</p>}

      {path === "income" && step === 0 ? (
        <div className="mt-6 space-y-4">
          <Field label="Take-home pay each month">
            <Input inputMode="decimal" value={income} placeholder="0" onChange={(e) => setIncome(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" onClick={back}>Back</Button>
            <Button onClick={() => setStep(1)}>Continue</Button>
          </div>
        </div>
      ) : null}

      {path === "income" && step === 1 ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Housing">
              <div className="mt-1 flex flex-col gap-2">
                {(
                  [
                    ["rent", "I rent"],
                    ["own", "I own"],
                    ["family", "I don’t pay housing"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" className={`min-h-11 rounded-md border px-3 text-left text-sm ${housing === id ? "border-primary bg-chip" : "border-border bg-surface"}`} onClick={() => { setHousing(id); setPicked(null); }}>
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Do you pay for a car?">
              <div className="mt-1 flex flex-col gap-2">
                <button type="button" className={`min-h-11 rounded-md border px-3 text-left text-sm ${hasVehicle ? "border-primary bg-chip" : "border-border bg-surface"}`} onClick={() => { setHasVehicle(true); setPicked(null); }}>
                  Yes
                </button>
                <button type="button" className={`min-h-11 rounded-md border px-3 text-left text-sm ${!hasVehicle ? "border-primary bg-chip" : "border-border bg-surface"}`} onClick={() => { setHasVehicle(false); setPicked(null); }}>
                  No
                </button>
              </div>
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            {SPEND_BUCKETS.map((b) => {
              const on = slugs.includes(b.slug);
              return (
                <button
                  key={b.slug}
                  type="button"
                  onClick={() => {
                    const base = picked ?? defaults;
                    setPicked(base.includes(b.slug) ? base.filter((x) => x !== b.slug) : [...base, b.slug]);
                  }}
                  className={`min-h-12 rounded-md border px-3 py-2 text-left ${on ? "border-primary bg-chip" : "border-border bg-surface"}`}
                >
                  <div className="text-sm font-medium">{b.label}</div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={back}>Back</Button>
            <Button onClick={() => { stageCategories(); setStep(2); }}>Continue</Button>
          </div>
        </div>
      ) : null}

      {path === "income" && step === 2 ? (
        <AmountStep
          cats={cats.length ? cats : buildPresetCategories(profile)}
          onChange={(id, plannedMonthly) => setCats((list) => (list.length ? list : buildPresetCategories(profile)).map((x) => (x.id === id ? { ...x, plannedMonthly } : x)))}
          onBack={back}
          onNext={() => setStep(3)}
        />
      ) : null}

      {((path === "income" && step === 3) || (path === "file" && step === 4)) ? (
        <div className="mt-6">
          <FundWizard onDone={afterFund} onSkip={() => setStep(step + 1)} />
        </div>
      ) : null}

      {path === "income" && step === 4 ? (
        <FileStep
          note={note}
          onFile={(file) => {
            if (!cats.length) stageCategories();
            void file.text().then((text) => {
              const preview = parseCsvText(text, file.name);
              const result = importPreview(preview, false);
              setNote(`Added ${result.added}. ${result.uncategorized} still need a category.`);
            });
          }}
          onBack={back}
          onNext={() => setStep(5)}
          skipLabel="I’ll add a file later"
        />
      ) : null}

      {path === "file" && step === 0 ? (
        <div className="mt-6 space-y-4">
          <details className="rounded-lg border border-border bg-surface p-3 text-sm">
            <summary className="cursor-pointer font-medium">How do I get one from my bank?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>Sign in on your bank’s website or app.</li>
              <li>Open the account you want.</li>
              <li>Look for Download, Export, or Statements.</li>
              <li>Choose CSV, then save the file.</li>
              <li>Come back here and choose that file.</li>
            </ol>
          </details>
          <FileStep
            note={note}
            onFile={(file) => {
              if (!useBudgetStore.getState().categories.length) stageCategories();
              void file.text().then((text) => {
                const preview = parseCsvText(text, file.name);
                const result = importPreview(preview, false);
                setNote(`Added ${result.added}. ${result.uncategorized} still need a category.`);
                setStep(result.uncategorized > 0 ? 1 : 2);
                if (result.uncategorized === 0) prefillFromFile();
              });
            }}
            onBack={back}
            onNext={() => {
              if (!useBudgetStore.getState().categories.length) stageCategories();
              setStep(1);
            }}
            skipLabel="I’ll add a file later"
          />
        </div>
      ) : null}

      {path === "file" && step === 1 ? (
        <div className="mt-6">
          {open > 0 ? (
            <CategorizeCoach doneLabel="Continue" onClose={() => { prefillFromFile(); setStep(2); }} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">Nothing is waiting for a category.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={back}>Back</Button>
                <Button onClick={() => { prefillFromFile(); setStep(2); }}>Continue</Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {path === "file" && step === 2 ? (
        <AmountStep
          cats={cats.length ? cats : useBudgetStore.getState().categories}
          onChange={(id, plannedMonthly) => setCats((list) => (list.length ? list : useBudgetStore.getState().categories).map((x) => (x.id === id ? { ...x, plannedMonthly } : x)))}
          onBack={back}
          onNext={() => setStep(3)}
        />
      ) : null}

      {path === "file" && step === 3 ? (
        <div className="mt-6 space-y-4">
          <Field label="Take-home pay each month">
            <Input inputMode="decimal" value={income} placeholder="0" onChange={(e) => setIncome(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" onClick={back}>Back</Button>
            <Button onClick={() => setStep(4)}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm">Planned income {formatMoney(monthlyIncome)}.</p>
          <p className="text-sm text-muted">Next: open Home and look at one month. Funds and the monthly budget are one tap away.</p>
          <Button onClick={finish}>Open the ledger</Button>
        </div>
      ) : null}
    </div>
  );
}

function AmountStep({
  cats,
  onChange,
  onBack,
  onNext,
}: {
  cats: Category[];
  onChange: (id: string, plannedMonthly: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <ul className="space-y-2">
        {cats
          .filter((c) => c.kind === "expense")
          .map((c) => (
            <li key={c.id} className="grid grid-cols-[1fr_7rem] items-center gap-2">
              <span className="text-sm">{c.name}</span>
              <Input
                inputMode="decimal"
                aria-label={`Monthly amount for ${c.name}`}
                value={c.plannedMonthly ? String(c.plannedMonthly) : ""}
                onChange={(e) => onChange(c.id, Number(e.target.value) || 0)}
              />
            </li>
          ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}

function FileStep({
  note,
  onFile,
  onBack,
  onNext,
  skipLabel,
}: {
  note: string | null;
  onFile: (file: File) => void;
  onBack: () => void;
  onNext: () => void;
  skipLabel: string;
}) {
  return (
    <div className="mt-6 space-y-4">
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface px-4 text-center">
        <span className="font-medium">Choose a CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
      {note ? <p className="text-sm">{note}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>{note ? "Next" : skipLabel}</Button>
      </div>
    </div>
  );
}
