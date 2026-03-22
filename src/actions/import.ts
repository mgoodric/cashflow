"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePayee } from "@/lib/import/payee-normalizer";
import type {
  AccountType,
  ImportPayload,
  ImportResult,
} from "@/lib/types/database";

export async function executeImport(payload: ImportPayload): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const errors: string[] = [];
  let accountsCreated = 0;
  let categoriesCreated = 0;
  let transactionsImported = 0;
  let duplicatesSkipped = 0;

  // 1. Create import session
  const { data: session, error: sessionError } = await supabase
    .from("import_sessions")
    .insert({
      user_id: user.id,
      source: "qif",
      filename: "import.qif",
      status: "pending",
    })
    .select()
    .single();

  if (sessionError || !session) {
    return {
      sessionId: "",
      accountsCreated: 0,
      categoriesCreated: 0,
      transactionsImported: 0,
      duplicatesSkipped: 0,
      errors: [sessionError?.message ?? "Failed to create import session"],
    };
  }

  // 2. Create accounts — build mapping from QIF name to account ID
  const accountIdMap = new Map<string, string>();

  for (const mapping of payload.accountMappings) {
    if (mapping.action === "skip") continue;

    if (mapping.action === "match" && mapping.matchedAccountId) {
      accountIdMap.set(mapping.qifName, mapping.matchedAccountId);
      continue;
    }

    if (mapping.action === "create") {
      const { data: newAccount, error } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          name: mapping.qifName,
          account_type: (mapping.newAccountType ?? "checking") as AccountType,
          current_balance: 0,
          currency: "USD",
        })
        .select()
        .single();

      if (error) {
        errors.push(`Failed to create account "${mapping.qifName}": ${error.message}`);
        continue;
      }

      accountIdMap.set(mapping.qifName, newAccount.id);
      accountsCreated++;
    }
  }

  // 3. Create categories — build mapping from QIF path to category ID
  const categoryIdMap = new Map<string, string>();

  // Fetch existing categories for matching
  const { data: existingCategories } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (existingCategories) {
    for (const cat of existingCategories) {
      categoryIdMap.set(cat.name.toLowerCase(), cat.id);
    }
  }

  // Sort category mappings so parents come before children
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

      const { data: newCat, error } = await supabase
        .from("categories")
        .insert({
          user_id: user.id,
          name,
          parent_id: parentId,
        })
        .select()
        .single();

      if (error) {
        errors.push(`Failed to create category "${mapping.qifPath}": ${error.message}`);
        continue;
      }

      categoryIdMap.set(mapping.qifPath.toLowerCase(), newCat.id);
      categoriesCreated++;
    }
  }

  // 4. Insert transactions in batches
  const BATCH_SIZE = 500;
  const transactionsToInsert = [];

  for (const t of payload.transactions) {
    const accountId = accountIdMap.get(t.qifAccountName);
    if (!accountId) continue; // Account was skipped

    // Skip transfers if requested
    if (payload.skipTransfers && t.category.startsWith("[") && t.category.endsWith("]")) {
      continue;
    }

    const categoryId = t.category
      ? categoryIdMap.get(t.category.toLowerCase()) ?? null
      : null;

    const payeeNorm = t.payee ? normalizePayee(t.payee) : null;

    transactionsToInsert.push({
      user_id: user.id,
      account_id: accountId,
      import_session_id: session.id,
      category_id: categoryId,
      transaction_date: t.date,
      amount: t.amount,
      payee: t.payee,
      payee_normalized: payeeNorm,
      memo: t.memo,
      check_number: t.checkNumber,
      transaction_type: t.type,
      source: "qif",
      original_category: t.category || null,
    });
  }

  // Duplicate detection if enabled
  if (payload.skipDuplicates && transactionsToInsert.length > 0) {
    // Filter to only relevant accounts and date range
    const accountIds = [...new Set(transactionsToInsert.map((t) => t.account_id))];
    const dates = transactionsToInsert.map((t) => t.transaction_date).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    const { data: existing } = await supabase
      .from("transactions")
      .select("transaction_date, amount, payee_normalized, account_id")
      .in("account_id", accountIds)
      .gte("transaction_date", minDate)
      .lte("transaction_date", maxDate);

    if (existing) {
      const existingKeys = new Set(
        existing.map(
          (e: { transaction_date: string; amount: number; payee_normalized: string | null; account_id: string }) =>
            `${e.account_id}|${e.transaction_date}|${e.amount}|${e.payee_normalized}`
        )
      );

      const filtered = transactionsToInsert.filter((t) => {
        const key = `${t.account_id}|${t.transaction_date}|${t.amount}|${t.payee_normalized}`;
        if (existingKeys.has(key)) {
          duplicatesSkipped++;
          return false;
        }
        return true;
      });

      transactionsToInsert.length = 0;
      transactionsToInsert.push(...filtered);
    }
  }

  // Batch insert
  for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
    const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("transactions").insert(batch);
    if (error) {
      errors.push(`Batch insert error at offset ${i}: ${error.message}`);
    } else {
      transactionsImported += batch.length;
    }
  }

  // 5. Update import session
  await supabase
    .from("import_sessions")
    .update({
      transaction_count: transactionsImported,
      status: "completed",
    })
    .eq("id", session.id);

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("transactions").delete().eq("import_session_id", sessionId);

  await supabase
    .from("import_sessions")
    .update({ status: "rolled_back" })
    .eq("id", sessionId);

  revalidatePath("/import");
  revalidatePath("/insights");
}

export async function getImportSessions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("import_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}
