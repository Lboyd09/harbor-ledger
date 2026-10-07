import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { totalBalance } from "@/lib/budget/accounts";
import { formatMoney, roundMoney } from "@/lib/budget/money";
import { newId } from "@/lib/budget/ids";
import {
  CATEGORY_GROUPS,
  answersFromLedger,
  answersToProfile,
  blankAnswers,
  buildSetup,
  categoryHint,
  categoryLabel,
  customSlug,
  fitToIncome,
  householdSentence,
  savingsPlanMonthly,
  selectedSlugs,
  suggestAmounts,
  suggestedCategorySlugs,
  type SetupAnswers,
  type SetupIncome,
} from "@/lib/budget/onboarding-plan";
import { currentMonthKey } from "@/lib/budget/parse-date";
import { TERMS } from "@/lib/copy/terms";
import type { AccountKind, BudgetStyle, Housing, IncomeCadence } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { HarborMark } from "./harbor-mark";
import { useLivelyMotion } from "./use-lively-motion";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";

const STEPS = [
  { title: "About you", why: "Why we ask: this picks a starting list of what you pay for." },
  { title: "What you pay for", why: "Why we ask: these become the categories on your plan." },
  { title: "Money coming in", why: "Why we ask: BudgetFlow uses this to suggest an amount for each category." },
  { title: "How leftover money works", why: "Why we ask: this decides what happens to money you do not spend." },
  { title: "Your amounts", why: "Why we ask: these are a starting plan. You can change any month later." },
  { title: `Accounts and a ${TERMS.savingsPlan.toLowerCase()}`, why: "Why we ask: a balance today lets BudgetFlow show your money before a file." },
  { title: "Your plan on one page", why: "Why we ask: check this once, then add a file or look around." },
];

const CADENCE: { id: IncomeCadence; label: string }[] = [
  { id: "monthly", label: "Every month" },
  { id: "twice-monthly", label: "Twice a month" },
  { id: "biweekly", label: "Every two weeks" },
  { id: "weekly", label: "Every week" },
  { id: "irregular", label: "It varies" },
];

