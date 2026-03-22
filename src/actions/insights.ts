"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Transaction, Category, RecurrencePattern } from "@/lib/types/database";
import { detectRecurringPatterns } from "@/lib/analysis/recurrence-detector";
import { detectMisclassifications } from "@/lib/analysis/category-auditor";

export async function getTransactions(): Promise<Transaction[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false });

  return (data as Transaction[]) ?? [];
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("categories").select("*").order("name");

  return (data as Category[]) ?? [];
}

export async function analyzeRecurringPatterns(): Promise<RecurrencePattern[]> {
  const transactions = await getTransactions();
  return detectRecurringPatterns(transactions);
}

export async function analyzeCategoryMisclassifications() {
  const [transactions, categories] = await Promise.all([
    getTransactions(),
    getCategories(),
  ]);
  return detectMisclassifications(transactions, categories);
}

export async function createEventFromPattern(pattern: RecurrencePattern) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!pattern.mostCommonAccountId) {
    throw new Error("Pattern has no associated account");
  }

  // Calculate next expected occurrence
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

  const { error } = await supabase.from("cashflow_events").insert({
    user_id: user.id,
    account_id: pattern.mostCommonAccountId,
    category_id: pattern.mostCommonCategory,
    name: pattern.payee,
    event_type: pattern.suggestedEventType,
    amount: pattern.medianAmount,
    event_date: eventDate,
    is_recurring: true,
    recurrence_rule: {
      frequency: pattern.frequency,
      interval: 1,
      day_of_month: pattern.suggestedDayOfMonth,
    },
  });

  if (error) throw new Error(error.message);

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/insights");
}

export async function fixCategoryMisclassifications(
  fixes: Array<{ transactionId: string; newCategoryId: string }>
): Promise<{ fixed: number; errors: string[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let fixed = 0;
  const errors: string[] = [];

  // Group by newCategoryId to batch updates
  const grouped = new Map<string, string[]>();
  for (const fix of fixes) {
    const ids = grouped.get(fix.newCategoryId) ?? [];
    ids.push(fix.transactionId);
    grouped.set(fix.newCategoryId, ids);
  }

  for (const [categoryId, transactionIds] of grouped) {
    const { error, count } = await supabase
      .from("transactions")
      .update({
        category_id: categoryId,
        is_flagged: false,
        flag_reason: null,
      })
      .in("id", transactionIds);

    if (error) {
      errors.push(`Failed to fix batch for category ${categoryId}: ${error.message}`);
    } else {
      fixed += count ?? transactionIds.length;
    }
  }

  revalidatePath("/insights");
  return { fixed, errors };
}

export async function dismissFlags(transactionIds: string[]): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("transactions")
    .update({ is_flagged: false, flag_reason: "dismissed" })
    .in("id", transactionIds);

  revalidatePath("/insights");
}
