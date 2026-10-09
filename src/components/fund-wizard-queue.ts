export const FUND_LINK_KEY = "harbor-fund-link";
export const FUND_PREFILL_KEY = "harbor-fund-prefill";

export const queueFundWizard = (categoryId?: string) => {
  sessionStorage.setItem(FUND_LINK_KEY, categoryId ?? "");
};

export function queueFundFromGoal(prefill: { name: string; target: number; by: string | null; monthly: number }) {
  sessionStorage.setItem(FUND_PREFILL_KEY, JSON.stringify(prefill));
  sessionStorage.setItem(FUND_LINK_KEY, "");
}