const KINDS: { id: AccountKind; label: string; name: string }[] = [
  { id: "checking", label: "Checking", name: "Checking" },
  { id: "savings", label: "Savings", name: "Savings" },
  { id: "credit", label: "Credit card", name: "Credit card" },
  { id: "retirement", label: "Roth IRA or other retirement", name: "Roth IRA" },
  { id: "investment", label: "Investments", name: "Investments" },
  { id: "other", label: "Other", name: "Other" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const BAR_COLORS = ["var(--color-primary)", "var(--color-good)", "var(--color-warn)", "var(--color-muted)"];

function todayStamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function choiceClass(on: boolean) {
  return `min-h-11 rounded-md border px-3 py-2 text-left text-sm ${on ? "border-primary bg-chip" : "border-border bg-surface"}`;
}

export function Onboarding({ onExit }: { onExit?: () => void }) {
  const completeSetup = useBudgetStore((s) => s.completeSetup);
  const cancelSetup = useBudgetStore((s) => s.cancelSetup);
  const hasData = useBudgetStore((s) => s.transactions.length > 0 || s.categories.length > 0);
  const navigate = useNavigate();
  const lively = useLivelyMotion();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [customName, setCustomName] = useState("");
  const [showAccounts, setShowAccounts] = useState(() => (useBudgetStore.getState().accounts ?? []).length > 0);
  const [showSavings, setShowSavings] = useState(() => (useBudgetStore.getState().moneyBuckets ?? []).length > 0);
  const [pickingKind, setPickingKind] = useState(false);
  const [answers, setAnswers] = useState<SetupAnswers>(() => {
    const state = useBudgetStore.getState();
    if (state.categories.length || (state.accounts ?? []).length || (state.moneyBuckets ?? []).length) {
      return answersFromLedger({
        profile: state.profile,
        categories: state.categories,
        accounts: state.accounts ?? [],
        balances: state.balances ?? [],
        moneyBuckets: state.moneyBuckets ?? [],
        year: Number(todayStamp().slice(0, 4)),
      });
    }
    return blankAnswers();
  });

  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);

  const fields = useMemo(() => answersToProfile(answers), [answers]);
  const slugs = selectedSlugs(answers);
  const splitDining = slugs.includes("dining");
  const shownAmounts = useMemo(() => {
    const suggested = suggestAmounts(answers, fields.monthlyIncome);
    if (!answers.amountsTouched) return suggested;
    const next = { ...suggested };
    for (const slug of slugs) {
      const edited = answers.amounts[slug];
      if (edited != null && Number.isFinite(edited)) next[slug] = edited;
    }
    return next;
  }, [answers, fields.monthlyIncome, slugs]);
  const plannedTotal = roundMoney(slugs.reduce((sum, slug) => sum + (shownAmounts[slug] ?? 0), 0));
  const incomeTotal = fields.monthlyIncome;
  const leftOver = roundMoney(incomeTotal - plannedTotal);
  const current = STEPS[step] ?? STEPS[0];
  const today = todayStamp();
  const month = currentMonthKey();

  function patch(partial: Partial<SetupAnswers>) {
    setAnswers((prev) => ({ ...prev, ...partial }));
  }

  function go(next: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  function toggleSlug(slug: string) {
    setAnswers((prev) => {
      const base = prev.categoriesTouched ? prev.categorySlugs : suggestedCategorySlugs(prev);
      const categorySlugs = base.includes(slug) ? base.filter((item) => item !== slug) : [...base, slug];
      return { ...prev, categoriesTouched: true, categorySlugs };
    });
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    setAnswers((prev) => {
      const base = prev.categoriesTouched ? prev.categorySlugs : suggestedCategorySlugs(prev);
      const slug = customSlug(name, [...base, ...prev.customCategories.map((item) => item.slug)]);
      return {
        ...prev,
        categoriesTouched: true,
        categorySlugs: [...base, slug],
        customCategories: [...prev.customCategories, { slug, name }],
      };
    });
    setCustomName("");
  }

  function setAmount(slug: string, value: number) {
    setAnswers((prev) => {
      const income = answersToProfile(prev).monthlyIncome;
      const base = prev.amountsTouched ? { ...suggestAmounts(prev, income), ...prev.amounts } : suggestAmounts(prev, income);
      return { ...prev, amountsTouched: true, amounts: { ...base, [slug]: Math.max(0, value || 0) } };
    });
  }

  function fit() {
    setAnswers((prev) => {
      const income = answersToProfile(prev).monthlyIncome;
      const currentAmounts = prev.amountsTouched ? { ...suggestAmounts(prev, income), ...prev.amounts } : suggestAmounts(prev, income);
      return { ...prev, amountsTouched: true, amounts: fitToIncome(currentAmounts, income) };
    });
  }

  function finish(where: "home" | "import") {
    const state = useBudgetStore.getState();
    const built = buildSetup(answers, state.profile, { today });
    completeSetup(built.profile, built.categories, built.extras);
    void navigate({ to: where === "import" ? "/import" : "/" });
  }

  function advance() {
    if (step === 3 && !answers.budgetStyle) return;
    if (step >= STEPS.length - 1) return;
    go(step + 1);
  }

  const amountLine =
    incomeTotal > 0
      ? leftOver >= 0
        ? `Planned ${formatMoney(plannedTotal)} of about ${formatMoney(incomeTotal)} a month. ${formatMoney(leftOver)} left over.`
        : `Planned ${formatMoney(plannedTotal)} of about ${formatMoney(incomeTotal)} a month. Over by ${formatMoney(Math.abs(leftOver))}.`
      : "";

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HarborMark className="size-5 text-primary" />
          <p className="text-sm font-medium uppercase tracking-widest text-muted">BudgetFlow</p>
        </div>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Step {step + 1} of 7</p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={7}
        aria-valuenow={step + 1}
        aria-label={`Step ${step + 1} of 7`}
      >
        <div className="h-full bg-primary" style={{ width: `${((step + 1) / 7) * 100}%` }} />
      </div>
      <form
        className="mt-6 flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          advance();
        }}
      >
        <h1 ref={titleRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          {current?.title}
        </h1>
        <p className="mt-2 text-sm text-muted">{current?.why}</p>

        {step === 0 ? (
          <AboutStep answers={answers} onChange={patch} />
        ) : null}
        {step === 1 ? (
          <PayForStep
            answers={answers}
            slugs={slugs}
            customName={customName}
            onCustomName={setCustomName}
            onToggle={toggleSlug}
            onChip={patch}
            onAddCustom={addCustom}
          />
        ) : null}
        {step === 2 ? (
          <IncomeStep
            answers={answers}
            total={incomeTotal}
            onChange={patch}
          />
        ) : null}
        {step === 3 ? <StyleStep answers={answers} lively={lively} onPick={(budgetStyle) => patch({ budgetStyle })} /> : null}
        {step === 4 ? (
          <AmountsStep
            answers={answers}
            slugs={slugs}
            splitDining={splitDining}
            amounts={shownAmounts}
            income={incomeTotal}
            planned={plannedTotal}
            line={amountLine}
            onAmount={setAmount}
            onFit={fit}
          />
        ) : null}
        {step === 5 ? (
          <AccountsStep
            answers={answers}
            month={month}
            showAccounts={showAccounts}
            showSavings={showSavings}
            pickingKind={pickingKind}
            onShowAccounts={() => {
              setShowAccounts(true);
              setPickingKind(true);
            }}
            onShowSavings={() => {
              setShowSavings(true);
              if (!answers.savings) {
                patch({ savings: { id: newId("plan"), name: "", target: 0, by: null } });
              }
            }}
            onPickKind={(kind) => {
              const id = newId("acct");
              const label = KINDS.find((item) => item.id === kind);
              patch({
                accounts: [
                  ...answers.accounts,
                  { id, kind, name: label?.name ?? "Account", institution: "", balance: null, balanceId: `bal_${id}` },
                ],
              });
              setPickingKind(false);
            }}
            onPicking={setPickingKind}
            onChange={patch}
          />
        ) : null}
        {step === 6 ? (
          <SummaryStep
            answers={answers}
            slugs={slugs}
            amounts={shownAmounts}
            line={amountLine || `Planned ${formatMoney(plannedTotal)} a month.`}
            income={incomeTotal}
            onChange={go}
          />
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => go(step - 1)}>
              Back
            </Button>
          ) : onExit ? (
            <Button type="button" variant="outline" onClick={onExit}>
              Back
            </Button>
          ) : null}
          {step === 0 && hasData ? (
            <Button type="button" variant="ghost" onClick={() => cancelSetup()}>
              Back to the ledger
            </Button>
          ) : null}
          {step === 2 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                patch({ incomeUnknown: true });
                go(3);
              }}
            >
              I'm not sure yet
            </Button>
          ) : null}
          {step === 5 && answers.accounts.length === 0 && !answers.savings?.name ? (
            <Button type="button" variant="ghost" onClick={() => go(6)}>
              Skip
            </Button>
          ) : null}
          {step < 6 ? (
            <Button type="submit" disabled={step === 3 && !answers.budgetStyle}>
              Continue
            </Button>
          ) : (
            <>
              <Button type="button" onClick={() => finish("import")}>
                Add my bank file now
              </Button>
              <Button type="button" variant="outline" onClick={() => finish("home")}>
                Look around first
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function AboutStep({ answers, onChange }: { answers: SetupAnswers; onChange: (patch: Partial<SetupAnswers>) => void }) {
  return (
    <div className="mt-6 space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Household</legend>
        <div className="grid gap-2">
          {(
            [
              ["just-me", "Just me"],
              ["partner", "Me and my partner"],
              ["kids", "I have kids at home"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={choiceClass(answers.householdChoice === id)} onClick={() => onChange({ householdChoice: id })}>
              {label}
            </button>
          ))}
        </div>
        {answers.householdChoice === "kids" ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">How many</span>
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-md border border-border bg-surface"
              onClick={() => onChange({ dependents: Math.max(1, answers.dependents - 1) })}
              aria-label="Fewer kids"
            >
              −
            </button>
            <span className="min-w-8 text-center tabular" aria-live="polite">
              {Math.max(1, answers.dependents)}
            </span>
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-md border border-border bg-surface"
              onClick={() => onChange({ dependents: Math.max(1, answers.dependents) + 1 })}
              aria-label="More kids"
            >
              +
            </button>
          </div>
        ) : null}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Right now I am</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["student", "A student"],
              ["working", "Working"],
              ["retired", "Retired"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={choiceClass(answers.work === id)} onClick={() => onChange({ work: id })}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Housing</legend>
        <div className="grid gap-2">
          {(
            [
              ["rent", "I rent"],
              ["own", "I own and pay a mortgage"],
              ["family", "Someone else covers it"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={choiceClass(answers.housing === id)} onClick={() => onChange({ housing: id as Housing })}>
              {label}
            </button>
          ))}
        </div>
        {answers.housing !== "family" ? (
          <Field label="About how much each month?">
            <Input
              inputMode="decimal"
              placeholder="Optional"
              value={answers.housingAmount == null ? "" : String(answers.housingAmount)}
              onChange={(event) => {
                const raw = event.target.value.trim();
                onChange({ housingAmount: raw === "" ? null : Math.max(0, Number(raw) || 0) });
              }}
            />
          </Field>
        ) : null}
      </fieldset>
      <Field label="How old are you?">
        <Input
          inputMode="numeric"
          placeholder="Optional"
          aria-label="How old are you?"
          value={answers.age == null ? "" : String(answers.age)}
          onChange={(event) => {
            const raw = event.target.value.trim();
            onChange({ age: raw === "" ? null : Math.max(0, Math.round(Number(raw) || 0)) });
          }}
        />
        <button type="button" className="mt-2 min-h-11 text-sm font-medium text-primary" onClick={() => onChange({ age: null })}>
          Skip
        </button>
      </Field>
    </div>
  );
}

function PayForStep({
  answers,
  slugs,
  customName,
  onCustomName,
  onToggle,
  onChip,
  onAddCustom,
}: {
  answers: SetupAnswers;
  slugs: string[];
  customName: string;
  onCustomName: (value: string) => void;
  onToggle: (slug: string) => void;
  onChip: (patch: Partial<SetupAnswers>) => void;
  onAddCustom: () => void;
}) {
  const chips = [
    ["hasVehicle", "I have a car", answers.hasVehicle],
    ["usesTransit", "I use public transit", answers.usesTransit],
    ["hasPets", "I have a pet", answers.hasPets],
    ["payingDebt", "I'm paying off debt", answers.payingDebt],
    ["savingUp", "I'm saving up for something", answers.savingUp],
  ] as const;
  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap gap-2">
        {chips.map(([key, label, on]) => (
          <button key={key} type="button" className={`min-h-11 rounded-full border px-3 text-sm ${on ? "border-primary bg-chip" : "border-border bg-surface"}`} onClick={() => onChip({ [key]: !on })}>
            {label}
          </button>
        ))}
      </div>
      <p className="text-sm" aria-live="polite">
        {slugs.length} selected
      </p>
      {CATEGORY_GROUPS.map((group) => (
        <fieldset key={group.title} className="space-y-2">
          <legend className="text-sm font-medium">{group.title}</legend>
          {group.slugs.map((slug) => {
            const on = slugs.includes(slug);
            return (
              <button key={slug} type="button" className={`${choiceClass(on)} min-h-12 w-full`} onClick={() => onToggle(slug)} aria-pressed={on}>
                <div className="font-medium">{categoryLabel(slug, answers.housing, slugs.includes("dining"))}</div>
                <div className="text-xs text-muted">{categoryHint(slug)}</div>
              </button>
            );
          })}
        </fieldset>
      ))}
      {answers.customCategories.map((custom) => (
        <button key={custom.slug} type="button" className={`${choiceClass(slugs.includes(custom.slug))} w-full`} onClick={() => onToggle(custom.slug)} aria-pressed={slugs.includes(custom.slug)}>
          {custom.name}
        </button>
      ))}
      <div className="flex gap-2">
        <Input aria-label="Add your own" placeholder="Add your own" value={customName} onChange={(event) => onCustomName(event.target.value)} />
        <Button type="button" variant="outline" disabled={!customName.trim()} onClick={onAddCustom}>
          Add
        </Button>
      </div>
    </div>
  );
}

function IncomeStep({ answers, total, onChange }: { answers: SetupAnswers; total: number; onChange: (patch: Partial<SetupAnswers>) => void }) {
  function edit(index: number, patch: Partial<SetupIncome>) {
    const income = answers.income.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ income, incomeUnknown: false });
  }
  return (
    <div className="mt-6 space-y-4">
      {answers.incomeUnknown ? (
        <p className="text-sm">No income yet. You can add it later, inside the app.</p>
      ) : (
        answers.income.map((row, index) => (
        <div key={row.id} className="space-y-2 rounded-lg border border-border bg-surface p-3">
          <Field label="Name">
            <Input value={row.name} onChange={(event) => edit(index, { name: event.target.value })} />
          </Field>
          <Field label="Amount of one payment">
            <Input
              inputMode="decimal"
              value={row.amount ? String(row.amount) : ""}
              placeholder="0"
              onChange={(event) => edit(index, { amount: Math.max(0, Number(event.target.value) || 0) })}
            />
          </Field>
          <Field label="How often">
            <Select value={row.cadence} onChange={(event) => edit(index, { cadence: event.target.value as IncomeCadence })}>
              {CADENCE.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Words on the deposit">
            <Input value={row.depositWords} onChange={(event) => edit(index, { depositWords: event.target.value })} />
          </Field>
          <p className="text-xs text-muted">The name your bank shows, like your employer. It helps us recognize this income later.</p>
          {answers.income.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange({ income: answers.income.filter((_, i) => i !== index), incomeUnknown: false })}
            >
              Remove this source
            </Button>
          ) : null}
        </div>
      ))
      )}
      {answers.incomeUnknown ? (
        <Button type="button" variant="outline" onClick={() => onChange({ incomeUnknown: false })}>
          Add a source
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              incomeUnknown: false,
              income: [
                ...answers.income,
                { id: newId("income"), name: "", amount: 0, cadence: "monthly", depositWords: "" },
              ],
            })
          }
        >
          Add another source
        </Button>
      )}
      <p className="text-sm" aria-live="polite">
        {answers.incomeUnknown ? "About $0 a month in total" : `About ${formatMoney(total)} a month in total`}
      </p>
    </div>
  );
}

