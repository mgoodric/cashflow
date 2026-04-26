import Link from "next/link";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toAccount } from "@/lib/db/mappers";
import { Button } from "@/components/ui/button";
import { AccountCard } from "@/components/accounts/account-card";
import { EmptyState } from "@/components/shared/empty-state";

export default async function AccountsPage() {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, user.id))
    .orderBy(accounts.createdAt);

  const accountList = rows.map(toAccount);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage your financial accounts</p>
        </div>
        <Link href="/accounts/new">
          <Button>Add Account</Button>
        </Link>
      </div>

      {accountList.length === 0 ? (
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
          {accountList.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
