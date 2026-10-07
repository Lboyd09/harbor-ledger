import { SectionTabs } from "../page-menu";
import { CushionPage } from "./cushion";
import { DebtPage } from "./debt";
import { DoublePage } from "./double";
import { GoalPage } from "./goal";
import { InflationPage } from "./inflation";
import { LoanPage } from "./loan";
import { MonthlyPage } from "./monthly";
import { PutToWork } from "./put-to-work";
import { RetirementPage } from "./retirement";
import { RothPage } from "./roth";
import { GrowProvider, useGrow, type GrowPage } from "./session";
import { WorkOptionalPage } from "./work-optional";
import { WorthPage } from "./worth";

const QUESTIONS: { id: GrowPage; label: string }[] = [
  { id: "retire", label: "Can I retire?" },
  { id: "debt", label: "Pay off debt" },
  { id: "goal", label: "Save for something" },
  { id: "work", label: "Grow my money" },
  { id: "roth", label: "Roth or traditional?" },
];

function family(page: GrowPage): GrowPage {
  if (page === "free") return "retire";
  if (page === "loan") return "debt";
  if (page === "cushion") return "goal";
  if (page === "monthly" || page === "double") return "work";
  return page;
}

export function GrowView() {
  return (
    <GrowProvider>
      <GrowShell />
    </GrowProvider>
  );
}

function GrowShell() {
  const { page, setPage } = useGrow();
  const group = family(page);
  const more: { id: GrowPage; label: string }[] =
    group === "retire"
      ? [
          { id: "retire", label: "Retirement" },
          { id: "free", label: "When work is optional" },
        ]
      : group === "debt"
        ? [
            { id: "debt", label: "Debts" },
            { id: "loan", label: "Loan or mortgage" },
          ]
        : group === "goal"
          ? [
              { id: "goal", label: "A goal" },
              { id: "cushion", label: "Cushion" },
            ]
          : group === "work"
            ? [
                { id: "work", label: "A lump sum" },
                { id: "monthly", label: "Every month" },
                { id: "double", label: "How long" },
                { id: "inflation", label: "Inflation" },
              ]
            : [];
  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold md:text-3xl">Plan</h1>
        <SectionTabs
          label="Plan"
          items={QUESTIONS.map((item) => ({
            label: item.label,
            current: group === item.id,
            onSelect: () => setPage(item.id),
          }))}
        />
        {more.length ? (
          <SectionTabs
            label="This question"
            items={more.map((item) => ({
              label: item.label,
              current: page === item.id,
              onSelect: () => setPage(item.id),
            }))}
          />
        ) : null}
      </div>
      <GrowPageBody page={page === "overview" ? "retire" : page} />
    </div>
  );
}

function GrowPageBody({ page }: { page: GrowPage }) {
  if (page === "retire" || page === "overview") return <RetirementPage />;
  if (page === "free") return <WorkOptionalPage />;
  if (page === "work") return <PutToWork />;
  if (page === "monthly") return <MonthlyPage />;
  if (page === "roth") return <RothPage />;
  if (page === "goal") return <GoalPage />;
  if (page === "cushion") return <CushionPage />;
  if (page === "debt") return <DebtPage />;
  if (page === "loan") return <LoanPage />;
  if (page === "worth") return <WorthPage />;
  if (page === "inflation") return <InflationPage />;
  return <DoublePage />;
}