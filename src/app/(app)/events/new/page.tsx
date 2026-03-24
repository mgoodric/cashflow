import { db } from "@/lib/db";
import { accounts, categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toAccount, toCategory } from "@/lib/db/mappers";
import { EventForm } from "@/components/events/event-form";
import { createEvent } from "@/actions/events";

export default async function NewEventPage() {
  const user = await requireUser();

  const [accountRows, categoryRows] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, user.id)).orderBy(accounts.name),
    db.select().from(categories).where(eq(categories.userId, user.id)).orderBy(categories.name),
  ]);

  return (
    <div>
      <EventForm
        accounts={accountRows.map(toAccount)}
        categories={categoryRows.map(toCategory)}
        action={createEvent}
        title="Create Cashflow Event"
      />
    </div>
  );
}
