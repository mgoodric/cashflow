export type AccountType = "checking" | "savings" | "credit" | "loan" | "investment";
export type EventType = "income" | "expense";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  current_balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface RecurrenceRule {
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  interval: number;
  day_of_month?: number;
  end_date?: string;
}

export interface CashflowEvent {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  name: string;
  event_type: EventType;
  amount: number;
  event_date: string;
  is_recurring: boolean;
  recurrence_rule: RecurrenceRule | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  account?: Account;
}

export interface Scenario {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  balance_adjustments: Record<string, number> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScenarioEvent {
  id: string;
  scenario_id: string;
  event_id: string | null;
  action: "exclude" | "modify" | "add";
  name: string | null;
  event_type: EventType | null;
  amount: number | null;
  event_date: string | null;
  account_id: string | null;
  is_recurring: boolean | null;
  recurrence_rule: RecurrenceRule | null;
  notes: string | null;
  created_at: string;
}

export interface EventOverride {
  id: string;
  event_id: string;
  original_date: string;
  override_amount: number | null;
  override_date: string | null;
  is_skipped: boolean;
  notes: string | null;
  created_at: string;
}

export interface ImportSession {
  id: string;
  user_id: string;
  source: string;
  filename: string;
  account_id: string | null;
  transaction_count: number;
  status: "pending" | "completed" | "rolled_back";
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  import_session_id: string | null;
  category_id: string | null;
  transaction_date: string;
  amount: number;
  payee: string | null;
  payee_normalized: string | null;
  memo: string | null;
  check_number: string | null;
  transaction_type: "income" | "expense";
  source: string;
  event_id: string | null;
  suggested_event_id: string | null;
  is_cleared: boolean;
  original_category: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
}

export interface ImportPayload {
  source: "qif" | "csv";
  filename: string;
  accountMappings: Array<{
    qifName: string;
    qifType: string;
    action: "create" | "match" | "skip";
    matchedAccountId?: string;
    newAccountType?: AccountType;
  }>;
  categoryMappings: Array<{
    qifPath: string;
    action: "create" | "match" | "skip";
    matchedCategoryId?: string;
  }>;
  transactions: Array<{
    date: string;
    amount: number;
    payee: string;
    category: string;
    memo: string | null;
    checkNumber: string | null;
    qifAccountName: string;
    type: "income" | "expense";
  }>;
  dateFormat: string;
  skipDuplicates: boolean;
  skipTransfers: boolean;
}

export interface ImportResult {
  sessionId: string;
  accountsCreated: number;
  categoriesCreated: number;
  transactionsImported: number;
  duplicatesSkipped: number;
  errors: string[];
}

export interface RecurrencePattern {
  payee: string;
  payeeNormalized: string;
  frequency: "monthly" | "quarterly" | "yearly";
  confidence: number;
  occurrenceCount: number;
  medianAmount: number;
  amountRange: { min: number; max: number };
  lastOccurrence: string;
  suggestedDayOfMonth: number;
  suggestedEventType: "income" | "expense";
  mostCommonCategory: string | null;
  mostCommonAccountId: string | null;
  intervalConsistency: number;
  amountConsistency: number;
  isStale: boolean;
}

export interface MisclassificationFlag {
  transactionId: string;
  transactionDate: string;
  amount: number;
  payee: string;
  currentCategoryId: string | null;
  currentCategoryName: string | null;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  reason: "payee_mismatch" | "amount_outlier" | "both";
  confidence: number;
  payeeConsistency: number;
  amountZScore: number | null;
}

export interface ProjectionDataPoint {
  date: string;
  balance: number;
  events: { name: string; amount: number; type: EventType }[];
}

export interface ProjectionResult {
  dataPoints: ProjectionDataPoint[];
  negativeDates: string[];
  lowestBalance: number;
  lowestBalanceDate: string;
}
