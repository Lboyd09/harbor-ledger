import { Link } from "@tanstack/react-router";
import { HOUSEHOLD_LABELS, HOUSING_LABELS, STAGE_LABELS } from "@/lib/budget/presets";
import { formatMoney } from "@/lib/budget/money";
import { useBudgetStore } from "@/store/budget-store";
import { ExportBar } from "./export-bar";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";

export function SettingsView() {
  const profile = useBudgetStore((s) => s.profile);
  const setBudgetPeriod = useBudgetStore((s) => s.setBudgetPeriod);
  const reopenSetup = useBudgetStore((s) => s.reopenSetup);
  const patchProfile = useBudgetStore((s) => s.patchProfile);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted">Name the ledger, edit household answers, and download a file Excel or Google Sheets can open.</p>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Ledger</h2>
        <Field label="Name">
          <Input
            value={profile.ledgerName}
            onChange={(e) => patchProfile({ ledgerName: e.target.value })}
          />
        </Field>
        <p className="text-xs text-muted">The name saves as you type.</p>
        <Field label="Review period">
          <Select value={profile.budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value as "month" | "week")}>
            <option value="month">Month to month</option>
            <option value="week">Week to week</option>
          </Select>
        </Field>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Household</h2>
        <p className="text-sm">
          {HOUSEHOLD_LABELS[profile.household]} · {STAGE_LABELS[profile.lifeStage]} · {HOUSING_LABELS[profile.housing]}
          {profile.dependents ? ` · ${profile.dependents} dependent${profile.dependents === 1 ? "" : "s"}` : ""}
        </p>
        <p className="text-sm text-muted">Typical take-home {formatMoney(profile.monthlyIncome)} / month</p>
        <Button
          variant="outline"
          onClick={() => reopenSetup()}
        >
          Edit household answers
        </Button>
        <p className="text-xs text-muted">Opens the setup questions. Your transactions stay. Back to ledger leaves them unchanged.</p>
        <Link to="/plan" className="inline-flex text-sm font-medium text-primary">
          Edit monthly budgets
        </Link>
      </section>

      <ExportBar />

      <p className="text-sm text-muted">
        Account, password, and sign-out are on <Link to="/account" className="text-primary">Account</Link>.
      </p>
    </div>
  );
}
