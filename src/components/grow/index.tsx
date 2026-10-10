import { useEffect } from "react";
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
import { GrowProvider } from "./session";
import { useGrow } from "./grow-context";
import type { GrowPage } from "./session-state";
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

const PAGE_IDS = new Set<GrowPage>([
  "retire",
  "free",
  "debt",
  "loan",
  "goal",
  "cushion",
  "work",
  "monthly",
  "double",
  "inflation",
  "roth",
]);

const PATH_TO_PAGE: Record<string, GrowPage> = {
  retire: "retire",
  debt: "debt",
  goal: "goal",
  cushion: "cushion",
  "put-to-work": "work",
  roth: "roth",
  loan: "loan",
  "work-optional": "free",
  worth: "worth",
  monthly: "monthly",
  double: "double",
  inflation: "inflation",
};

const PAGE_TO_PATH: Partial<Record<GrowPage, string>> = {
  retire: "retire",
  debt: "debt",
  goal: "goal",
  cushion: "cushion",
  work: "put-to-work",
  roth: "roth",
  loan: "loan",
  free: "work-optional",
  worth: "worth",
  monthly: "monthly",
  double: "double",
  inflation: "inflation",
};

function pageFromUrl(): GrowPage | null {
  if (typeof window === "undefined") return null;
  const part = window.location.pathname.split("/")[2];
  if (part && PATH_TO_PAGE[part]) return PATH_TO_PAGE[part];
  const q = new URLSearchParams(window.location.search).get("q");
  if (q && PATH_TO_PAGE[q]) return PATH_TO_PAGE[q];
  return q && PAGE_IDS.has(q as GrowPage) ? (q as GrowPage) : null;
}

function rememberPage(next: GrowPage) {
  if (typeof window === "undefined") return;
  const slug = PAGE_TO_PATH[next] ?? next;
  window.history.pushState(null, "", `/grow/${slug}`);
}

function GrowShell() {
  const { page, setPage } = useGrow();
  useEffect(() => {
    const initial = pageFromUrl();
    if (initial && initial !== page) setPage(initial);
    function onPop() {
      const next = pageFromUrl();
      if (next) setPage(next);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // Read the URL once on open. Later changes go through open().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPage]);
  function open(next: GrowPage) {
    setPage(next);
    rememberPage(next);
  }
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
            onSelect: () => open(item.id),
          }))}
        />
        {more.length > 1 ? (
          <details>
            <summary className="min-h-11 cursor-pointer text-sm text-muted">Fine-tune this question</summary>
            <SectionTabs
              label="This question"
              items={more.map((item) => ({
                label: item.label,
                current: page === item.id,
                onSelect: () => open(item.id),
              }))}
            />
          </details>
        ) : (
          <button type="button" disabled className="inline-flex min-h-11 items-center text-left text-sm text-muted">
            Nothing to fine-tune
          </button>
        )}
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