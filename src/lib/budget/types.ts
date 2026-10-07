export type Household = "single" | "partnered" | "married";
export type LifeStage = "student" | "early-career" | "established" | "parent" | "retired";
export type Housing = "family" | "rent" | "own";
export type BudgetGoal = "track" | "save" | "debt" | "purchase" | "live-within";
export type CategoryKind = "income" | "expense";
export type RecurringInterval = "weekly" | "biweekly" | "monthly" | "irregular";
export type BudgetPeriod = "week" | "month";
export type TxStatus = "posted" | "refund" | "transfer" | "reimbursement";
export type HarborLook = "harbor" | "dusk" | "tide" | "auto";
export type HarborMotion = "calm" | "lively";
/** How much of the ledger to show. Missing on older ledgers — treat as simple. */
export type DetailMode = "simple" | "nerd";
/** Which Plan page opens first. "monthly" starts fresh. "buckets" carries leftovers. Missing means monthly. */
export type BudgetStyle = "monthly" | "buckets";

export type IncomeCadence = "monthly" | "twice-monthly" | "biweekly" | "weekly" | "irregular";

export type IncomeStream = {
  id: string;
  name: string;
  /** Amount of one paycheck, not always a month. */
  amount: number;
  cadence: IncomeCadence;
  /** Words from the deposit description, such as an employer name. */
  matchHints: string[];
  /** Income category this source usually lands in. */
  categoryId?: string | null;
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
  /** Simple hides the extra tools. Missing means simple. */
  detail?: DetailMode;
  /** True after the person picks Simple or Nerd. Missing means they have not chosen yet. */
  detailChosen?: boolean;
  /** Monthly budgets reset. "buckets" carries what is left. Missing means monthly. */
  budgetStyle?: BudgetStyle;
  /** First month carry-over counts. Kept when the style switches back to monthly. */
  carryStartMonth?: string | null;
  /** Earliest file month the person was already asked about. Missing means not asked. */
  carryAskSeen?: string | null;
  /** Bank category labels the person already confirmed, normalized label to category id. Missing on older ledgers. */
  bankLabelMap?: Record<string, string> | null;
  /** Calendar year of birth. Missing on older ledgers. Age is the year you pass in, minus this. */
  birthYear?: number;
  /** Age to stop working. Missing means the full Social Security age default. */
  retireAge?: number;
  /** Inflation as a decimal, such as 0.02. Missing means the reference default. */
  plannerInflation?: number;
  /** Withdrawal rate as a decimal. Missing means 0.04. */
  withdrawalRate?: number;
  /** Yearly return band as decimals. Missing means the planning range. */
  returnBand?: { conservative: number; expected: number; optimistic: number };
  /** Share of income the person said they want to save. Missing means they have not said. */
  savingsGoalRate?: number;
  /** True while the sample household is loaded. Starting your own budget clears it. */
  demo?: boolean;
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
  /**
   * Carry override for this spending category only.
   * true carries leftovers, false starts fresh, missing follows the ledger style.
   * Income never carries, even if this is set. Missing on older ledgers.
   */
  carry?: boolean | null;
  /**
   * First month this category carries from, when it should not use the ledger start.
   * Missing means the ledger's carry start. Income never carries.
   */
  carryFrom?: string | null;
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
  /** Overall category. A divided row still keeps this, even when the money is split underneath. */
  categoryId: string | null;
  userSet: boolean;
  notes: string;
  excluded: boolean;
  status: TxStatus;
  /** Positive pieces that add up to the absolute amount. Only this row, only this month. */
  splits?: TxSplit[] | null;
  /** Which account this row came from. Missing on older rows. */
  accountId?: string | null;
  /** How this row was sorted on import. Cleared when the person picks a category. Missing on older rows. */
  auto?: TransactionAuto | null;
  /** The Category cell from the bank file. Missing on older rows. */
  bankLabel?: string | null;
  /** Set by hand for one charge or one month. A later default change leaves these alone. Missing on older rows. */
  pinned?: "charge" | "month" | null;
};

export type TxSplit = {
  categoryId: string;
  amount: number;
};

export type AutoConfidence = "sure" | "likely" | "unsure";

export type AutoSource =
  | "rule"
  | "history"
  | "family"
  | "income"
  | "keyword"
  | "repeat"
  | "transfer"
  | "bank"
  | "near"
  | "cash"
  | "none";

/** Why an imported charge was sorted, and how sure that was. */
export type TransactionAuto = {
  source: AutoSource;
  confidence: AutoConfidence;
  suggestedCategoryId: string | null;
  /** Plain sentence, when the bank or a rule named the reason. Missing on older rows. */
  reason?: string | null;
  /** True when the category is a fair guess the person has not confirmed. Missing means no. */
  provisional?: boolean;
};

/** Money set aside for a specific purchase, separate from the monthly envelopes. */
export type SavingsGoal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  /** Optional YYYY-MM. */
  by: string | null;
};

/** A locked monthly funding amount. Used so a later change does not rewrite the past. */
export type BucketRate = {
  ym: string;
  monthly: number;
};

