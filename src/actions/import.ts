"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { accounts, categories, transactions, importSessions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { normalizePayee } from "@/lib/import/payee-normalizer";
import type {
  AccountType,
  ImportPayload,
  ImportResult,
} from "@/lib/types/database";

export async function executeImport(payload: ImportPayload): Promise<ImportResult> {
  const user = await requireUser();

  const errors: string[] = [];
  let accountsCreated = 0;
  let categoriesCreated = 0;
  let transactionsImported = 0;
  let duplicatesSkipped = 0;

  const [session] = await db
    .insert(importSessions)
    .values({
      userId: user.id,
      source: "qif",
      filename: "import.qif",
      status: "pending",
    })
    .returning();

  if (!session) {
    return {
      sessionId: "",
      accountsCreated: 0,
      categoriesCreated: 0,
      transactionsImported: 0,
      duplicatesSkipped: 0,
      errors: ["Failed to create import session"],
    };
  }

  const accountIdMap = new Map<string, string>();

  for (const mapping of payload.accountMappings) {
    if (mapping.action === "skip") continue;

    if (mapping.action === "match" && mapping.matchedAccountId) {
      accountIdMap.set(mapping.qifName, mapping.matchedAccountId);
      continue;
    }

    if (mapping.action === "create") {
      const [newAccount] = await db
        .insert(accounts)
        .values({
          userId: user.id,
          name: mapping.qifName,
          accountType: (mapping.newAccountType ?? "checking") as AccountType,
          currentBalance: "0",
          currency: "USD",
        })
        .returning();

      if (newAccount) {
        accountIdMap.set(mapping.qifName, newAccount.id);
        accountsCreated++;
      } else {
        errors.push(`Failed to create account "${mapping.qifName}"`);
      }
    }
  }

  const categoryIdMap = new Map<string, string>();

  const existingCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(categories.name);

  for (const cat of existingCategories) {
    categoryIdMap.set(cat.name.toLowerCase(), cat.id);
  }

  const sortedCategories = [...payload.categoryMappings].sort(
    (a, b) => a.qifPath.split(":").length - b.qifPath.split(":").length
  );

  for (const mapping of sortedCategories) {
    if (mapping.action === "skip") continue;

    if (mapping.action === "match" && mapping.matchedCategoryId) {
      categoryIdMap.set(mapping.qifPath.toLowerCase(), mapping.matchedCategoryId);
      continue;
    }

    if (mapping.action === "create") {
      const parts = mapping.qifPath.split(":");
      const name = parts[parts.length - 1];
      const parentPath = parts.length > 1 ? parts.slice(0, -1).join(":") : null;
      const parentId = parentPath ? categoryIdMap.get(parentPath.toLowerCase()) ?? null : null;

      const [newCat] = await db
        .insert(categories)
        .values({
          userId: user.id,
          name,
          parentId,
        })
        .returning();

      if (newCat) {
        categoryIdMap.set(mapping.qifPath.toLowerCase(), newCat.id);
        categoriesCreated++;
      } else {
        errors.push(`Failed to create category "${mapping.qifPath}"`);
      }
    }
  }

  const BATCH_SIZE = 500;
  const transactionsToInsert = [];

  for (const t of payload.transactions) {
    const accountId = accountIdMap.get(t.qifAccountName);
    if (!accountId) continue;

    if (payload.skipTransfers && t.category.startsWith("[") && t.category.endsWith("]")) {
      continue;
    }

    const categoryId = t.category
      ? categoryIdMap.get(t.category.toLowerCase()) ?? null
      : null;

    const payeeNorm = t.payee ? normalizePayee(t.payee) : null;

    transactionsToInsert.push({
      userId: user.id,
      accountId,
      importSessionId: session.id,
      categoryId,
      transactionDate: t.date,
      amount: String(t.amount),
      payee: t.payee,
      payeeNormalized: payeeNorm,
      memo: t.memo,
      checkNumber: t.checkNumber,
      transactionType: t.type,
      source: "qif" as const,
      originalCategory: t.category || null,
    });
  }

  if (payload.skipDuplicates && transactionsToInsert.length > 0) {
    const accountIds = [...new Set(transactionsToInsert.map((t) => t.accountId))];
    const dates = transactionsToInsert.map((t) => t.transactionDate).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    const existing = await db
      .select({
        transactionDate: transactions.transactionDate,
        amount: transactions.amount,
        payeeNormalized: transactions.payeeNormalized,
        accountId: transactions.accountId,
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.accountId, accountIds),
          gte(transactions.transactionDate, minDate),
          lte(transactions.transactionDate, maxDate)
        )
      );

    const existingKeys = new Set(
      existing.map(
        (e) => `${e.accountId}|${e.transactionDate}|${e.amount}|${e.payeeNormalized}`
      )
    );

    const filtered = transactionsToInsert.filter((t) => {
      const key = `${t.accountId}|${t.transactionDate}|${t.amount}|${t.payeeNormalized}`;
      if (existingKeys.has(key)) {
        duplicatesSkipped++;
        return false;
      }
      return true;
    });

    transactionsToInsert.length = 0;
    transactionsToInsert.push(...filtered);
  }

  for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
    const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
    try {
      await db.insert(transactions).values(batch);
      transactionsImported += batch.length;
    } catch (err) {
      errors.push(
        `Batch insert error at offset ${i}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  await db
    .update(importSessions)
    .set({
      transactionCount: transactionsImported,
      status: "completed",
    })
    .where(eq(importSessions.id, session.id));

  revalidatePath("/import");
  revalidatePath("/insights");
  revalidatePath("/dashboard");

  return {
    sessionId: session.id,
    accountsCreated,
    categoriesCreated,
    transactionsImported,
    duplicatesSkipped,
    errors,
  };
}

export async function rollbackImport(sessionId: string): Promise<void> {
  await requireUser();

  await db
    .delete(transactions)
    .where(eq(transactions.importSessionId, sessionId));

  await db
    .update(importSessions)
    .set({ status: "rolled_back" })
    .where(eq(importSessions.id, sessionId));

  revalidatePath("/import");
  revalidatePath("/insights");
}

export async function getImportSessions() {
  await requireUser();

  const rows = await db
    .select()
    .from(importSessions)
    .orderBy(importSessions.createdAt);

  return rows;
}
