"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function createAccount(formData: FormData) {
  const user = await requireUser();

  await db.insert(accounts).values({
    userId: user.id,
    name: formData.get("name") as string,
    accountType: formData.get("account_type") as string,
    currentBalance: String(parseFloat(formData.get("current_balance") as string) || 0),
    currency: (formData.get("currency") as string) || "USD",
  });

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function updateAccount(id: string, formData: FormData) {
  await requireUser();

  await db
    .update(accounts)
    .set({
      name: formData.get("name") as string,
      accountType: formData.get("account_type") as string,
      currentBalance: String(parseFloat(formData.get("current_balance") as string) || 0),
      currency: (formData.get("currency") as string) || "USD",
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, id));

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function deleteAccount(id: string) {
  await requireUser();

  await db.delete(accounts).where(eq(accounts.id, id));

  revalidatePath("/accounts");
  redirect("/accounts");
}
