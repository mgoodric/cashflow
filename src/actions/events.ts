"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isRecurring = formData.get("is_recurring") === "true";
  const recurrenceRuleJson = formData.get("recurrence_rule") as string;

  const { error } = await supabase.from("cashflow_events").insert({
    user_id: user.id,
    account_id: formData.get("account_id") as string,
    name: formData.get("name") as string,
    event_type: formData.get("event_type") as string,
    amount: parseFloat(formData.get("amount") as string),
    event_date: formData.get("event_date") as string,
    is_recurring: isRecurring,
    recurrence_rule: isRecurring && recurrenceRuleJson ? JSON.parse(recurrenceRuleJson) : null,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/events");
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isRecurring = formData.get("is_recurring") === "true";
  const recurrenceRuleJson = formData.get("recurrence_rule") as string;

  const { error } = await supabase
    .from("cashflow_events")
    .update({
      account_id: formData.get("account_id") as string,
      name: formData.get("name") as string,
      event_type: formData.get("event_type") as string,
      amount: parseFloat(formData.get("amount") as string),
      event_date: formData.get("event_date") as string,
      is_recurring: isRecurring,
      recurrence_rule: isRecurring && recurrenceRuleJson ? JSON.parse(recurrenceRuleJson) : null,
      notes: (formData.get("notes") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/events");
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("cashflow_events").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/events");
}
