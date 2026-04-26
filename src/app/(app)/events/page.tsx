import Link from "next/link";
import { db } from "@/lib/db";
import { cashflowEvents, accounts, categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toAccount } from "@/lib/db/mappers";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { CashflowEvent } from "@/lib/types/database";

export default async function EventsPage() {
  const user = await requireUser();

  const rows = await db
    .select({
      event: cashflowEvents,
      account: accounts,
      category: categories,
    })
    .from(cashflowEvents)
    .where(eq(cashflowEvents.userId, user.id))
    .leftJoin(accounts, eq(cashflowEvents.accountId, accounts.id))
    .leftJoin(categories, eq(cashflowEvents.categoryId, categories.id))
    .orderBy(cashflowEvents.eventDate);

  const events = rows.map(({ event: r, account: a, category: c }) => ({
    id: r.id,
    user_id: r.userId,
    account_id: r.accountId,
    category_id: r.categoryId,
    name: r.name,
    event_type: r.eventType as CashflowEvent["event_type"],
    amount: Number(r.amount),
    event_date: r.eventDate,
    is_recurring: r.isRecurring,
    recurrence_rule: r.recurrenceRule as CashflowEvent["recurrence_rule"],
    destination_account_id: r.destinationAccountId ?? null,
    loan_config: r.loanConfig as CashflowEvent["loan_config"],
    actual_amount: r.actualAmount ? Number(r.actualAmount) : null,
    occurred_date: r.occurredDate ?? null,
    notes: r.notes,
    is_active: r.isActive,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    account: a ? toAccount(a) : undefined,
    category_name: c?.name ?? null,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cashflow Events</h1>
          <p className="text-sm text-muted-foreground">Manage your income and expenses</p>
        </div>
        <Link href="/events/new">
          <Button>Add Event</Button>
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Add your first cashflow event to start forecasting."
          action={
            <Link href="/events/new">
              <Button>Add Your First Event</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} categoryName={event.category_name} />
          ))}
        </div>
      )}
    </div>
  );
}
