import { useState } from "react";
import { formatMoney } from "@/lib/budget/money";
import { FillJar } from "../money-visual";
import { ProgressRing } from "../visuals/progress-ring";
import { CalcFrame, Sensitivity, YearTable } from "./frame";
import { useGrow } from "./session";

export function CushionPage() {
  const g = useGrow();
  const [months, setMonths] = useState(3);
  const monthly = g.picture.bills ?? 0;
  const saved = g.picture.cushionCash;
  const target = monthly * months;
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const covered = monthly > 0 ? saved / monthly : 0;
  const result = monthly > 0
    ? `${formatMoney(saved)} covers about ${covered.toFixed(1)} months. ${months} months is ${formatMoney(target)}.`
    : "Import a few months of spending. This uses that average.";
  return (
    <CalcFrame
      question="How big should the cushion be?"
      result={result}
      topic="cushion"
      facts={g.tipFacts}
      assumptionIds={[]}
      extraAssumptions={[g.facts.cashSavings.note, g.facts.typicalSpendMonthly.note, g.facts.typicalFixed.note]}
      numbers={
        <div className="flex flex-wrap gap-2">
          {[1, 3, 6].map((count) => (
            <button
              key={count}
              type="button"
              className={`min-h-11 rounded-md px-3 text-sm ${months === count ? "bg-primary text-primary-fg" : "border border-border"}`}
              aria-pressed={months === count}
              onClick={() => setMonths(count)}
            >
              {count} month{count === 1 ? "" : "s"}
            </button>
          ))}
        </div>
      }
      picture={
        <div className="grid grid-cols-3 gap-3">
          {[1, 3, 6].map((count) => (
            <div key={count} className="text-center">
              <div className="flex justify-center">
                <FillJar pct={(count / 6) * 100} celebrate={count === months && pct >= 100} />
              </div>
              <div className="mt-2 text-sm">{count} month{count === 1 ? "" : "s"}</div>
              <div className="font-display text-lg tabular">{formatMoney(monthly * count)}</div>
            </div>
          ))}
          <ProgressRing pct={pct} tone={pct >= 100 ? "good" : "primary"} label={target > 0 ? `${Math.round(pct)} percent` : "No average yet"} />
        </div>
      }
      keyNumbers={[
        { label: "Saved", value: formatMoney(saved) },
        { label: "Typical month", value: formatMoney(monthly) },
        { label: "Months covered", value: monthly > 0 ? covered.toFixed(1) : "—" },
        { label: "Target", value: formatMoney(target) },
        { label: "Still to save", value: formatMoney(Math.max(0, target - saved)) },
        { label: "Steady bills", value: formatMoney(g.facts.typicalFixed.value ?? 0) },
      ]}
      years={
        <YearTable
          columns={["Months", "Target", "Gap"]}
          rows={[1, 3, 6].map((count) => [String(count), formatMoney(monthly * count), formatMoney(Math.max(0, monthly * count - saved))])}
        />
      }
      advanced={
        g.nerd ? (
          <Sensitivity
            rows={[
              { label: "Spending $100 less", value: monthly > 100 ? `${(saved / (monthly - 100)).toFixed(1)} months` : "—" },
              { label: "Spending as entered", value: monthly > 0 ? `${covered.toFixed(1)} months` : "—" },
              { label: "Spending $100 more", value: monthly > 0 ? `${(saved / (monthly + 100)).toFixed(1)} months` : "—" },
            ]}
          />
        ) : null
      }
    />
  );
}
