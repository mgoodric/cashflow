"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cashflowEvents } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function createEvent(formData: FormData) {
  const user = await requireUser();

  const isRecurring = formData.get("is_recurring") === "true";
  const recurrenceRuleJson = formData.get("recurrence_rule") as string;
  const categoryId = formData.get("category_id") as string;

  await db.insert(cashflowEvents).values({
    userId: user.id,
    accountId: formData.get("account_id") as string,
    categoryId: categoryId || null,
    name: formData.get("name") as string,
    eventType: formData.get("event_type") as string,
    amount: String(parseFloat(formData.get("amount") as string)),
    eventDate: formData.get("event_date") as string,
    isRecurring,
    recurrenceRule: isRecurring && recurrenceRuleJson ? JSON.parse(recurrenceRuleJson) : null,
    notes: (formData.get("notes") as string) || null,
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/events");
}

export async function updateEvent(id: string, formData: FormData) {
  await requireUser();

  const isRecurring = formData.get("is_recurring") === "true";
  const recurrenceRuleJson = formData.get("recurrence_rule") as string;
  const categoryId = formData.get("category_id") as string;

  await db
    .update(cashflowEvents)
    .set({
      accountId: formData.get("account_id") as string,
      categoryId: categoryId || null,
      name: formData.get("name") as string,
      eventType: formData.get("event_type") as string,
      amount: String(parseFloat(formData.get("amount") as string)),
      eventDate: formData.get("event_date") as string,
      isRecurring,
      recurrenceRule: isRecurring && recurrenceRuleJson ? JSON.parse(recurrenceRuleJson) : null,
      notes: (formData.get("notes") as string) || null,
      updatedAt: new Date(),
    })
    .where(eq(cashflowEvents.id, id));

  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/events");
}

export async function deleteEvent(id: string) {
  await requireUser();

  await db.delete(cashflowEvents).where(eq(cashflowEvents.id, id));

  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/events");
}
