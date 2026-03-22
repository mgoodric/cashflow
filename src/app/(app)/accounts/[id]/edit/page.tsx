import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "@/components/accounts/account-form";
import { updateAccount } from "@/actions/accounts";
import type { Account } from "@/lib/types/database";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (!account) notFound();

  const boundAction = updateAccount.bind(null, id);

  return (
    <div>
      <AccountForm
        account={account as Account}
        action={boundAction}
        title="Edit Account"
      />
    </div>
  );
}
