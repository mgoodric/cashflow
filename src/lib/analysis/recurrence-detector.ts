import type { RecurrencePattern, Transaction } from "@/lib/types/database";
import { median, stddev } from "@/lib/math";

interface CadenceTest {
  frequency: "monthly" | "quarterly" | "yearly";
  expectedMin: number;
  expectedMax: number;
  jitter: number;
  minOccurrences: number;
}

const CADENCES: CadenceTest[] = [
  { frequency: "monthly", expectedMin: 28, expectedMax: 35, jitter: 5, minOccurrences: 3 },
  { frequency: "quarterly", expectedMin: 85, expectedMax: 100, jitter: 15, minOccurrences: 3 },
  { frequency: "yearly", expectedMin: 350, expectedMax: 380, jitter: 15, minOccurrences: 2 },
];

function computeIntervals(dates: string[]): number[] {
  const sorted = dates
    .map((d) => new Date(d + "T00:00:00Z").getTime())
    .sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(Math.round((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24)));
  }
  return intervals;
}

function mostCommon<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<string, { value: T; count: number }>();
  for (const v of values) {
    const key = String(v);
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { value: v, count: 1 });
  }
  let best: { value: T; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best?.value ?? null;
}

interface PayeeGroup {
  payee: string;
  payeeNormalized: string;
  dates: string[];
  amounts: number[];
  types: ("income" | "expense")[];
  categoryIds: (string | null)[];
  accountIds: string[];
}

function groupByPayee(transactions: Transaction[]): PayeeGroup[] {
  const groups = new Map<string, PayeeGroup>();

  for (const t of transactions) {
    const key = t.payee_normalized ?? "";
    if (!key) continue;

    let group = groups.get(key);
    if (!group) {
      group = {
        payee: t.payee ?? key,
        payeeNormalized: key,
        dates: [],
        amounts: [],
        types: [],
        categoryIds: [],
        accountIds: [],
      };
      groups.set(key, group);
    }

    group.dates.push(t.transaction_date);
    group.amounts.push(Math.abs(t.amount));
    group.types.push(t.transaction_type);
    group.categoryIds.push(t.category_id);
    group.accountIds.push(t.account_id);
  }

  return Array.from(groups.values()).filter((g) => g.dates.length >= 2);
}

export function detectRecurringPatterns(transactions: Transaction[]): RecurrencePattern[] {
  const groups = groupByPayee(transactions);
  const patterns: RecurrencePattern[] = [];
  const now = Date.now();

  for (const group of groups) {
    const intervals = computeIntervals(group.dates);
    if (intervals.length === 0) continue;

    for (const cadence of CADENCES) {
      const medianInterval = median(intervals);
      const inRange =
        medianInterval >= cadence.expectedMin - cadence.jitter &&
        medianInterval <= cadence.expectedMax + cadence.jitter;

      if (!inRange) continue;

      const matchingIntervals = intervals.filter(
        (i) =>
          i >= cadence.expectedMin - cadence.jitter &&
          i <= cadence.expectedMax + cadence.jitter
      );

      const matchRatio = matchingIntervals.length / intervals.length;
      if (matchRatio < 0.6) continue;

      const occurrences = intervals.length + 1;
      if (occurrences < cadence.minOccurrences) continue;

      // Confidence scoring
      const intervalStddev = stddev(intervals);
      const intervalConsistency = Math.max(0, 1 - intervalStddev / medianInterval);

      const amounts = group.amounts;
      const amountMean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const amountCv = amountMean > 0 ? stddev(amounts) / amountMean : 0;
      const amountConsistency = Math.max(0, 1 - amountCv);

      const occurrenceScore = Math.min(occurrences / (cadence.minOccurrences * 2), 1.0);
      const confidence =
        occurrenceScore * 0.4 + intervalConsistency * 0.35 + amountConsistency * 0.25;

      if (confidence < 0.6) continue;

      // Staleness check
      const sortedDates = group.dates
        .map((d) => new Date(d + "T00:00:00Z").getTime())
        .sort((a, b) => a - b);
      const lastOccurrenceMs = sortedDates[sortedDates.length - 1];
      const daysSinceLast = Math.round((now - lastOccurrenceMs) / (1000 * 60 * 60 * 24));
      const isStale = daysSinceLast > medianInterval * 2;

      // Suggested day of month (most common)
      const daysOfMonth = group.dates.map((d) => new Date(d + "T00:00:00Z").getUTCDate());
      const suggestedDayOfMonth = mostCommon(daysOfMonth) ?? 1;

      patterns.push({
        payee: group.payee,
        payeeNormalized: group.payeeNormalized,
        frequency: cadence.frequency,
        confidence,
        occurrenceCount: occurrences,
        medianAmount: median(amounts),
        amountRange: { min: Math.min(...amounts), max: Math.max(...amounts) },
        lastOccurrence: new Date(lastOccurrenceMs).toISOString().split("T")[0],
        suggestedDayOfMonth,
        suggestedEventType: mostCommon(group.types) ?? "expense",
        mostCommonCategory: mostCommon(group.categoryIds.filter(Boolean) as string[]),
        mostCommonAccountId: mostCommon(group.accountIds),
        intervalConsistency,
        amountConsistency,
        isStale,
      });

      break; // Take the first matching cadence (monthly > quarterly > yearly)
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}
