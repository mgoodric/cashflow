import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AccountCard } from "@/components/accounts/account-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Account } from "@/lib/types/database";

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-gray-500">Manage your financial accounts</p>
        </div>
        <Link href="/accounts/new">
          <Button>Add Account</Button>
        </Link>
      </div>

      {!accounts || accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Add your first account to start tracking your cashflow."
          action={
            <Link href="/accounts/new">
              <Button>Add Your First Account</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {(accounts as Account[]).map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
