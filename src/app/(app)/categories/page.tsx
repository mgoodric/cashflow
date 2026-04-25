import { db } from "@/lib/db";
import { categories, cashflowEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toCategory, toEvent } from "@/lib/db/mappers";
import { computeBudgetStatuses } from "@/lib/budget";
import { CategoryTree } from "@/components/categories/category-tree";

export default async function CategoriesPage() {
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
  const budgetStatuses = computeBudgetStatuses(cats, evts);

  return <CategoryTree categories={cats} budgetStatuses={budgetStatuses} />;
}
