"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cashflowEvents, eventTemplates } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { toEventTemplate } from "@/lib/db/mappers";
import type { EventTemplate } from "@/lib/types/database";

export async function getTemplates(): Promise<EventTemplate[]> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(eventTemplates)
    .where(eq(eventTemplates.userId, user.id))
    .orderBy(eventTemplates.name);

  return rows.map(toEventTemplate);
}

export async function createTemplate(formData: FormData) {
  const user = await requireUser();

  const isRecurring = formData.get("is_recurring") === "true";
  const recurrenceRuleJson = formData.get("recurrence_rule") as string;
  const categoryId = formData.get("category_id") as string;
  const accountId = formData.get("account_id") as string;

  await db.insert(eventTemplates).values({
    userId: user.id,
    name: formData.get("template_name") as string,
    eventType: formData.get("event_type") as string,
    amount: String(parseFloat(formData.get("amount") as string)),
    accountId: accountId || null,
    categoryId: categoryId || null,
    isRecurring,
    recurrenceRule: isRecurring && recurrenceRuleJson ? JSON.parse(recurrenceRuleJson) : null,
    notes: (formData.get("notes") as string) || null,
  });

  revalidatePath("/events/new");
}

export async function deleteTemplate(id: string) {
  const user = await requireUser();

  await db
    .delete(eventTemplates)
    .where(and(eq(eventTemplates.id, id), eq(eventTemplates.userId, user.id)));

  revalidatePath("/events/new");
}

export async function createEventFromTemplate(templateId: string, eventDate: string) {
  const user = await requireUser();

  const [template] = await db
    .select()
    .from(eventTemplates)
    .where(and(eq(eventTemplates.id, templateId), eq(eventTemplates.userId, user.id)));

  if (!template) {
    throw new Error("Template not found");
  }

  await db.insert(cashflowEvents).values({
    userId: user.id,
    accountId: template.accountId as string,
    categoryId: template.categoryId,
    name: template.name,
    eventType: template.eventType,
    amount: template.amount,
    eventDate,
    isRecurring: template.isRecurring,
    recurrenceRule: template.recurrenceRule,
    notes: template.notes,
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/events");
}
