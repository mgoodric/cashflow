import { db } from "@/lib/db";
import { accounts, cashflowEvents, eventOverrides } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toAccount, toEvent, toEventOverride } from "@/lib/db/mappers";
import { getTransactionsWithDetails } from "@/actions/transactions";
import { expandEventsToRows } from "@/lib/expand-events";
import { TransactionGrid } from "@/components/transactions/transaction-grid";

export default async function TransactionsPage() {
  const user = await requireUser();

  // Fetch historical transactions + reference data
  const { transactions, accounts: accts, categories: cats } = await getTransactionsWithDetails();

  // Fetch events and overrides for projected rows
  const [eventRows, accountRows] = await Promise.all([
    db.select().from(cashflowEvents).where(and(eq(cashflowEvents.userId, user.id), eq(cashflowEvents.isActive, true))),
    db.select().from(accounts).where(and(eq(accounts.userId, user.id), eq(accounts.isActive, true))).orderBy(accounts.name),
  ]);

  const evts = eventRows.map(toEvent);
  const allAccounts = accountRows.map(toAccount);

  const eventIds = evts.map((e) => e.id);
  const overrideRows = eventIds.length > 0
    ? await db.select().from(eventOverrides).where(inArray(eventOverrides.eventId, eventIds))
    : [];
  const ovrs = overrideRows.map(toEventOverride);

  // Generate projected rows: 365 days forward, 365 days back
  const projectedRows = expandEventsToRows(evts, allAccounts, ovrs, 365, 365);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Historical transactions and projected future events
        </p>
      </div>
      <TransactionGrid
        transactions={transactions}
        projectedRows={projectedRows}
        accounts={accts}
        categories={cats}
        allAccounts={allAccounts}
      />
    </div>
  );
}
