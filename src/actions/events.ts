"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cashflowEvents, eventOverrides } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { toEventOverride } from "@/lib/db/mappers";
import { eq, and } from "drizzle-orm";
import type { EventOverride } from "@/lib/types/database";

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

// --- Event Overrides ---

export async function getOverridesForEvent(eventId: string): Promise<EventOverride[]> {
  await requireUser();

  const rows = await db
    .select()
    .from(eventOverrides)
    .where(eq(eventOverrides.eventId, eventId))
    .orderBy(eventOverrides.originalDate);

  return rows.map(toEventOverride);
}

export async function createOverride(data: {
  eventId: string;
  originalDate: string;
  overrideAmount?: number;
  overrideDate?: string;
  isSkipped?: boolean;
  notes?: string;
}): Promise<EventOverride> {
  await requireUser();

  const [row] = await db
    .insert(eventOverrides)
    .values({
      eventId: data.eventId,
      originalDate: data.originalDate,
      overrideAmount: data.overrideAmount != null ? String(data.overrideAmount) : null,
      overrideDate: data.overrideDate ?? null,
      isSkipped: data.isSkipped ?? false,
      notes: data.notes ?? null,
    })
    .returning();

  revalidatePath("/events");
  revalidatePath("/dashboard");
  return toEventOverride(row);
}

export async function updateOverride(
  id: string,
  data: {
    overrideAmount?: number | null;
    overrideDate?: string | null;
    isSkipped?: boolean;
    notes?: string | null;
  }
): Promise<void> {
  await requireUser();

  await db
    .update(eventOverrides)
    .set({
      overrideAmount: data.overrideAmount !== undefined
        ? (data.overrideAmount != null ? String(data.overrideAmount) : null)
        : undefined,
      overrideDate: data.overrideDate !== undefined ? data.overrideDate : undefined,
      isSkipped: data.isSkipped,
      notes: data.notes !== undefined ? data.notes : undefined,
    })
    .where(eq(eventOverrides.id, id));

  revalidatePath("/events");
  revalidatePath("/dashboard");
}

export async function deleteOverride(id: string): Promise<void> {
  await requireUser();

  await db.delete(eventOverrides).where(eq(eventOverrides.id, id));

  revalidatePath("/events");
  revalidatePath("/dashboard");
}

export async function changeAmountForward(data: {
  eventId: string;
  effectiveDate: string;
  newAmount: number;
}): Promise<void> {
  const user = await requireUser();

  const [event] = await db
    .select()
    .from(cashflowEvents)
    .where(and(eq(cashflowEvents.id, data.eventId), eq(cashflowEvents.userId, user.id)));

  if (!event) throw new Error("Event not found");
  if (!event.isRecurring || !event.recurrenceRule) {
    throw new Error("Can only change amount forward on recurring events");
  }

  const rule = event.recurrenceRule as { frequency: string; interval: number; day_of_month?: number; end_date?: string };

  // Set end_date on the original event to the day before the effective date
  const effectiveDateObj = new Date(data.effectiveDate + "T00:00:00Z");
  const dayBefore = new Date(effectiveDateObj);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const endDateStr = dayBefore.toISOString().split("T")[0];

  await db
    .update(cashflowEvents)
    .set({
      recurrenceRule: { ...rule, end_date: endDateStr },
      updatedAt: new Date(),
    })
    .where(eq(cashflowEvents.id, data.eventId));

  // Create new event with updated amount, starting from effective date
  await db.insert(cashflowEvents).values({
    userId: user.id,
    accountId: event.accountId,
    categoryId: event.categoryId,
    name: event.name,
    eventType: event.eventType,
    amount: String(data.newAmount),
    eventDate: data.effectiveDate,
    isRecurring: true,
    recurrenceRule: {
      frequency: rule.frequency,
      interval: rule.interval,
      day_of_month: rule.day_of_month,
      end_date: rule.end_date,
    },
    notes: event.notes,
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
}
