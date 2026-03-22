import type { MisclassificationFlag, Transaction, Category } from "@/lib/types/database";
import { median, stddev } from "@/lib/math";

interface PayeeCategoryProfile {
  payeeNormalized: string;
  dominantCategoryId: string | null;
  dominantCount: number;
  totalCount: number;
  consistency: number;
}

interface CategoryAmountStats {
  categoryId: string;
  medianAmount: number;
  stddevAmount: number;
  count: number;
}

function buildPayeeProfiles(transactions: Transaction[]): Map<string, PayeeCategoryProfile> {
  // Group by payee_normalized, then count categories
  const payeeGroups = new Map<string, Map<string, number>>();
  const payeeTotals = new Map<string, number>();

  for (const t of transactions) {
    const payee = t.payee_normalized;
    if (!payee || !t.category_id) continue;

    if (!payeeGroups.has(payee)) payeeGroups.set(payee, new Map());
    const catCounts = payeeGroups.get(payee)!;
    catCounts.set(t.category_id, (catCounts.get(t.category_id) ?? 0) + 1);
    payeeTotals.set(payee, (payeeTotals.get(payee) ?? 0) + 1);
  }

  const profiles = new Map<string, PayeeCategoryProfile>();

  for (const [payee, catCounts] of payeeGroups) {
    const total = payeeTotals.get(payee) ?? 0;
    if (total < 3) continue; // Need at least 3 transactions

    let dominantId: string | null = null;
    let dominantCount = 0;
    for (const [catId, count] of catCounts) {
      if (count > dominantCount) {
        dominantId = catId;
        dominantCount = count;
      }
    }

    const consistency = total > 0 ? dominantCount / total : 0;
    if (consistency < 0.6) continue; // Dominant category not meaningful enough

    profiles.set(payee, {
      payeeNormalized: payee,
      dominantCategoryId: dominantId,
      dominantCount,
      totalCount: total,
      consistency,
    });
  }

  return profiles;
}

function buildCategoryStats(transactions: Transaction[]): Map<string, CategoryAmountStats> {
  const catAmounts = new Map<string, number[]>();

  for (const t of transactions) {
    if (!t.category_id) continue;
    if (!catAmounts.has(t.category_id)) catAmounts.set(t.category_id, []);
    catAmounts.get(t.category_id)!.push(Math.abs(t.amount));
  }

  const stats = new Map<string, CategoryAmountStats>();
  for (const [catId, amounts] of catAmounts) {
    if (amounts.length < 5) continue; // Need enough data for meaningful stats
    stats.set(catId, {
      categoryId: catId,
      medianAmount: median(amounts),
      stddevAmount: stddev(amounts),
      count: amounts.length,
    });
  }

  return stats;
}

export function detectMisclassifications(
  transactions: Transaction[],
  categories: Category[]
): MisclassificationFlag[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const payeeProfiles = buildPayeeProfiles(transactions);
  const categoryStats = buildCategoryStats(transactions);
  const flags: MisclassificationFlag[] = [];
  const seen = new Set<string>();

  for (const t of transactions) {
    if (!t.payee_normalized || !t.category_id) continue;

    let isPayeeMismatch = false;
    let payeeConsistency = 0;
    let suggestedCategoryId: string | null = null;

    const profile = payeeProfiles.get(t.payee_normalized);
    if (profile && profile.dominantCategoryId !== t.category_id) {
      isPayeeMismatch = true;
      payeeConsistency = profile.consistency;
      suggestedCategoryId = profile.dominantCategoryId;
    }

    let isAmountOutlier = false;
    let amountZScore: number | null = null;

    const catStats = categoryStats.get(t.category_id);
    if (catStats && catStats.stddevAmount > 0) {
      const z = Math.abs(Math.abs(t.amount) - catStats.medianAmount) / catStats.stddevAmount;
      if (z > 2) {
        isAmountOutlier = true;
        amountZScore = Math.round(z * 10) / 10;
      }
    }

    if (!isPayeeMismatch && !isAmountOutlier) continue;

    // Avoid duplicate flags
    if (seen.has(t.id)) continue;
    seen.add(t.id);

    // Confidence scoring
    let score = 0;
    if (isPayeeMismatch) {
      score += payeeConsistency * 0.6;
    }
    if (isAmountOutlier && amountZScore !== null) {
      score += Math.min(amountZScore / 4, 1.0) * 0.4;
    }
    const confidence = Math.min(score, 1.0);

    const reason: MisclassificationFlag["reason"] =
      isPayeeMismatch && isAmountOutlier
        ? "both"
        : isPayeeMismatch
          ? "payee_mismatch"
          : "amount_outlier";

    const currentCat = categoryMap.get(t.category_id);
    const suggestedCat = suggestedCategoryId ? categoryMap.get(suggestedCategoryId) : null;

    flags.push({
      transactionId: t.id,
      transactionDate: t.transaction_date,
      amount: t.amount,
      payee: t.payee ?? t.payee_normalized ?? "Unknown",
      currentCategoryId: t.category_id,
      currentCategoryName: currentCat?.name ?? null,
      suggestedCategoryId,
      suggestedCategoryName: suggestedCat?.name ?? null,
      reason,
      confidence,
      payeeConsistency,
      amountZScore,
    });
  }

  return flags.sort((a, b) => b.confidence - a.confidence);
}
