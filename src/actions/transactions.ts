"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { transactions, accounts, categories } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { toTransaction, toAccount, toCategory } from "@/lib/db/mappers";
import { normalizePayee } from "@/lib/import/payee-normalizer";
import { eq, desc } from "drizzle-orm";
import type { Transaction, Account, Category } from "@/lib/types/database";

export async function getTransactionsWithDetails(): Promise<{
  transactions: (Transaction & { account_name: string | null; category_name: string | null })[];
  accounts: Account[];
  categories: Category[];
}> {
  const user = await requireUser();

  const [txnRows, accountRows, categoryRows] = await Promise.all([
    db
      .select({
        transaction: transactions,
        accountName: accounts.name,
        categoryName: categories.name,
      })
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .orderBy(desc(transactions.transactionDate)),
    db.select().from(accounts).where(eq(accounts.userId, user.id)).orderBy(accounts.name),
    db.select().from(categories).where(eq(categories.userId, user.id)).orderBy(categories.name),
  ]);

  return {
    transactions: txnRows.map(({ transaction: r, accountName, categoryName }) => ({
      ...toTransaction(r),
      account_name: accountName,
      category_name: categoryName,
    })),
    accounts: accountRows.map(toAccount),
    categories: categoryRows.map(toCategory),
  };
}

export async function updateTransaction(
  id: string,
  data: {
    transactionDate?: string;
    payee?: string;
    amount?: number;
    transactionType?: "income" | "expense";
    categoryId?: string | null;
    accountId?: string;
    memo?: string | null;
    isCleared?: boolean;
  }
): Promise<void> {
  await requireUser();

  await db
    .update(transactions)
    .set({
      transactionDate: data.transactionDate,
      payee: data.payee,
      payeeNormalized: data.payee ? normalizePayee(data.payee) : undefined,
      amount: data.amount != null ? String(data.amount) : undefined,
      transactionType: data.transactionType,
      categoryId: data.categoryId !== undefined ? (data.categoryId || null) : undefined,
      accountId: data.accountId,
      memo: data.memo !== undefined ? data.memo : undefined,
      isCleared: data.isCleared,
    })
    .where(eq(transactions.id, id));

  revalidatePath("/transactions");
}

export async function deleteTransaction(id: string): Promise<void> {
  await requireUser();
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/transactions");
}

export async function confirmProjectedOccurrence(data: {
  eventId: string;
  date: string;
  name: string;
  amount: number;
  type: "income" | "expense";
  accountId: string;
  categoryId?: string | null;
}): Promise<void> {
  const user = await requireUser();

  await db.insert(transactions).values({
    userId: user.id,
    accountId: data.accountId,
    eventId: data.eventId,
    categoryId: data.categoryId || null,
    transactionDate: data.date,
    amount: String(data.amount),
    payee: data.name,
    payeeNormalized: normalizePayee(data.name),
    transactionType: data.type,
    source: "event",
    isCleared: true,
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