function StyleStep({
  answers,
  lively,
  onPick,
}: {
  answers: SetupAnswers;
  lively: boolean;
  onPick: (style: BudgetStyle) => void;
}) {
  return (
    <div className="mt-6 space-y-3">
      <div className="grid gap-3">
        <button type="button" className={`${choiceClass(answers.budgetStyle === "monthly")} p-4`} onClick={() => onPick("monthly")} aria-pressed={answers.budgetStyle === "monthly"}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-medium">{TERMS.monthlyReset}</div>
              <p className="mt-1 text-sm text-muted">Each spending category, like rent or groceries, starts over. Income is compared with what usually comes in. It is not carried over.</p>
            </div>
            <Jar mode="refill" lively={lively} />
          </div>
          <p className="sr-only">A jar empties, then fills again on the first of the month.</p>
        </button>
        <button type="button" className={`${choiceClass(answers.budgetStyle === "buckets")} p-4`} onClick={() => onPick("buckets")} aria-pressed={answers.budgetStyle === "buckets"}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-medium">{TERMS.carryOver}</div>
              <p className="mt-1 text-sm text-muted">Leftover in a category stays for next month.</p>
              <details className="mt-1 text-sm text-muted">
                <summary className="cursor-pointer">How leftovers start</summary>
                <p className="mt-1">Going over means next month has less. Income is not carried, because pay changes.</p>
                <p className="mt-1">Leftovers start at the first month of your file. You can start from this month instead.</p>
                <p className="mt-1">Past months show what you would have carried. Changing it does not delete anything.</p>
              </details>
            </div>
            <Jar mode="carry" lively={lively} />
          </div>
          <p className="sr-only">The level left in the jar stays there for the next month.</p>
        </button>
      </div>
      <p className="text-sm text-muted">Not sure? Either can be changed any time in Account. One category can do the other later, and that does not delete anything.</p>
    </div>
  );
}

