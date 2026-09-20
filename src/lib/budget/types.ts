export type Household = "single" | "partnered" | "married";
export type LifeStage = "student" | "early-career" | "established" | "parent" | "retired";
export type Housing = "family" | "rent" | "own";
export type BudgetGoal = "track" | "save" | "debt" | "purchase" | "live-within";
export type CategoryKind = "income" | "expense";
export type RecurringInterval = "weekly" | "biweekly" | "monthly" | "irregular";
export type BudgetPeriod = "week" | "month";
export type TxStatus = "posted" | "refund" | "transfer" | "reimbursement";

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
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  plannedMonthly: number;
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
  activeMonth: string;
  activeWeek: string;
};

export type StoreState = LedgerSnapshot & {
  hydrated: boolean;
};
