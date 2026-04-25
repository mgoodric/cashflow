"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { transactions, categories, cashflowEvents } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";
import { toTransaction, toCategory, toEvent } from "@/lib/db/mappers";
import type { Transaction, Category, CashflowEvent, RecurrencePattern } from "@/lib/types/database";
import { detectRecurringPatterns } from "@/lib/analysis/recurrence-detector";
import { detectMisclassifications } from "@/lib/analysis/category-auditor";

export async function getTransactions(): Promise<Transaction[]> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, user.id))
    .orderBy(transactions.transactionDate);

  return rows.map(toTransaction);
}

export async function getCategories(): Promise<Category[]> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(categories.name);

  return rows.map(toCategory);
}

export async function analyzeRecurringPatterns(): Promise<RecurrencePattern[]> {
  const txns = await getTransactions();
  return detectRecurringPatterns(txns);
}

export async function analyzeCategoryMisclassifications() {
  const [txns, cats] = await Promise.all([
    getTransactions(),
    getCategories(),
  ]);
  return detectMisclassifications(txns, cats);
}

export async function createEventFromPattern(pattern: RecurrencePattern) {
  const user = await requireUser();

  if (!pattern.mostCommonAccountId) {
    throw new Error("Pattern has no associated account");
  }

  const lastDate = new Date(pattern.lastOccurrence + "T00:00:00Z");
  let nextDate: Date;

  switch (pattern.frequency) {
    case "monthly": {
      const m = lastDate.getUTCMonth() + 1;
      const year = lastDate.getUTCFullYear() + Math.floor(m / 12);
      const month = m % 12;
      const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const day = Math.min(pattern.suggestedDayOfMonth, maxDay);
      nextDate = new Date(Date.UTC(year, month, day));
      break;
    }
    case "quarterly": {
      const qm = lastDate.getUTCMonth() + 3;
      const qYear = lastDate.getUTCFullYear() + Math.floor(qm / 12);
      const qMonth = qm % 12;
      const qMaxDay = new Date(Date.UTC(qYear, qMonth + 1, 0)).getUTCDate();
      const qDay = Math.min(pattern.suggestedDayOfMonth, qMaxDay);
      nextDate = new Date(Date.UTC(qYear, qMonth, qDay));
      break;
    }
    case "yearly": {
      nextDate = new Date(
        Date.UTC(
          lastDate.getUTCFullYear() + 1,
          lastDate.getUTCMonth(),
          lastDate.getUTCDate()
        )
      );
      break;
    }
  }

  const eventDate = nextDate.toISOString().split("T")[0];

  await db.insert(cashflowEvents).values({
    userId: user.id,
    accountId: pattern.mostCommonAccountId,
    categoryId: pattern.mostCommonCategory,
    name: pattern.payee,
    eventType: pattern.suggestedEventType,
    amount: String(pattern.medianAmount),
    eventDate,
    isRecurring: true,
    recurrenceRule: {
      frequency: pattern.frequency,
      interval: 1,
      day_of_month: pattern.suggestedDayOfMonth,
    },
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/insights");
}

export async function fixCategoryMisclassifications(
  fixes: Array<{ transactionId: string; newCategoryId: string }>
): Promise<{ fixed: number; errors: string[] }> {
  await requireUser();

  let fixed = 0;
  const errors: string[] = [];

  const grouped = new Map<string, string[]>();
  for (const fix of fixes) {
    const ids = grouped.get(fix.newCategoryId) ?? [];
    ids.push(fix.transactionId);
    grouped.set(fix.newCategoryId, ids);
  }

  for (const [categoryId, transactionIds] of grouped) {
    try {
      await db
        .update(transactions)
        .set({
          categoryId,
          isFlagged: false,
          flagReason: null,
        })
        .where(inArray(transactions.id, transactionIds));

      fixed += transactionIds.length;
    } catch (err) {
      errors.push(
        `Failed to fix batch for category ${categoryId}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  revalidatePath("/insights");
  return { fixed, errors };
}

export async function dismissFlags(transactionIds: string[]): Promise<void> {
  await requireUser();

  await db
    .update(transactions)
    .set({ isFlagged: false, flagReason: "dismissed" })
    .where(inArray(transactions.id, transactionIds));

  revalidatePath("/insights");
}

export async function getExistingEvents(): Promise<CashflowEvent[]> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(cashflowEvents)
    .where(eq(cashflowEvents.userId, user.id))
    .orderBy(cashflowEvents.name);

  return rows.map(toEvent);
}
