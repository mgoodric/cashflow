import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { CashflowEvent } from "@/lib/types/database";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("cashflow_events")
    .select("*, account:accounts(*)")
    .order("event_date", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cashflow Events</h1>
          <p className="text-sm text-gray-500">Manage your income and expenses</p>
        </div>
        <Link href="/events/new">
          <Button>Add Event</Button>
        </Link>
      </div>

      {!events || events.length === 0 ? (
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
          {(events as CashflowEvent[]).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
