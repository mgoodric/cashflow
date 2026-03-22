# Cashflow Manager — Import & Intelligence Features Spec

**Date:** 2026-03-18
**Status:** Draft
**Depends on:** Phase 1 MVP (complete)

---

## Table of Contents

1. [Shared Schema Additions](#1-shared-schema-additions)
2. [Feature 1: Quicken QIF Import](#2-feature-1-quicken-qif-import)
3. [Feature 2: Recurring Pattern Detection](#3-feature-2-recurring-pattern-detection)
4. [Feature 3: Category Misclassification Audit](#4-feature-3-category-misclassification-audit)
5. [Implementation Order](#5-implementation-order)

---

## 1. Shared Schema Additions

All three features depend on a historical transactions table that is separate from the forecasting-oriented `cashflow_events` table.

### Why a Separate Table

`cashflow_events` is designed for forward-looking forecasting — the projection engine in `projection.ts` processes every active event. Historical transactions are fundamentally different:
- They represent what **actually happened**, not what's predicted
- They carry payee information (needed for pattern detection) that events don't
- They should never appear in the projection chart
- They need different indexes (by payee, by date range, by category)

### New Tables

#### `import_sessions`

Tracks each import operation for auditability and undo capability.

```sql
CREATE TABLE import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'qif',        -- 'qif', 'ofx', 'csv' (future)
  filename TEXT NOT NULL,                     -- original filename for reference
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',     -- 'pending', 'completed', 'rolled_back'
  metadata JSONB,                             -- source-specific metadata (QIF headers, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_sessions_user_id ON import_sessions(user_id);
ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;
-- Standard RLS policies (same pattern as existing tables)
```

#### `transactions`

Historical transaction records imported from external sources.

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  import_session_id UUID REFERENCES import_sessions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Core transaction data
  transaction_date DATE NOT NULL,
  amount NUMERIC NOT NULL,                    -- positive for income, negative for expenses
  payee TEXT,                                 -- raw payee string from source
  payee_normalized TEXT,                      -- lowercase, stripped suffixes/prefixes
  memo TEXT,                                  -- QIF memo field
  check_number TEXT,                          -- QIF check number field

  -- Classification
  transaction_type TEXT NOT NULL DEFAULT 'expense',  -- 'income' or 'expense'
  source TEXT NOT NULL DEFAULT 'qif',         -- 'qif', 'ofx', 'csv', 'manual' (TEXT not ENUM for extensibility)

  -- Linkage
  event_id UUID REFERENCES cashflow_events(id) ON DELETE SET NULL,
    -- bridges forecast ↔ actuals: links this historical transaction to the
    -- cashflow_event it corresponds to (for Phase 4 variance tracking)
  suggested_event_id UUID REFERENCES cashflow_events(id) ON DELETE SET NULL,
    -- set when pattern detection links this to a created recurring event

  -- Reconciliation
  is_cleared BOOLEAN NOT NULL DEFAULT false,  -- marked as reconciled against bank statement (Phase 4)

  -- Audit
  original_category TEXT,                     -- raw category string from QIF before mapping
  is_flagged BOOLEAN NOT NULL DEFAULT false,  -- flagged by category audit
  flag_reason TEXT,                           -- why it was flagged

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_payee_normalized ON transactions(payee_normalized);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_import_session ON transactions(import_session_id);
CREATE INDEX idx_transactions_event_id ON transactions(event_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- Standard RLS policies (same pattern as existing tables)
```

### New TypeScript Types

```typescript
// lib/types/database.ts additions

export interface ImportSession {
  id: string;
  user_id: string;
  source: 'qif' | 'ofx' | 'csv';
  filename: string;
  account_id: string | null;
  transaction_count: number;
  status: 'pending' | 'completed' | 'rolled_back';
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
  transaction_type: 'income' | 'expense';
  source: string;
  event_id: string | null;
  suggested_event_id: string | null;
  is_cleared: boolean;
  original_category: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
}
```

---

## 2. Feature 1: Quicken QIF Import

### Overview

Upload a Quicken QIF export file to import accounts, categories, and transaction history into the application. QIF is the only viable parseable format — QFX/OFX lacks categories, QXF is encrypted.

### Dependencies

- **npm package:** `qif-ts` — TypeScript-native QIF parser
- **New route:** `/import`
- **New nav item:** "Import" in the app header

### QIF Format Reference

QIF is a plain ASCII, line-based format. Each line starts with a single-character field code:

| Code | Meaning | Maps To |
|------|---------|---------|
| `D` | Date | `transaction_date` |
| `T` | Amount | `amount` |
| `P` | Payee | `payee` |
| `L` | Category (with subcategory via `:`) | `category_id` lookup |
| `N` | Check number | `check_number` |
| `M` | Memo | `memo` |
| `^` | End of record | — |

Account types in QIF:
| QIF Type | App Account Type |
|----------|-----------------|
| `Bank` | `checking` |
| `CCard` | `credit` |
| `Oth A` (Other Asset) | `savings` or `investment` |
| `Oth L` (Other Liability) | `loan` |
| `Invst` | `investment` |
| `Cash` | `checking` |

### UI Flow

#### Step 1: File Upload

**Route:** `/import`
**Component:** `ImportWizard` (client component — multi-step)

- Drag-and-drop zone or file picker, accepts `.qif` files only
- Max file size: 10MB (sufficient for 20+ years of data)
- Client-side parsing using `qif-ts` `deserializeQif()` — no server upload needed for parsing
- Show parsing progress for large files

#### Step 2: Account Mapping

After parsing, display detected accounts from the QIF file:

```
┌─────────────────────────────────────────────────────┐
│ Account Mapping                                      │
│                                                      │
│ QIF Account        Type      →  App Account          │
│ ─────────────────────────────────────────────────── │
│ Chase Checking     Bank      →  [Create New ▾]       │
│ Visa Gold          CCard     →  [Create New ▾]       │
│ Savings            Oth A     →  [Match: "Savings" ▾] │
│                                                      │
│ Each dropdown shows:                                 │
│   • "Create New" (auto-maps type)                   │
│   • Existing accounts of compatible type             │
│   • "Skip this account"                             │
└─────────────────────────────────────────────────────┘
```

- Auto-match by name similarity (Levenshtein distance < 3 or substring match)
- Auto-map QIF type to app type for new accounts
- User can override all mappings
- "Skip" option excludes an account's transactions entirely

#### Step 3: Category Mapping

Display detected categories from QIF (colon-delimited → hierarchy):

```
┌──────────────────────────────────────────────────────┐
│ Category Import                                       │
│                                                       │
│ ☑ Import 47 categories from QIF file                 │
│                                                       │
│ QIF Category              →  App Category             │
│ ────────────────────────────────────────────────────  │
│ Utilities                 →  [Create: "Utilities" ▾]  │
│ Utilities:Electric        →  [Create: "Electric" ▾]   │
│   (child of Utilities)       (child of Utilities)     │
│ Utilities:Gas             →  [Create: "Gas" ▾]        │
│ Groceries                 →  [Match: "Groceries" ▾]   │
│                                                       │
│ ☐ Skip category import (transactions get no category) │
└──────────────────────────────────────────────────────┘
```

- Parse colon-delimited names into parent/child hierarchy
- Auto-match existing categories by exact name (case-insensitive)
- Create parent before child (topological sort)
- Transfer notation `[AccountName]` in category field indicates inter-account transfers — flag these for user attention

#### Step 4: Date Format Detection

QIF dates are ambiguous. Detect format by analyzing the full dataset:

**Algorithm:**
1. Parse all date strings from the file
2. For each candidate format (MM/DD/YY, DD/MM/YYYY, MM/DD/YYYY):
   - Count how many dates are valid (no month > 12 for month field, no day > 31, etc.)
   - Reject formats where any date is invalid
3. If only one format produces all-valid dates → use it automatically
4. If ambiguous (e.g., all dates have day ≤ 12) → show user a sample and ask

```
┌──────────────────────────────────────────────────────┐
│ Date Format                                           │
│                                                       │
│ We detected dates like: 03/04/25, 12/01/25, 06/15/25│
│                                                       │
│ What format is your Quicken using?                    │
│                                                       │
│ ◉ MM/DD/YY  (March 4, 2025)                         │
│ ○ DD/MM/YY  (April 3, 2025)                         │
│                                                       │
│ Preview: First transaction date → March 4, 2025      │
└──────────────────────────────────────────────────────┘
```

#### Step 5: Preview & Confirm

Summary of what will be imported:

```
┌──────────────────────────────────────────────────────┐
│ Import Summary                                        │
│                                                       │
│ Accounts:     3 new, 1 matched                       │
│ Categories:   47 new, 3 matched                      │
│ Transactions: 2,847 total                            │
│   • Income:   312                                    │
│   • Expense:  2,535                                  │
│   • Transfers: 42 (excluded)                         │
│ Date range:   Jan 2020 — Mar 2026                    │
│ Duplicates:   12 skipped (matched by date+amount+payee) │
│                                                       │
│ [Preview Transactions]  [Import]  [Cancel]            │
└──────────────────────────────────────────────────────┘
```

- "Preview Transactions" shows a scrollable table of first 100 transactions
- Duplicate detection: match on (account_id, transaction_date, amount, payee_normalized)
- Transfers (category = `[AccountName]`) are excluded by default with option to include

#### Step 6: Import Execution

Server action processes the import:

```typescript
// src/actions/import.ts

"use server";

export async function executeImport(payload: ImportPayload): Promise<ImportResult> {
  // 1. Create import_session record
  // 2. Create new accounts (if any)
  // 3. Create new categories (parent-first topological order)
  // 4. Batch insert transactions (chunks of 500)
  // 5. Update import_session with transaction_count and status
  // 6. Revalidate paths
  // Returns: { sessionId, accountsCreated, categoriesCreated, transactionsImported }
}

export async function rollbackImport(sessionId: string): Promise<void> {
  // Delete all transactions with import_session_id = sessionId
  // Delete import_session record
  // Does NOT delete created accounts/categories (user may have started using them)
}
```

**Interface:**

```typescript
interface ImportPayload {
  accountMappings: Array<{
    qifName: string;
    qifType: string;
    action: 'create' | 'match' | 'skip';
    matchedAccountId?: string;  // if action === 'match'
    newAccountType?: AccountType; // if action === 'create'
  }>;
  categoryMappings: Array<{
    qifPath: string;           // e.g., "Utilities:Electric"
    action: 'create' | 'match' | 'skip';
    matchedCategoryId?: string;
  }>;
  transactions: Array<{
    date: string;              // ISO format after parsing
    amount: number;
    payee: string;
    category: string;          // original QIF category string
    memo: string | null;
    checkNumber: string | null;
    qifAccountName: string;
    type: 'income' | 'expense';
  }>;
  dateFormat: 'MM/DD/YY' | 'DD/MM/YY' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  skipDuplicates: boolean;
  skipTransfers: boolean;
}

interface ImportResult {
  sessionId: string;
  accountsCreated: number;
  categoriesCreated: number;
  transactionsImported: number;
  duplicatesSkipped: number;
  errors: string[];
}
```

### Payee Normalization

Applied during import and stored in `payee_normalized`:

```typescript
function normalizePayee(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(inc|llc|co|corp|ltd|pllc|lp)\b\.?/g, '')  // strip business suffixes
    .replace(/^(pos|ach|chk|check|debit|credit)\s*/i, '')    // strip transaction prefixes
    .replace(/\s*#\d+$/g, '')         // strip trailing reference numbers
    .replace(/\s+/g, ' ')            // collapse whitespace
    .trim();
}
```

### Error Handling

| Error | Handling |
|-------|----------|
| Invalid QIF file (no records parsed) | Show error, don't proceed past Step 1 |
| QIF file too large (>10MB) | Reject at file picker level |
| Partial parse failure (some records malformed) | Import valid records, report count of skipped records |
| Server action failure mid-import | Rollback: delete all transactions from this import_session |
| Duplicate account name on create | Append " (imported)" suffix |

---

## 3. Feature 2: Recurring Pattern Detection

### Overview

Analyze imported historical transactions to detect monthly, quarterly, and annual recurring patterns. Present suggestions for creating forecasting events (`cashflow_events`) from detected patterns.

### When It Runs

- **Post-import prompt:** After a QIF import completes, offer "Analyze transactions for recurring patterns?"
- **On-demand:** Button on `/import` page or new `/insights` page: "Detect Recurring Patterns"
- Does NOT run automatically — always user-initiated

### Algorithm: Recurring Pattern Detection

#### Step 1: Group by Normalized Payee

Query all transactions for the user, grouped by `payee_normalized`:

```sql
SELECT payee_normalized,
       array_agg(transaction_date ORDER BY transaction_date) as dates,
       array_agg(amount ORDER BY transaction_date) as amounts,
       array_agg(transaction_type ORDER BY transaction_date) as types,
       array_agg(category_id ORDER BY transaction_date) as categories,
       COUNT(*) as occurrence_count
FROM transactions
WHERE user_id = $1 AND payee_normalized IS NOT NULL
GROUP BY payee_normalized
HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC;
```

#### Step 2: Compute Inter-Transaction Intervals

For each payee group with 2+ transactions:

```typescript
function computeIntervals(dates: string[]): number[] {
  const sorted = dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(Math.round((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24)));
  }
  return intervals;
}
```

#### Step 3: Test Against Known Cadences

Each cadence has an expected interval range and jitter tolerance:

| Cadence | Expected Interval (days) | Jitter Tolerance | Min Occurrences |
|---------|-------------------------|-------------------|-----------------|
| Monthly | 28–35 | ±5 days | 3 |
| Quarterly | 85–100 | ±15 days | 3 |
| Annual | 350–380 | ±15 days | 2 |

**Detection logic:**

```typescript
interface CadenceTest {
  frequency: 'monthly' | 'quarterly' | 'yearly';
  expectedMin: number;
  expectedMax: number;
  jitter: number;
  minOccurrences: number;
}

const CADENCES: CadenceTest[] = [
  { frequency: 'monthly',   expectedMin: 28,  expectedMax: 35,  jitter: 5,  minOccurrences: 3 },
  { frequency: 'quarterly', expectedMin: 85,  expectedMax: 100, jitter: 15, minOccurrences: 3 },
  { frequency: 'yearly',    expectedMin: 350, expectedMax: 380, jitter: 15, minOccurrences: 2 },
];

function detectCadence(intervals: number[]): DetectedPattern | null {
  for (const cadence of CADENCES) {
    const medianInterval = median(intervals);
    const inRange = medianInterval >= (cadence.expectedMin - cadence.jitter)
                 && medianInterval <= (cadence.expectedMax + cadence.jitter);

    if (!inRange) continue;

    // Count how many intervals fall within the jitter window of the expected range
    const matchingIntervals = intervals.filter(
      i => i >= (cadence.expectedMin - cadence.jitter) && i <= (cadence.expectedMax + cadence.jitter)
    );

    // At least 60% of intervals must match the cadence
    if (matchingIntervals.length / intervals.length < 0.6) continue;

    // Need minimum occurrences (intervals + 1 = occurrences)
    if (intervals.length + 1 < cadence.minOccurrences) continue;

    return {
      frequency: cadence.frequency,
      medianInterval,
      matchRatio: matchingIntervals.length / intervals.length,
    };
  }
  return null;
}
```

#### Step 4: Confidence Scoring

```typescript
interface RecurrencePattern {
  payee: string;
  payeeNormalized: string;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  confidence: number;            // 0.0 – 1.0
  occurrenceCount: number;
  medianAmount: number;
  amountRange: { min: number; max: number };
  lastOccurrence: string;        // ISO date
  suggestedDayOfMonth: number;   // most common day
  suggestedEventType: 'income' | 'expense';
  mostCommonCategory: string | null;  // category_id
  intervalConsistency: number;   // 0.0 – 1.0
  amountConsistency: number;     // 0.0 – 1.0
}

function scoreConfidence(
  occurrences: number,
  minOccurrences: number,
  intervalConsistency: number,   // 1 - (stddev / median) of intervals
  amountConsistency: number,     // 1 - coefficient of variation of amounts
): number {
  const occurrenceScore = Math.min(occurrences / (minOccurrences * 2), 1.0);

  return (
    occurrenceScore * 0.40 +
    intervalConsistency * 0.35 +
    amountConsistency * 0.25
  );
}
```

**Confidence thresholds:**

| Confidence | Label | Action |
|-----------|-------|--------|
| 0.85+ | High | Auto-suggest with green indicator |
| 0.60–0.84 | Medium | Suggest with yellow indicator |
| < 0.60 | Low | Do not show (too unreliable) |

#### Step 5: Staleness Check

A pattern is considered **stale** (likely ended) if:
- Last occurrence was more than `2 × expected_interval` days ago
- Example: monthly pattern with last occurrence 75+ days ago → stale

Stale patterns are shown in a separate "Possibly Ended" section, not mixed with active suggestions.

### Suggestion UI

**Route:** `/insights/recurring` (or modal triggered post-import)

```
┌─────────────────────────────────────────────────────────────┐
│ Recurring Pattern Suggestions                    [Refresh]   │
│                                                              │
│ We found 12 recurring patterns in your transaction history.  │
│                                                              │
│ ── High Confidence ──────────────────────────────────────── │
│                                                              │
│ 🟢 Netflix                     Monthly    $15.99            │
│    12 occurrences, last: Mar 1  Day: 1st                    │
│    [Add as Event]  [Dismiss]  [Edit & Add]                  │
│                                                              │
│ 🟢 Paycheck - Acme Corp        Monthly    $4,250.00         │
│    24 occurrences, last: Mar 15  Day: 15th                  │
│    Amount range: $4,200 – $4,300                            │
│    [Add as Event]  [Dismiss]  [Edit & Add]                  │
│                                                              │
│ ── Medium Confidence ────────────────────────────────────── │
│                                                              │
│ 🟡 State Farm Insurance         Quarterly  $487.00          │
│    6 occurrences, last: Jan 15   Day: 15th                  │
│    [Add as Event]  [Dismiss]  [Edit & Add]                  │
│                                                              │
│ ── Possibly Ended ───────────────────────────────────────── │
│                                                              │
│ ⚪ Planet Fitness               Monthly    $24.99           │
│    8 occurrences, last: Oct 2025                            │
│    Last seen 5 months ago                                    │
│    [Add as Event]  [Dismiss]                                │
└─────────────────────────────────────────────────────────────┘
```

### Actions

**"Add as Event"** — Creates a `cashflow_event` with:
- `name`: payee (original casing)
- `event_type`: most common type from transactions
- `amount`: median amount
- `event_date`: next expected occurrence (calculated from last occurrence + interval)
- `is_recurring`: true
- `recurrence_rule`: `{ frequency, interval: 1, day_of_month: suggestedDay }`
- `account_id`: most common account from transactions
- `category_id`: most common category from transactions

**"Edit & Add"** — Opens the standard event creation form, pre-filled with detected values. User can adjust amount, frequency, account, etc.

**"Dismiss"** — Hides this suggestion. Store dismissal in a `dismissed_suggestions` JSONB column on a user preferences table, or a lightweight `pattern_dismissals` table keyed by `(user_id, payee_normalized, frequency)`.

### Mapping to RecurrenceRule

```typescript
function patternToRecurrenceRule(pattern: RecurrencePattern): RecurrenceRule {
  return {
    frequency: pattern.frequency,
    interval: 1,
    day_of_month: pattern.suggestedDayOfMonth,
    // No end_date — user can set this manually
  };
}
```

### Amount Variance Handling

For payees with variable amounts (e.g., utility bills):
- Show the **median** as the suggested amount
- Display the **range** (min–max) in the UI so user knows it varies
- If coefficient of variation > 0.3 (amounts vary by 30%+), show a note: "This amount varies significantly — consider using the average"

---

## 4. Feature 3: Category Misclassification Audit

### Overview

Analyze imported transactions to detect likely category errors — transactions that are categorized differently from how the same payee is usually categorized. This helps clean up data before running pattern detection.

### When It Runs

- **Post-import prompt:** After QIF import, offer "Check for category inconsistencies?"
- **On-demand:** Button on `/insights` page: "Audit Categories"
- Should run BEFORE pattern detection (cleaner data → better patterns)

### Algorithm: Category Misclassification Detection

#### Method 1: Payee-Category Consistency

For each payee, determine the "expected" category and flag outliers.

```typescript
interface PayeeCategoryProfile {
  payeeNormalized: string;
  dominantCategory: string | null;  // category_id used most often
  dominantCount: number;            // how many times dominant category was used
  totalCount: number;               // total transactions for this payee
  consistency: number;              // dominantCount / totalCount (0.0 – 1.0)
  outlierTransactions: Transaction[]; // transactions NOT using the dominant category
}
```

**Algorithm:**

```sql
-- For each payee, find the most common category and flag mismatches
WITH payee_categories AS (
  SELECT
    payee_normalized,
    category_id,
    COUNT(*) as cat_count,
    SUM(COUNT(*)) OVER (PARTITION BY payee_normalized) as total_count
  FROM transactions
  WHERE user_id = $1 AND payee_normalized IS NOT NULL
  GROUP BY payee_normalized, category_id
),
dominant AS (
  SELECT DISTINCT ON (payee_normalized)
    payee_normalized,
    category_id as dominant_category,
    cat_count as dominant_count,
    total_count,
    cat_count::float / total_count as consistency
  FROM payee_categories
  ORDER BY payee_normalized, cat_count DESC
)
SELECT * FROM dominant
WHERE consistency < 1.0      -- has at least one mismatch
  AND total_count >= 3        -- enough data to establish a pattern
  AND consistency >= 0.6      -- dominant category is meaningful (not random)
ORDER BY total_count DESC;
```

**Thresholds:**
- Minimum 3 transactions per payee to flag (below that, no "pattern" to deviate from)
- Dominant category must have ≥60% share to be considered the "expected" category
- Only flag transactions using a non-dominant category

#### Method 2: Amount-Category Outlier Detection

Flag transactions where the amount is unusual for its category.

```typescript
interface CategoryAmountProfile {
  categoryId: string;
  categoryName: string;
  medianAmount: number;
  stddevAmount: number;
  outlierTransactions: Transaction[]; // amount > 2 stddev from median
}
```

**Algorithm:**

```sql
WITH category_stats AS (
  SELECT
    category_id,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ABS(amount)) as median_amount,
    STDDEV(ABS(amount)) as stddev_amount,
    COUNT(*) as transaction_count
  FROM transactions
  WHERE user_id = $1 AND category_id IS NOT NULL
  GROUP BY category_id
  HAVING COUNT(*) >= 5  -- need enough data for meaningful stats
)
SELECT t.*, cs.median_amount, cs.stddev_amount
FROM transactions t
JOIN category_stats cs ON t.category_id = cs.category_id
WHERE t.user_id = $1
  AND ABS(ABS(t.amount) - cs.median_amount) > (2 * cs.stddev_amount)
ORDER BY ABS(ABS(t.amount) - cs.median_amount) / cs.stddev_amount DESC;
```

**This catches:**
- A $500 transaction categorized as "Coffee" (median $5)
- A $3 transaction categorized as "Rent" (median $2,000)

#### Combined Confidence Score

```typescript
interface MisclassificationFlag {
  transaction: Transaction;
  reason: 'payee_mismatch' | 'amount_outlier' | 'both';
  confidence: number;         // 0.0 – 1.0
  suggestedCategory: string | null;  // category_id from payee's dominant category
  payeeConsistency: number;   // how consistent this payee usually is
  amountZScore: number | null; // how many stddevs from category median
}

function scoreMisclassification(
  isPayeeMismatch: boolean,
  payeeConsistency: number,     // 0.6–1.0 (how strong the dominant category is)
  isAmountOutlier: boolean,
  amountZScore: number | null,  // z-score of amount within its category
): number {
  let score = 0;

  if (isPayeeMismatch) {
    // Higher payee consistency = stronger signal that this one is wrong
    score += payeeConsistency * 0.6;
  }

  if (isAmountOutlier && amountZScore !== null) {
    // Larger z-score = more anomalous
    score += Math.min(amountZScore / 4, 1.0) * 0.4;
  }

  return Math.min(score, 1.0);
}
```

### Suggestion UI

**Route:** `/insights/categories` (or modal triggered post-import)

```
┌──────────────────────────────────────────────────────────────┐
│ Category Audit Results                          [Re-analyze]  │
│                                                               │
│ Found 23 potential misclassifications across 2,847 transactions│
│                                                               │
│ ── Payee Mismatches (15) ────────────────────────────────── │
│                                                               │
│ Starbucks — usually "Dining Out" (95% of 40 transactions)    │
│                                                               │
│  ☐ Mar 12  -$5.45  categorized as "Groceries"               │
│     → Suggest: Dining Out    [Fix] [Keep] [Fix All Like This]│
│  ☐ Jan 03  -$6.20  categorized as "Entertainment"            │
│     → Suggest: Dining Out    [Fix] [Keep] [Fix All Like This]│
│                                                               │
│ Amazon — usually "Shopping" (72% of 89 transactions)         │
│                                                               │
│  ☐ Feb 28  -$149.99  categorized as "Electronics"            │
│     → Suggest: Shopping      [Fix] [Keep]                    │
│  ☐ Dec 15  -$12.99   categorized as "Books"                  │
│     → Suggest: Shopping      [Fix] [Keep]                    │
│     ℹ️ Note: Amazon has varied categories — review carefully  │
│                                                               │
│ ── Amount Outliers (8) ──────────────────────────────────── │
│                                                               │
│  ☐ Mar 05  -$487.00  payee: "Target"  cat: "Groceries"      │
│     Typical for Groceries: $45–$120 (this is 4.2σ away)      │
│     → No suggestion (review manually)  [Recategorize ▾]      │
│                                                               │
│ ─────────────────────────────────────────────────────────── │
│ [Fix All Selected (0)]  [Dismiss Remaining]                  │
└──────────────────────────────────────────────────────────────┘
```

### Actions

**"Fix"** — Updates the transaction's `category_id` to the suggested category. Clears `is_flagged`.

**"Fix All Like This"** — For payee mismatches only. Updates all flagged transactions for this payee to the dominant category. Batch operation.

**"Keep"** — Dismisses the flag for this transaction. Sets `is_flagged = false`, `flag_reason = 'dismissed'`.

**"Recategorize"** — Opens a dropdown of all user categories. For amount outliers where there's no clear suggestion.

**"Fix All Selected"** — Batch operation. Checkboxes allow multi-select, then apply suggested fixes in bulk.

### Batch Correction Server Action

```typescript
// src/actions/category-audit.ts

"use server";

export async function fixCategoryMisclassifications(
  fixes: Array<{ transactionId: string; newCategoryId: string }>
): Promise<{ fixed: number; errors: string[] }> {
  // Batch update transactions with new category_ids
  // Clear is_flagged and flag_reason for fixed transactions
  // Revalidate relevant paths
}

export async function dismissFlags(
  transactionIds: string[]
): Promise<void> {
  // Set is_flagged = false, flag_reason = 'dismissed'
}
```

### Edge Cases

**Multi-purpose payees (e.g., Amazon, Walmart):**
- If dominant category consistency < 70%, show a note: "This payee has varied categories — review carefully"
- Don't show "Fix All Like This" for low-consistency payees

**Uncategorized transactions:**
- Transactions with no category are not flagged (nothing to "misclassify")
- But they ARE candidates for category suggestion based on payee's dominant category
- Show these in a separate "Uncategorized" section

**Categories that legitimately differ:**
- The amount outlier check helps here — if a Starbucks purchase is $5 and categorized as "Dining Out", that's consistent
- But if a Starbucks purchase is $150 and categorized as "Dining Out", the amount outlier catches it (probably a gift card → "Gifts")

---

## 5. Implementation Order

### Recommended Sequence

```
Phase A: Schema & Import (1-2 days)
├── Migration: import_sessions table
├── Migration: transactions table
├── Types: ImportSession, Transaction
├── qif-ts integration + payee normalization
├── Import wizard UI (6 steps)
└── Server action: executeImport, rollbackImport

Phase B: Category Audit (1 day)
├── Category audit algorithm (SQL queries + TypeScript scoring)
├── Server action: fixCategoryMisclassifications, dismissFlags
├── Category audit UI
└── Post-import prompt integration

Phase C: Recurring Pattern Detection (1-2 days)
├── Pattern detection algorithm (grouping + cadence testing + scoring)
├── Server action: create events from patterns
├── Suggestion UI with accept/edit/dismiss
├── Post-import prompt integration
└── Pattern dismissal storage

Phase D: Insights Hub (0.5 days)
├── /insights route with links to recurring patterns + category audit
├── Nav item addition
└── Dashboard integration (show insight count badges)
```

**Why this order:**
1. Import must come first — the other features need data
2. Category audit before pattern detection — cleaner categories = better pattern matching
3. Insights hub ties it all together

### New Files

```
src/
├── actions/
│   ├── import.ts              # executeImport, rollbackImport
│   └── category-audit.ts      # fixCategoryMisclassifications, dismissFlags
├── app/(app)/
│   ├── import/page.tsx         # Import wizard
│   └── insights/
│       ├── page.tsx            # Insights hub
│       ├── recurring/page.tsx  # Recurring pattern suggestions
│       └── categories/page.tsx # Category audit results
├── components/
│   ├── import/
│   │   ├── import-wizard.tsx   # Multi-step import flow (client component)
│   │   ├── account-mapper.tsx  # Step 2: account mapping
│   │   ├── category-mapper.tsx # Step 3: category mapping
│   │   ├── date-detector.tsx   # Step 4: date format
│   │   └── import-preview.tsx  # Step 5: summary
│   ├── insights/
│   │   ├── recurring-list.tsx  # Pattern suggestion cards
│   │   └── category-audit.tsx  # Misclassification flags
│   └── shared/
│       └── confidence-badge.tsx # Reusable confidence indicator
└── lib/
    ├── import/
    │   ├── qif-parser.ts       # QIF parsing + normalization wrapper
    │   ├── payee-normalizer.ts # Payee string normalization
    │   └── date-detector.ts    # Date format detection
    └── analysis/
        ├── recurrence-detector.ts  # Pattern detection algorithm
        └── category-auditor.ts     # Misclassification detection
```

### New Migration Files

```
supabase/migrations/
├── 005_import_sessions.sql
└── 006_transactions.sql
```
