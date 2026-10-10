import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { needsPrompt, optionalAmount, readNumber } from "@/lib/budget/calc-input";
import { monthlyForGoal } from "@/lib/budget/grow-math";
import { formatMoney } from "@/lib/budget/money";
import { shiftMonth } from "@/lib/budget/parse-date";
import { FillJar } from "../money-visual";
import { Button } from "../ui/button";
import { Input } from "../ui/field";
import { queueFundFromGoal } from "../fund-wizard-queue";
import { CalcFrame, Field, Sensitivity, YearTable } from "./frame";
import { tagOf } from "./source-tag";
import { useGrow } from "./grow-context";

export function GoalPage() {
  const g = useGrow();
  const started = useRef(false);
  const [target, setTarget] = useState("");
  const [have, setHave] = useState("");
  const [months, setMonths] = useState("12");
  useEffect(() => {
    if (started.current) return;
    if (g.facts.cashSavings.value == null && g.facts.typicalSpendMonthly.value == null) return;
    started.current = true;
    if (g.facts.cashSavings.value != null) setHave(String(Math.round(g.facts.cashSavings.value)));
    if (g.facts.typicalSpendMonthly.value != null) setTarget(String(Math.round(g.facts.typicalSpendMonthly.value * 3)));
  }, [g.facts]);
  const missing = needsPrompt(
    [
      { label: "the goal amount", value: readNumber(target), above: 0 },
      { label: "how many months", value: readNumber(months), above: 0 },
    ],
    "the monthly amount",
  );
  const goal = readNumber(target) ?? 0;
  const saved = optionalAmount(have).amount;
  const monthCount = Math.max(0, readNumber(months) ?? 0);
  const need = monthlyForGoal(goal, saved, monthCount);
  const pct = goal > 0 ? Math.min(100, (saved / goal) * 100) : 0;
  const steps = Math.min(Math.max(0, Math.round(monthCount)), 36);
  const by = monthCount > 0 ? shiftMonth(g.ym, monthCount) : null;
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <CalcFrame
        question="What should you set aside each month?"
        result={goal > 0 ? `Set aside ${formatMoney(need)} each month for ${monthCount} months.` : "Type the price. Already saved starts from a savings account when one exists."}
        missing={missing}
        topic="goal"
        facts={g.tipFacts}
        assumptionIds={[]}
        extraAssumptions={[g.facts.cashSavings.note, g.facts.typicalSpendMonthly.note, "A goal is extra savings. It is not a budget category."]}
        numbers={
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Goal" tag={g.facts.typicalSpendMonthly.value != null ? "from your spending" : "typed"}>
              <Input className="mt-1" inputMode="decimal" aria-label="Goal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Field label="Already saved" tag={tagOf(g.facts.cashSavings.source)}>
              <Input className="mt-1" inputMode="decimal" aria-label="Already saved" value={have} onChange={(e) => setHave(e.target.value)} />
            </Field>
            <Field label="Months" tag="typed">
              <Input className="mt-1" inputMode="decimal" aria-label="Goal months" value={months} onChange={(e) => setMonths(e.target.value)} />
            </Field>
          </div>
        }
        picture={
          <div className="flex items-center gap-3">
            <FillJar pct={pct} />
            <div>
              <div className="text-xs text-muted">Each month</div>
              <div className="font-display text-3xl tabular">{formatMoney(need)}</div>
            </div>
          </div>
        }
        keyNumbers={[
          { label: "Each month", value: formatMoney(need) },
          { label: "Goal", value: formatMoney(goal) },
          { label: "Already saved", value: formatMoney(saved) },
          { label: "Still to save", value: formatMoney(Math.max(0, goal - saved)) },
          { label: "Months", value: String(monthCount) },
          { label: "Percent saved", value: `${Math.round(pct)}%` },
        ]}
        years={<YearTable columns={["Month", "Saved"]} rows={Array.from({ length: steps }, (_, index) => [String(index + 1), formatMoney(Math.min(goal, saved + need * (index + 1)))])} />}
        advanced={
          g.nerd ? (
            <Sensitivity
              rows={[
                { label: "Already saved $100 less", value: formatMoney(monthlyForGoal(goal, Math.max(0, saved - 100), monthCount)) },
                { label: "Already saved as entered", value: formatMoney(need) },
                { label: "Already saved $100 more", value: formatMoney(monthlyForGoal(goal, saved + 100, monthCount)) },
              ]}
            />
          ) : null
        }
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={missing != null}
        onClick={() => {
          queueFundFromGoal({ name: "Goal", target: goal, by, monthly: Math.max(0, need) });
          void navigate({ to: "/funds" });
        }}
      >
        Make this a fund
      </Button>
    </div>
  );
}
