import { createFileRoute } from "@tanstack/react-router";
import { BudgetView } from "@/components/budget-view";

type BudgetSearch = { page?: "amounts" | "transactions" };

export const Route = createFileRoute("/budget")({
  validateSearch: (search: Record<string, unknown>): BudgetSearch => {
    if (search.page === "amounts" || search.page === "transactions") return { page: search.page };
    return {};
  },
  component: function BudgetRoute() {
    const { page } = Route.useSearch();
    return <BudgetView page={page ?? "month"} />;
  },
});
