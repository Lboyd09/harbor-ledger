export type Household = "single" | "partnered" | "married";
export type LifeStage = "student" | "early-career" | "established" | "parent" | "retired";
export type Housing = "family" | "rent" | "own";
export type BudgetGoal = "track" | "save" | "debt" | "purchase" | "live-within";
export type CategoryKind = "income" | "expense";
export type RecurringInterval = "weekly" | "biweekly" | "monthly" | "irregular";
export type BudgetPeriod = "week" | "month";
export type TxStatus = "posted" | "refund" | "transfer" | "reimbursement";
export type HarborLook = "harbor" | "dusk" | "tide" | "brass";
export type HarborMotion = "calm" | "lively";

export type IncomeStream = {
  name: string;
  monthly: number;
};

export type Profile = {
  ledgerName: string;
  household: Household;
  dependents: number;
  lifeStage: LifeStage;
  housing: Housing;
  hasVehicle: boolean;
  usesTransit: boolean;
  hasPets: boolean;
  monthlyIncome: number;
  incomeStreams: IncomeStream[];
  buckets: string[];
  goals: BudgetGoal[];
  completedOnboarding: boolean;
  budgetPeriod: BudgetPeriod;
  /** Paper color. Missing on older ledgers — treat as harbor. */
  accent?: HarborLook;
  /** Motion level. Missing on older ledgers — treat as lively. */
  motion?: HarborMotion;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  /** Usual plan. Same every month unless a month budget overrides it. */
  plannedMonthly: number;
  /** When set, this category is a split of that parent. */
  parentId?: string | null;
};

/** A budget that applies to one month only. The usual plan stays on the category. */
export type MonthBudget = {
  categoryId: string;
  ym: string;
  amount: number;
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  merchantKey: string;
  amount: number;
  sourceLabel: string;
  fingerprint: string;
  categoryId: string | null;
  userSet: boolean;
  notes: string;
  excluded: boolean;
  status: TxStatus;
};

export type MerchantRule = {
  merchantKey: string;
  categoryId: string;
};

export type ImportBatch = {
  id: string;
  fileName: string;
  importedAt: string;
  added: number;
  skippedDuplicates: number;
  sourceLabel: string;
};

export type RecurringGroup = {
  merchantKey: string;
  interval: RecurringInterval;
  count: number;
  avgAmount: number;
  lastDate: string;
  firstDate: string;
  categoryId: string | null;
  sampleDescription: string;
  direction: "in" | "out";
};

export type ColumnRole =
  | "date"
  | "description"
  | "amount"
  | "debit"
  | "credit"
  | "direction"
  | "ignore";

export type DetectedColumn = {
  index: number;
  header: string;
  role: ColumnRole;
};

export type ParsePreviewRow = {
  date: string | null;
  description: string;
  amount: number | null;
  raw: string[];
};

export type CsvPreview = {
  fileName: string;
  delimiter: string;
  headers: string[];
  columns: DetectedColumn[];
  rows: ParsePreviewRow[];
  rawRowCount: number;
  guessedSource: string;
  amountNote: string;
  issues: string[];
};

export type LedgerSnapshot = {
  profile: Profile;
  categories: Category[];
  transactions: Transaction[];
  merchantRules: MerchantRule[];
  imports: ImportBatch[];
  monthBudgets: MonthBudget[];
  activeMonth: string;
  activeWeek: string;
};

export type StoreState = LedgerSnapshot & {
  hydrated: boolean;
};
