"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { scenarios, scenarioEvents, cashflowEvents, accounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { toScenario, toScenarioEvent, toEvent, toAccount } from "@/lib/db/mappers";
import { eq, and } from "drizzle-orm";
import type { Scenario, ScenarioEvent, CashflowEvent, Account } from "@/lib/types/database";

export async function getScenarios(): Promise<Scenario[]> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.userId, user.id))
    .orderBy(scenarios.updatedAt);

  return rows.map(toScenario);
}

export async function getScenarioWithEvents(scenarioId: string): Promise<{
  scenario: Scenario;
  events: ScenarioEvent[];
  baseEvents: CashflowEvent[];
  accounts: Account[];
}> {
  const user = await requireUser();

  const [scenarioRows, eventRows, baseEventRows, accountRows] = await Promise.all([
    db.select().from(scenarios).where(and(eq(scenarios.id, scenarioId), eq(scenarios.userId, user.id))).limit(1),
    db.select().from(scenarioEvents).where(eq(scenarioEvents.scenarioId, scenarioId)).orderBy(scenarioEvents.createdAt),
    db.select().from(cashflowEvents).where(and(eq(cashflowEvents.userId, user.id), eq(cashflowEvents.isActive, true))),
    db.select().from(accounts).where(and(eq(accounts.userId, user.id), eq(accounts.isActive, true))).orderBy(accounts.name),
  ]);

  if (scenarioRows.length === 0) throw new Error("Scenario not found");

  return {
    scenario: toScenario(scenarioRows[0]),
    events: eventRows.map(toScenarioEvent),
    baseEvents: baseEventRows.map(toEvent),
    accounts: accountRows.map(toAccount),
  };
}

export async function createScenario(data: {
  name: string;
  description?: string;
}): Promise<Scenario> {
  const user = await requireUser();

  const [row] = await db
    .insert(scenarios)
    .values({
      userId: user.id,
      name: data.name,
      description: data.description ?? null,
    })
    .returning();

  revalidatePath("/scenarios");
  revalidatePath("/dashboard");
  return toScenario(row);
}

export async function updateScenario(
  id: string,
  data: { name?: string; description?: string | null; balanceAdjustments?: Record<string, number> | null }
): Promise<void> {
  await requireUser();

  await db
    .update(scenarios)
    .set({
      name: data.name,
      description: data.description !== undefined ? data.description : undefined,
      balanceAdjustments: data.balanceAdjustments !== undefined ? data.balanceAdjustments : undefined,
      updatedAt: new Date(),
    })
    .where(eq(scenarios.id, id));

  revalidatePath("/scenarios");
  revalidatePath("/dashboard");
}

export async function deleteScenario(id: string): Promise<void> {
  await requireUser();

  await db.delete(scenarios).where(eq(scenarios.id, id));

  revalidatePath("/scenarios");
  revalidatePath("/dashboard");
}

export async function addScenarioEvent(data: {
  scenarioId: string;
  eventId?: string;
  action: "exclude" | "modify" | "add";
  name?: string;
  eventType?: string;
  amount?: number;
  eventDate?: string;
  accountId?: string;
  isRecurring?: boolean;
  recurrenceRule?: object;
  notes?: string;
}): Promise<ScenarioEvent> {
  await requireUser();

  const [row] = await db
    .insert(scenarioEvents)
    .values({
      scenarioId: data.scenarioId,
      eventId: data.eventId ?? null,
      action: data.action,
      name: data.name ?? null,
      eventType: data.eventType ?? null,
      amount: data.amount != null ? String(data.amount) : null,
      eventDate: data.eventDate ?? null,
      accountId: data.accountId ?? null,
      isRecurring: data.isRecurring ?? null,
      recurrenceRule: data.recurrenceRule ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  await db.update(scenarios).set({ updatedAt: new Date() }).where(eq(scenarios.id, data.scenarioId));

  revalidatePath("/scenarios");
  revalidatePath("/dashboard");
  return toScenarioEvent(row);
}

export async function updateScenarioEvent(
  id: string,
  data: { amount?: number | null; name?: string | null; notes?: string | null }
): Promise<void> {
  await requireUser();

  await db
    .update(scenarioEvents)
    .set({
      amount: data.amount !== undefined ? (data.amount != null ? String(data.amount) : null) : undefined,
      name: data.name !== undefined ? data.name : undefined,
      notes: data.notes !== undefined ? data.notes : undefined,
    })
    .where(eq(scenarioEvents.id, id));

  revalidatePath("/scenarios");
  revalidatePath("/dashboard");
}

export async function removeScenarioEvent(id: string): Promise<void> {
  await requireUser();

  await db.delete(scenarioEvents).where(eq(scenarioEvents.id, id));

  revalidatePath("/scenarios");
  revalidatePath("/dashboard");
}
