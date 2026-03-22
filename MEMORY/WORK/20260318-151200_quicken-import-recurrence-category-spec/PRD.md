---
task: Spec Quicken import, recurrence detection, category audit
slug: 20260318-151200_quicken-import-recurrence-category-spec
effort: extended
phase: complete
progress: 26/26
mode: interactive
started: 2026-03-18T15:12:00-07:00
updated: 2026-03-18T15:22:00-07:00
---

## Context

Three feature specs for the Cashflow Manager app, building on QIF research already completed. These specs will guide implementation of: (1) Quicken QIF file import for accounts, categories, and transaction history, (2) recurring pattern detection that analyzes imported historical transactions to suggest forecasting events, and (3) category misclassification detection that flags likely miscategorized transactions.

**What was requested:**
- Feature spec for importing Quicken exports (accounts + historical records)
- Feature spec for identifying monthly/quarterly/annual recurring patterns and suggesting them as forecasting line items
- Feature spec for detecting incorrectly categorized transactions

**Key constraints:**
- Existing schema: accounts (5 types), categories (hierarchical parent_id), cashflow_events (with JSONB recurrence_rule)
- QIF is the only viable parseable format from Quicken (per earlier research)
- QIF does NOT export recurring transaction rules — hence the pattern detection feature
- QIF categories use colon-delimited hierarchy (e.g., "Utilities:Electric")
- No transaction history table exists yet — need to decide if imported data goes into cashflow_events or a new table

### Risks
- QIF date format varies by locale (MM/DD/YY vs DD/MM/YYYY) — parser must handle ambiguity
- Large QIF files (10+ years of data) could be slow to parse client-side
- Pattern detection false positives on irregular-but-similar transactions
- Category misclassification detection requires enough data to establish baselines
- Current cashflow_events table is designed for forecasting, not historical actuals — schema tension

## Criteria

- [x] ISC-1: QIF import spec defines file upload UI flow
- [x] ISC-2: QIF import spec maps QIF account types to app account types
- [x] ISC-3: QIF import spec maps QIF colon-delimited categories to parent_id hierarchy
- [x] ISC-4: QIF import spec defines transaction-to-transactions-table field mapping
- [x] ISC-5: QIF import spec addresses date format ambiguity detection
- [x] ISC-6: QIF import spec includes preview/confirmation step before insert
- [x] ISC-7: QIF import spec defines duplicate detection strategy
- [x] ISC-8: QIF import spec identifies required schema changes or new tables
- [x] ISC-9: QIF import spec specifies server action signatures and error handling
- [x] ISC-10: Recurrence spec defines pattern detection algorithm for monthly frequency
- [x] ISC-11: Recurrence spec defines pattern detection algorithm for quarterly frequency
- [x] ISC-12: Recurrence spec defines pattern detection algorithm for annual frequency
- [x] ISC-13: Recurrence spec defines confidence scoring for detected patterns
- [x] ISC-14: Recurrence spec defines suggestion UI with accept/reject/edit actions
- [x] ISC-15: Recurrence spec maps detected patterns to RecurrenceRule JSONB structure
- [x] ISC-16: Recurrence spec handles amount variance in recurring transactions
- [x] ISC-17: Recurrence spec defines minimum data thresholds for pattern validity
- [x] ISC-18: Category audit spec defines misclassification detection algorithm
- [x] ISC-19: Category audit spec defines payee-to-category consistency scoring
- [x] ISC-20: Category audit spec defines outlier detection for amount-category pairs
- [x] ISC-21: Category audit spec defines suggestion UI for corrections
- [x] ISC-22: Category audit spec handles batch correction workflow
- [x] ISC-23: Category audit spec defines confidence thresholds for flagging
- [x] ISC-24: All three specs identify shared schema additions needed
- [x] ISC-A-1: Anti: Specs do not require changes to existing migration files
- [x] ISC-A-2: Anti: Pattern detection does not suggest one-off transactions as recurring

## Decisions

- 2026-03-18 15:12: Using QIF as sole import format per prior research — QFX/OFX lacks categories, QXF is encrypted
- 2026-03-18 15:12: Recommending `qif-ts` npm package for TypeScript-native parsing
- 2026-03-18 15:18: Separate `transactions` table (not cashflow_events) for imported history — confirmed by Architect review
- 2026-03-18 15:18: Payee normalization is the foundation of both pattern detection and category audit
- 2026-03-18 15:18: Category audit should run BEFORE pattern detection (cleaner data → better patterns)
- 2026-03-18 15:20: Pattern detection uses median-based cadence testing with jitter tolerance, not strict interval matching
- 2026-03-18 15:20: Confidence scoring weights: 40% occurrence count, 35% interval consistency, 25% amount consistency

## Verification

- ISC-1: SPEC.md §2 "UI Flow" Step 1 defines drag-and-drop upload with .qif filter and 10MB limit
- ISC-2: SPEC.md §2 includes QIF-to-app account type mapping table (Bank→checking, CCard→credit, etc.)
- ISC-3: SPEC.md §2 Step 3 defines colon-delimited parsing with topological parent-first creation
- ISC-4: SPEC.md §2 defines ImportPayload transaction fields mapping to new transactions table columns
- ISC-5: SPEC.md §2 Step 4 defines date format detection algorithm with ambiguity fallback to user prompt
- ISC-6: SPEC.md §2 Step 5 defines preview summary with transaction counts, date range, duplicate count
- ISC-7: SPEC.md §2 Step 5 defines duplicate detection by (account_id, date, amount, payee_normalized)
- ISC-8: SPEC.md §1 defines import_sessions and transactions tables with full SQL schemas
- ISC-9: SPEC.md §2 defines executeImport and rollbackImport server actions with typed interfaces
- ISC-10: SPEC.md §3 CADENCES table defines monthly detection (28-35 day interval, ±5 jitter, 3 min occurrences)
- ISC-11: SPEC.md §3 CADENCES table defines quarterly detection (85-100 day interval, ±15 jitter, 3 min occurrences)
- ISC-12: SPEC.md §3 CADENCES table defines annual detection (350-380 day interval, ±15 jitter, 2 min occurrences)
- ISC-13: SPEC.md §3 Step 4 defines scoreConfidence function with weighted formula
- ISC-14: SPEC.md §3 "Suggestion UI" defines Add/Edit&Add/Dismiss actions with wireframe
- ISC-15: SPEC.md §3 patternToRecurrenceRule function maps frequency + day_of_month to JSONB
- ISC-16: SPEC.md §3 "Amount Variance Handling" uses median + range display + CV threshold
- ISC-17: SPEC.md §3 CADENCES table specifies minOccurrences per frequency + 60% match ratio
- ISC-18: SPEC.md §4 defines two methods: payee-category consistency + amount-category outlier
- ISC-19: SPEC.md §4 Method 1 defines PayeeCategoryProfile with dominantCount/totalCount ratio
- ISC-20: SPEC.md §4 Method 2 defines z-score outlier detection (>2σ from category median)
- ISC-21: SPEC.md §4 "Suggestion UI" defines Fix/Keep/Fix All/Recategorize actions with wireframe
- ISC-22: SPEC.md §4 defines fixCategoryMisclassifications batch server action + "Fix All Selected"
- ISC-23: SPEC.md §4 defines thresholds: ≥3 transactions, ≥60% dominant, 0.6 confidence cutoff
- ISC-24: SPEC.md §1 defines import_sessions + transactions tables shared across all features
- ISC-A-1: New migrations are 005 and 006, existing 001-004 untouched
- ISC-A-2: minOccurrences (3 monthly, 3 quarterly, 2 annual) + 60% match ratio prevents one-off suggestions
