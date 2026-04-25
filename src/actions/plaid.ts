"use server";

import { revalidatePath } from "next/cache";
import { CountryCode, Products } from "plaid";
import { db } from "@/lib/db";
import { plaidItems, transactions, accounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { plaidClient, isPlaidConfigured } from "@/lib/plaid";
import { toPlaidItem } from "@/lib/db/mappers";
import { eq, and } from "drizzle-orm";
import type { PlaidItem, AccountType } from "@/lib/types/database";

export async function getPlaidConfigStatus(): Promise<boolean> {
  return isPlaidConfigured();
}

export async function createLinkToken(): Promise<{ link_token: string } | { error: string }> {
  const user = await requireUser();
  const client = plaidClient();

  if (!client) {
    return { error: "Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET environment variables." };
  }

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Cashflow Manager",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return { link_token: response.data.link_token };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create link token";
    return { error: message };
  }
}

export async function exchangePublicToken(
  publicToken: string,
  institutionId: string | null,
  institutionName: string | null,
): Promise<{ item: PlaidItem } | { error: string }> {
  const user = await requireUser();
  const client = plaidClient();

  if (!client) {
    return { error: "Plaid is not configured." };
  }

  try {
    const response = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const { access_token, item_id } = response.data;

    const [row] = await db
      .insert(plaidItems)
      .values({
        userId: user.id,
        itemId: item_id,
        accessToken: access_token,
        institutionId: institutionId,
        institutionName: institutionName,
      })
      .returning();

    revalidatePath("/settings");
    return { item: toPlaidItem(row) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to exchange public token";
    return { error: message };
  }
}

function mapPlaidAccountType(plaidType: string, plaidSubtype: string | null): AccountType {
  switch (plaidType) {
    case "depository":
      if (plaidSubtype === "savings" || plaidSubtype === "money market" || plaidSubtype === "cd") {
        return "savings";
      }
      return "checking";
    case "credit":
      return "credit";
    case "loan":
    case "mortgage":
      return "loan";
    case "investment":
    case "brokerage":
      return "investment";
    default:
      return "checking";
  }
}

export async function syncTransactions(
  plaidItemId: string,
): Promise<{ added: number; modified: number; removed: number } | { error: string }> {
  const user = await requireUser();
  const client = plaidClient();

  if (!client) {
    return { error: "Plaid is not configured." };
  }

  // Fetch the plaid item and verify ownership
  const items = await db
    .select()
    .from(plaidItems)
    .where(and(eq(plaidItems.id, plaidItemId), eq(plaidItems.userId, user.id)))
    .limit(1);

  if (items.length === 0) {
    return { error: "Plaid item not found." };
  }

  const item = items[0];

  // Get or create account mapping — if none linked, we need to create one per Plaid account
  // First sync: fetch Plaid accounts and ensure we have local accounts
  try {
    const plaidAccountsResponse = await client.accountsGet({
      access_token: item.accessToken,
    });

    // Build a map of plaid_account_id -> local account_id
    const accountMap = new Map<string, string>();

    for (const plaidAccount of plaidAccountsResponse.data.accounts) {
      // Check if we already have a local account linked to this item
      // Use a naming convention to find existing matches
      const existingAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, user.id));

      // Look for an account with matching name from this institution
      const displayName = plaidAccount.official_name || plaidAccount.name;
      const matchingAccount = existingAccounts.find(
        (a) => a.name === `${item.institutionName} - ${displayName}`,
      );

      if (matchingAccount) {
        accountMap.set(plaidAccount.account_id, matchingAccount.id);
      } else {
        // Create a new account
        const accountType = mapPlaidAccountType(
          plaidAccount.type,
          plaidAccount.subtype,
        );
        const [newAccount] = await db
          .insert(accounts)
          .values({
            userId: user.id,
            name: `${item.institutionName || "Bank"} - ${displayName}`,
            accountType,
            currentBalance: String(plaidAccount.balances.current ?? 0),
          })
          .returning();

        accountMap.set(plaidAccount.account_id, newAccount.id);
      }

      // Update the balance on the local account
      const localAccountId = accountMap.get(plaidAccount.account_id);
      if (localAccountId && plaidAccount.balances.current != null) {
        await db
          .update(accounts)
          .set({
            currentBalance: String(plaidAccount.balances.current),
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, localAccountId));
      }
    }

    // Now sync transactions using cursor-based pagination
    let cursor = item.cursor ?? undefined;
    let added = 0;
    let modified = 0;
    let removed = 0;
    let hasMore = true;

    while (hasMore) {
      const syncResponse = await client.transactionsSync({
        access_token: item.accessToken,
        cursor,
      });

      const data = syncResponse.data;

      // Process added transactions
      for (const txn of data.added) {
        const localAccountId = accountMap.get(txn.account_id);
        if (!localAccountId) continue;

        const amount = txn.amount;
        // Plaid: positive = money leaving (expense), negative = money coming in (income)
        const transactionType = amount > 0 ? "expense" : "income";

        await db.insert(transactions).values({
          userId: user.id,
          accountId: localAccountId,
          transactionDate: txn.date,
          amount: String(Math.abs(amount)),
          payee: txn.merchant_name || txn.name || null,
          payeeNormalized: (txn.merchant_name || txn.name || "")
            .toLowerCase()
            .trim() || null,
          memo: txn.name || null,
          transactionType,
          source: "plaid",
          isCleared: !txn.pending,
          originalCategory: txn.personal_finance_category?.primary ?? null,
        });
        added++;
      }

      // Modified/removed tracking — we count but don't update rows yet
      // since we don't store plaid_transaction_id. Future enhancement.
      modified += data.modified.length;
      removed += data.removed.length;

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    // Update the cursor on the plaid item
    await db
      .update(plaidItems)
      .set({ cursor, updatedAt: new Date() })
      .where(eq(plaidItems.id, plaidItemId));

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { added, modified, removed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync transactions";
    return { error: message };
  }
}

export async function getPlaidItems(): Promise<PlaidItem[]> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.userId, user.id))
    .orderBy(plaidItems.createdAt);

  return rows.map(toPlaidItem);
}

export async function disconnectPlaidItem(
  plaidItemId: string,
): Promise<{ success: boolean } | { error: string }> {
  const user = await requireUser();
  const client = plaidClient();

  // Verify ownership
  const items = await db
    .select()
    .from(plaidItems)
    .where(and(eq(plaidItems.id, plaidItemId), eq(plaidItems.userId, user.id)))
    .limit(1);

  if (items.length === 0) {
    return { error: "Plaid item not found." };
  }

  // Remove the item from Plaid if client is available
  if (client) {
    try {
      await client.itemRemove({ access_token: items[0].accessToken });
    } catch {
      // If Plaid removal fails, still remove locally
    }
  }

  // Mark as disconnected rather than deleting (preserves history)
  await db
    .update(plaidItems)
    .set({ status: "disconnected", updatedAt: new Date() })
    .where(eq(plaidItems.id, plaidItemId));

  revalidatePath("/settings");
  return { success: true };
}
