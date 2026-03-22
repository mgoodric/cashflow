"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createAccount(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: formData.get("name") as string,
    account_type: formData.get("account_type") as string,
    current_balance: parseFloat(formData.get("current_balance") as string) || 0,
    currency: (formData.get("currency") as string) || "USD",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function updateAccount(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("accounts")
    .update({
      name: formData.get("name") as string,
      account_type: formData.get("account_type") as string,
      current_balance: parseFloat(formData.get("current_balance") as string) || 0,
      currency: (formData.get("currency") as string) || "USD",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/accounts");
  redirect("/accounts");
}
