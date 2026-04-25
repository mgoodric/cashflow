import { db } from "@/lib/db";
import { accounts, categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toAccount, toCategory } from "@/lib/db/mappers";
import { EventForm } from "@/components/events/event-form";
import { createEvent } from "@/actions/events";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const [accountRows, categoryRows] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, user.id)).orderBy(accounts.name),
    db.select().from(categories).where(eq(categories.userId, user.id)).orderBy(categories.name),
  ]);

  const validEventTypes = ["income", "expense"] as const;
  const validFrequencies = ["monthly", "quarterly", "yearly"] as const;

  const prefill = {
    name: params.name,
    amount: params.amount ? parseFloat(params.amount) : undefined,
    event_type: validEventTypes.find((t) => t === params.event_type),
    is_recurring: params.is_recurring === "true",
    frequency: validFrequencies.find((f) => f === params.frequency),
    day_of_month: params.day_of_month ? parseInt(params.day_of_month, 10) : undefined,
    account_id: params.account_id,
  };

  return (
    <div>
      <EventForm
        accounts={accountRows.map(toAccount)}
        categories={categoryRows.map(toCategory)}
        action={createEvent}
        title="Create Cashflow Event"
        prefill={prefill}
      />
    </div>
  );
}
