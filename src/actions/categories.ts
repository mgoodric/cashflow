"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { categories, cashflowEvents } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { toCategory, toEvent } from "@/lib/db/mappers";
import { computeBudgetStatuses } from "@/lib/budget";
import type { CategoryBudgetStatus } from "@/lib/budget";

export async function createCategory(formData: FormData) {
  const user = await requireUser();

  const parentId = formData.get("parent_id") as string;
  const budgetLimitStr = formData.get("budget_limit") as string;

  const categoryType = formData.get("category_type") as string;

  await db.insert(categories).values({
    userId: user.id,
    name: formData.get("name") as string,
    parentId: parentId || null,
    categoryType: categoryType || null,
    budgetLimit: budgetLimitStr ? String(parseFloat(budgetLimitStr)) : null,
  });

  revalidatePath("/categories");
  redirect("/categories");
}

export async function updateCategory(id: string, formData: FormData) {
  const user = await requireUser();

  const parentId = formData.get("parent_id") as string;
  const budgetLimitStr = formData.get("budget_limit") as string;

  const categoryType = formData.get("category_type") as string;

  await db
    .update(categories)
    .set({
      name: formData.get("name") as string,
      parentId: parentId || null,
      categoryType: categoryType || null,
      budgetLimit: budgetLimitStr ? String(parseFloat(budgetLimitStr)) : null,
    })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));

  revalidatePath("/categories");
  redirect("/categories");
}

export async function deleteCategory(id: string) {
  const user = await requireUser();

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));

  revalidatePath("/categories");
  redirect("/categories");
}

export async function getCategoryBudgetStatus(): Promise<CategoryBudgetStatus[]> {
  const user = await requireUser();

  const [categoryRows, eventRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.userId, user.id))
      .orderBy(categories.name),
    db
      .select()
      .from(cashflowEvents)
      .where(
        and(
          eq(cashflowEvents.userId, user.id),
          eq(cashflowEvents.isActive, true)
        )
      ),
  ]);

  const cats = categoryRows.map(toCategory);
  const evts = eventRows.map(toEvent);

  return computeBudgetStatuses(cats, evts);
}
