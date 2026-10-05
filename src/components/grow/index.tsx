import { PageMenu } from "../page-menu";
import { CushionPage } from "./cushion";
import { DebtPage } from "./debt";
import { DoublePage } from "./double";
import { GoalPage } from "./goal";
import { InflationPage } from "./inflation";
import { LoanPage } from "./loan";
import { MonthlyPage } from "./monthly";
import { Overview } from "./overview";
import { PutToWork } from "./put-to-work";
import { RetirementPage } from "./retirement";
import { RothPage } from "./roth";
import { GROW_PAGES, GrowProvider, useGrow, type GrowPage } from "./session";
import { WorkOptionalPage } from "./work-optional";
import { WorthPage } from "./worth";

export function GrowView() {
  return (
    <GrowProvider>
      <GrowShell />
    </GrowProvider>
  );
}

function GrowShell() {
  const { page, setPage } = useGrow();
  return (
    <div className="min-w-0 space-y-4">
      <PageMenu
        title="Grow"
        items={GROW_PAGES.map((item) => ({
          label: item.label,
          current: item.id === page,
          onSelect: () => setPage(item.id),
        }))}
      />
      <GrowPageBody page={page} />
    </div>
  );
}

function GrowPageBody({ page }: { page: GrowPage }) {
  if (page === "overview") return <Overview />;
  if (page === "retire") return <RetirementPage />;
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