/**
 * Money set aside that carries forward.
 * Not the same as profile.buckets, which is only the onboarding category list.
 * A linked category is a bucket, not also a monthly budget.
 */
export type MoneyBucket = {
  id: string;
  name: string;
  /** Amount added each month from monthlyFrom forward, unless that month is locked or paused. */
  monthly: number;
  /** When set, the person typed a year total. monthly is that number divided by 12. */
  yearly: number | null;
  categoryIds: string[];
  target: number | null;
  /** Optional YYYY-MM. */
  by: string | null;
  startMonth: string;
  /** Balance before the start month. A migrated goal puts "already saved" here. */
  opening: number;
  /** Set when this bucket was created from a savings goal, so reload does not copy it again. */
  fromGoalId?: string | null;
  /** First month that uses `monthly`. Earlier months use pastRates. Missing means startMonth. */
  monthlyFrom?: string;
  /** Funding already locked for past months. */
  pastRates?: BucketRate[];
  /** Paused buckets get no funding from pausedFrom forward. */
  paused?: boolean;
  pausedFrom?: string | null;
  /** Jar fill line. Missing means the target, or three times the monthly amount. */
  fullLine?: number | null;
  /** YYYY-MM when the extra-money note was dismissed. Shown again the next month. */
  nudgeDismissedYm?: string | null;
};

/** A transfer between buckets, or from unassigned money (fromId null). Not income and not spending. */
export type BucketMove = {
  id: string;
  ym: string;
  amount: number;
  fromId: string | null;
  toId: string;
};

export type NetWorthPoint = {
  id: string;
  date: string;
  amount: number;
  note: string;
};

export type DebtItem = {
  id: string;
  name: string;
  balance: number;
  /** Annual percentage rate, as a percent (18.9 means 18.9%). */
  apr: number;
  minimum: number;
};

/** Editable IRS-style figures. The math reads this object. It is not a set of hidden constants. */
export type IraRules = {
  year: number;
  under50: number;
  catchUp: number;
  rothSingleStart: number;
  rothSingleEnd: number;
  rothJointStart: number;
  rothJointEnd: number;
  note: string;
};

export type MerchantRule = {
  merchantKey: string;
  categoryId: string;
  /** Income and expenses can keep different categories for the same name. Missing means both. */
  side?: "in" | "out";
};

export type ImportBatch = {
  id: string;
  fileName: string;
  importedAt: string;
  added: number;
  skippedDuplicates: number;
  sourceLabel: string;
  /** Which account this file belongs to. Missing on older batches. */
  accountId?: string | null;
  /** Balance the file reported, when it had one. */
  endingBalance?: { amount: number; asOf: string } | null;
};

/** Money taken out of a category leftover. A fund id saves it. Null only releases it. */
export type SetAside = {
  id: string;
  ym: string;
  categoryId: string;
  fundId: string | null;
  amount: number;
};

export type AccountKind = "checking" | "savings" | "credit" | "cash" | "investment" | "retirement" | "other";

export type GrowthBand = "cautious" | "typical" | "bold";

/** Optional growth guess. Missing on older accounts. A typed balance is never replaced by this. */
export type AccountGrowth = {
  band?: GrowthBand | null;
  /** Yearly return as a percent, such as 7. When set, it is the likely path. */
  returnPercent?: number | null;
  monthlyAdd?: number | null;
  /** Yearly fee as a percent of the balance. */
  yearlyFeePercent?: number | null;
  /** When true, Home may show the estimate between typed updates. Missing means no. */
  useEstimates?: boolean | null;
};

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  institution?: string | null;
  createdAt: string;
  growth?: AccountGrowth | null;
};

/** A balance for one account. Investment and retirement accounts can live on these alone. */
export type BalancePoint = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  source: "file" | "entered";
};

/** A savings plan: money set aside for one purchase. Same stored shape as before. */
export type SavingsPlan = MoneyBucket;

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
  | "memo"
  | "category"
  | "amount"
  | "debit"
  | "credit"
  | "direction"
  | "balance"
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
  /** Bank's own category label, when the file had one. */
  bankCategory?: string | null;
  /** Extra words. Not a replacement for the description. */
  memo?: string | null;
  /** Balance cell on this row, when the file had one. */
  balance?: number | null;
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
  /** Balance on the latest-dated row, when the file has a balance column. */
  endingBalance: { amount: number; asOf: string } | null;
};

export type LedgerSnapshot = {
  profile: Profile;
  categories: Category[];
  transactions: Transaction[];
  merchantRules: MerchantRule[];
  imports: ImportBatch[];
  monthBudgets: MonthBudget[];
  savingsGoals: SavingsGoal[];
  moneyBuckets: MoneyBucket[];
  bucketMoves: BucketMove[];
  netWorth: NetWorthPoint[];
  debts: DebtItem[];
  ira: IraRules;
  accounts: Account[];
  balances: BalancePoint[];
  /** Missing on older ledgers. */
  setAsides?: SetAside[];
  activeMonth: string;
  activeWeek: string;
};

export type StoreState = LedgerSnapshot & {
  hydrated: boolean;
};
