import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cashflowEvents, accounts, categories, eventOverrides } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toAccount, toEvent, toCategory, toEventOverride } from "@/lib/db/mappers";
import { EventForm } from "@/components/events/event-form";
import { EventOverrides } from "@/components/events/event-overrides";
import { updateEvent } from "@/actions/events";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [eventRows, accountRows, categoryRows, overrideRows] = await Promise.all([
    db.select().from(cashflowEvents).where(eq(cashflowEvents.id, id)).limit(1),
    db.select().from(accounts).where(eq(accounts.userId, user.id)).orderBy(accounts.name),
    db.select().from(categories).where(eq(categories.userId, user.id)).orderBy(categories.name),
    db.select().from(eventOverrides).where(eq(eventOverrides.eventId, id)).orderBy(eventOverrides.originalDate),
  ]);

  if (eventRows.length === 0) notFound();

  const event = toEvent(eventRows[0]);
  const boundAction = updateEvent.bind(null, id);

  return (
    <div className="space-y-6">
      <EventForm
        event={event}
        accounts={accountRows.map(toAccount)}
        categories={categoryRows.map(toCategory)}
        action={boundAction}
        title="Edit Cashflow Event"
      />

      {event.is_recurring && (
        <EventOverrides
          event={event}
          overrides={overrideRows.map(toEventOverride)}
        />
      )}
    </div>
  );
}
