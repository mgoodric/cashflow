import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cashflowEvents, accounts, categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toAccount, toEvent, toCategory } from "@/lib/db/mappers";
import { EventForm } from "@/components/events/event-form";
import { updateEvent } from "@/actions/events";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [eventRows, accountRows, categoryRows] = await Promise.all([
    db.select().from(cashflowEvents).where(eq(cashflowEvents.id, id)).limit(1),
    db.select().from(accounts).where(eq(accounts.userId, user.id)).orderBy(accounts.name),
    db.select().from(categories).where(eq(categories.userId, user.id)).orderBy(categories.name),
  ]);

  if (eventRows.length === 0) notFound();

  const boundAction = updateEvent.bind(null, id);

  return (
    <div>
      <EventForm
        event={toEvent(eventRows[0])}
        accounts={accountRows.map(toAccount)}
        categories={categoryRows.map(toCategory)}
        action={boundAction}
        title="Edit Cashflow Event"
      />
    </div>
  );
}
