import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/events/event-form";
import { updateEvent } from "@/actions/events";
import type { Account, CashflowEvent } from "@/lib/types/database";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [eventResult, accountsResult] = await Promise.all([
    supabase.from("cashflow_events").select("*").eq("id", id).single(),
    supabase.from("accounts").select("*").order("name"),
  ]);

  if (!eventResult.data) notFound();

  const boundAction = updateEvent.bind(null, id);

  return (
    <div>
      <EventForm
        event={eventResult.data as CashflowEvent}
        accounts={(accountsResult.data as Account[]) || []}
        action={boundAction}
        title="Edit Cashflow Event"
      />
    </div>
  );
}
