import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { toAccount } from "@/lib/db/mappers";
import { AccountForm } from "@/components/accounts/account-form";
import { updateAccount } from "@/actions/accounts";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);

  if (rows.length === 0) notFound();

  const account = toAccount(rows[0]);
  const boundAction = updateAccount.bind(null, id);

  return (
    <div>
      <AccountForm
        account={account}
        action={boundAction}
        title="Edit Account"
      />
    </div>
  );
}
