import { db } from "@/lib/db";
import { accounts, categories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toAccount, toCategory } from "@/lib/db/mappers";
import { ImportWizard } from "@/components/import/import-wizard";

export default async function ImportPage() {
  const user = await requireUser();

  const [accountRows, categoryRows] = await Promise.all([
    db.select().from(accounts).where(and(eq(accounts.userId, user.id), eq(accounts.isActive, true))).orderBy(accounts.name),
    db.select().from(categories).where(eq(categories.userId, user.id)).orderBy(categories.name),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Import transactions from QIF files exported from Quicken or other financial software
        </p>
      </div>
      <ImportWizard
        existingAccounts={accountRows.map(toAccount)}
        existingCategories={categoryRows.map(toCategory)}
      />
    </div>
  );
}
