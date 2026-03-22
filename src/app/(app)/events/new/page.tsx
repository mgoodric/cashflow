import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/events/event-form";
import { createEvent } from "@/actions/events";
import type { Account } from "@/lib/types/database";

export default async function NewEventPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("name");

  return (
    <div>
      <EventForm
        accounts={(accounts as Account[]) || []}
        action={createEvent}
        title="Create Cashflow Event"
      />
    </div>
  );
}