function Jar({ mode, lively }: { mode: "refill" | "carry"; lively: boolean }) {
  if (mode === "refill") {
    return (
      <div className="jar shrink-0" aria-hidden>
        <div className={lively ? "jar-fill jar-refill" : "jar-fill"} style={lively ? undefined : { height: "88%" }} />
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-end gap-1" aria-hidden>
      <div className="jar">
        <div className="jar-fill" style={{ height: "70%" }} />
      </div>
      <div className="jar">
        <div className={lively ? "jar-fill jar-carry-in" : "jar-fill"} style={lively ? undefined : { height: "70%" }} />
      </div>
    </div>
  );
}

function AmountsStep({
  answers,
  slugs,
  splitDining,
  amounts,
  income,
  planned,
  line,
  onAmount,
  onFit,
}: {
  answers: SetupAnswers;
  slugs: string[];
  splitDining: boolean;
  amounts: Record<string, number>;
  income: number;
  planned: number;
  line: string;
  onAmount: (slug: string, value: number) => void;
  onFit: () => void;
}) {
  const names = new Map(answers.customCategories.map((item) => [item.slug, item.name]));
  const maxShare = Math.max(income, planned, 1);
  return (
    <div className="mt-6 space-y-4">
      {income > 0 ? (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-chip" aria-hidden>
            {slugs.map((slug, index) => (
              <div
                key={slug}
                style={{
                  width: `${((amounts[slug] ?? 0) / maxShare) * 100}%`,
                  background: BAR_COLORS[index % BAR_COLORS.length],
                }}
              />
            ))}
          </div>
          <p className="text-sm" aria-live="polite">
            {line}
          </p>
          {planned > income ? (
            <Button type="button" variant="outline" onClick={onFit}>
              Fit this to my income
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted">No income yet, so these start from a typical floor. You can change them.</p>
      )}
      <ul className="space-y-3">
        {slugs.map((slug) => {
          const amount = amounts[slug] ?? 0;
          const name = names.get(slug) ?? categoryLabel(slug, answers.housing, splitDining);
          const max = Math.max(100, Math.ceil(Math.max(amount, income || amount || 100) / 50) * 50);
          const width = income > 0 ? Math.min(100, (amount / income) * 100) : Math.min(100, (amount / Math.max(amount, 1)) * 100);
          return (
            <li key={slug} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{name}</span>
                <Input
                  className="max-w-32"
                  inputMode="decimal"
                  aria-label={`Monthly amount for ${name}`}
                  value={amount ? String(amount) : ""}
                  onChange={(event) => onAmount(slug, Number(event.target.value) || 0)}
                />
              </div>
              <input
                className="mt-3 min-h-11 w-full"
                type="range"
                min={0}
                max={max}
                step={5}
                value={Math.min(amount, max)}
                aria-label={`Slider for ${name}`}
                onChange={(event) => onAmount(slug, Number(event.target.value) || 0)}
              />
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip" aria-hidden>
                <div className="h-full bg-primary" style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AccountsStep({
  answers,
  month,
  showAccounts,
  showSavings,
  pickingKind,
  onShowAccounts,
  onShowSavings,
  onPickKind,
  onPicking,
  onChange,
}: {
  answers: SetupAnswers;
  month: string;
  showAccounts: boolean;
  showSavings: boolean;
  pickingKind: boolean;
  onShowAccounts: () => void;
  onShowSavings: () => void;
  onPickKind: (kind: AccountKind) => void;
  onPicking: (on: boolean) => void;
  onChange: (patch: Partial<SetupAnswers>) => void;
}) {
  const yearNow = Number(month.slice(0, 4));
  const years = Array.from({ length: 16 }, (_, index) => String(yearNow + index));
  const plan = answers.savings;
  const [byMonth, setByMonth] = useState(plan?.by?.slice(5, 7) ?? "");
  const [byYear, setByYear] = useState(plan?.by?.slice(0, 4) ?? "");
  const pace = plan ? savingsPlanMonthly(plan.target, plan.by, month) : null;
  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-lg border border-border bg-surface p-3">
        <h2 className="text-base font-medium">{TERMS.account}s</h2>
        <p className="mt-1 text-sm text-muted">Optional. Add the ones you use, and today's balance if you know it.</p>
        {!showAccounts ? (
          <Button type="button" className="mt-3" variant="outline" onClick={onShowAccounts}>
            Add an account
          </Button>
        ) : (
          <div className="mt-3 space-y-3">
            {answers.accounts.map((account, index) => (
              <div key={account.id} className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium">{KINDS.find((item) => item.id === account.kind)?.label}</p>
                <Field label="Name">
                  <Input
                    value={account.name}
                    onChange={(event) => {
                      const accounts = answers.accounts.map((row, i) => (i === index ? { ...row, name: event.target.value } : row));
                      onChange({ accounts });
                    }}
                  />
                </Field>
                <Field label="Bank name">
                  <Input
                    placeholder="Optional"
                    value={account.institution}
                    onChange={(event) => {
                      const accounts = answers.accounts.map((row, i) => (i === index ? { ...row, institution: event.target.value } : row));
                      onChange({ accounts });
                    }}
                  />
                </Field>
                <Field label={account.kind === "credit" ? "Amount you owe" : "Today's balance"}>
                  <Input
                    inputMode="decimal"
                    placeholder="Optional"
                    value={account.balance == null ? "" : String(account.balance)}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      const balance = raw === "" ? null : Math.max(0, Number(raw) || 0);
                      const accounts = answers.accounts.map((row, i) => (i === index ? { ...row, balance } : row));
                      onChange({ accounts });
                    }}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onChange({ accounts: answers.accounts.filter((_, i) => i !== index) })}
                >
                  Remove
                </Button>
              </div>
            ))}
            {pickingKind ? (
              <div className="grid gap-2">
                {KINDS.map((kind) => (
                  <button key={kind.id} type="button" className={choiceClass(false)} onClick={() => onPickKind(kind.id)}>
                    {kind.label}
                  </button>
                ))}
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => onPicking(true)}>
                Add another
              </Button>
            )}
          </div>
        )}
      </section>
      <section className="rounded-lg border border-border bg-surface p-3">
        <h2 className="text-base font-medium">{TERMS.savingsPlan}</h2>
        <p className="mt-1 text-sm text-muted">Optional. One thing you are saving for.</p>
        {!showSavings ? (
          <Button type="button" className="mt-3" variant="outline" onClick={onShowSavings}>
            Add a {TERMS.savingsPlan.toLowerCase()}
          </Button>
        ) : (
          <div className="mt-3 space-y-2">
            <Field label="What for">
              <Input
                value={plan?.name ?? ""}
                onChange={(event) => onChange({ savings: { id: plan?.id || newId("plan"), name: event.target.value, target: plan?.target ?? 0, by: plan?.by ?? null } })}
              />
            </Field>
            <Field label="Goal amount">
              <Input
                inputMode="decimal"
                value={plan?.target ? String(plan.target) : ""}
                onChange={(event) =>
                  onChange({
                    savings: {
                      id: plan?.id || newId("plan"),
                      name: plan?.name ?? "",
                      target: Math.max(0, Number(event.target.value) || 0),
                      by: plan?.by ?? null,
                    },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="By month">
                <Select
                  value={byMonth}
                  onChange={(event) => {
                    const nextMonth = event.target.value;
                    setByMonth(nextMonth);
                    const by = nextMonth && byYear ? `${byYear}-${nextMonth}` : null;
                    onChange({ savings: { id: plan?.id || newId("plan"), name: plan?.name ?? "", target: plan?.target ?? 0, by } });
                  }}
                >
                  <option value="">No month</option>
                  {MONTHS.map((label, index) => (
                    <option key={label} value={String(index + 1).padStart(2, "0")}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="By year">
                <Select
                  value={byYear}
                  onChange={(event) => {
                    const nextYear = event.target.value;
                    setByYear(nextYear);
                    const by = byMonth && nextYear ? `${nextYear}-${byMonth}` : null;
                    onChange({ savings: { id: plan?.id || newId("plan"), name: plan?.name ?? "", target: plan?.target ?? 0, by } });
                  }}
                >
                  <option value="">No year</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="text-sm" aria-live="polite">
              {pace != null ? `That's about ${formatMoney(pace)} a month` : "Pick a month and year to see a monthly amount."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryStep({
  answers,
  slugs,
  amounts,
  line,
  income,
  onChange,
}: {
  answers: SetupAnswers;
  slugs: string[];
  amounts: Record<string, number>;
  line: string;
  income: number;
  onChange: (step: number) => void;
}) {
  const planned = roundMoney(slugs.reduce((sum, slug) => sum + (amounts[slug] ?? 0), 0));
  const maxShare = Math.max(income, planned, 1);
  const balanceRows = answers.accounts.filter((account) => account.name.trim());
  const points = balanceRows
    .filter((account) => account.balance != null)
    .map((account) => ({
      id: account.balanceId,
      accountId: account.id,
      date: todayStamp(),
      amount: account.kind === "credit" ? -Math.abs(account.balance ?? 0) : (account.balance ?? 0),
      source: "entered" as const,
    }));
  const accounts = balanceRows.map((account) => ({
    id: account.id,
    name: account.name.trim(),
    kind: account.kind,
    createdAt: "",
  }));
  const style = answers.budgetStyle === "buckets" ? TERMS.carryOver : answers.budgetStyle === "monthly" ? TERMS.monthlyReset : "Not chosen";
  return (
    <div className="mt-6 space-y-3">
      <SummaryBlock title="About you" onChange={() => onChange(0)}>
        <p className="text-sm">{householdSentence(answers)}</p>
        <p className="text-sm">{answers.age == null ? "Age skipped." : `${answers.age} years old.`}</p>
      </SummaryBlock>
      <SummaryBlock title="Money coming in" onChange={() => onChange(2)}>
        <p className="text-sm">{answers.incomeUnknown || income <= 0 ? "No income yet." : `About ${formatMoney(income)} a month.`}</p>
      </SummaryBlock>
      <SummaryBlock title="How leftover money works" onChange={() => onChange(3)}>
        <p className="text-sm">{style}</p>
      </SummaryBlock>
      <SummaryBlock title="What you pay for" onChange={() => onChange(1)}>
        <p className="text-sm">{slugs.length} categories</p>
      </SummaryBlock>
      <SummaryBlock title="Your amounts" onChange={() => onChange(4)}>
        <div className="flex h-3 overflow-hidden rounded-full bg-chip" aria-hidden>
          {slugs.map((slug, index) => (
            <div key={slug} style={{ width: `${((amounts[slug] ?? 0) / maxShare) * 100}%`, background: BAR_COLORS[index % BAR_COLORS.length] }} />
          ))}
        </div>
        <p className="mt-2 text-sm" aria-live="polite">
          {income > 0 ? line : `Planned ${formatMoney(planned)} a month.`}
        </p>
      </SummaryBlock>
      <SummaryBlock title="Accounts" onChange={() => onChange(5)}>
        {balanceRows.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {balanceRows.map((account) => (
              <li key={account.id}>
                {account.name}
                {account.balance == null
                  ? ""
                  : account.kind === "credit"
                    ? `, you owe ${formatMoney(account.balance)}`
                    : `, ${formatMoney(account.balance)}`}
              </li>
            ))}
          </ul>
        )}
        {points.length ? <p className="mt-1 text-sm">Total {formatMoney(totalBalance(accounts, points))}</p> : null}
      </SummaryBlock>
      <SummaryBlock title={TERMS.savingsPlan} onChange={() => onChange(5)}>
        {answers.savings?.name && answers.savings.target > 0 ? (
          <p className="text-sm">
            {answers.savings.name}, {formatMoney(answers.savings.target)}
            {answers.savings.by ? ` by ${answers.savings.by}` : ""}
          </p>
        ) : (
          <p className="text-sm text-muted">None yet.</p>
        )}
      </SummaryBlock>
    </div>
  );
}

function SummaryBlock({ title, children, onChange }: { title: string; children: ReactNode; onChange: () => void }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <button type="button" className="min-h-11 text-sm font-medium text-primary" onClick={onChange}>
          Change
        </button>
      </div>
      {children}
    </section>
  );
}
