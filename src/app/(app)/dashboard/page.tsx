import { db } from "@/lib/db";
import { accounts, cashflowEvents, categories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { toAccount, toEvent, toCategory } from "@/lib/db/mappers";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { ProjectionChart } from "@/components/dashboard/projection-chart";
import { AccountSummaryCard } from "@/components/dashboard/account-summary-card";
import { SankeyChart } from "@/components/dashboard/sankey-chart";

export default async function DashboardPage() {
  const user = await requireUser();

  const [accountRows, eventRows, categoryRows] = await Promise.all([
    db.select().from(accounts).where(and(eq(accounts.userId, user.id), eq(accounts.isActive, true))).orderBy(accounts.name),
    db.select().from(cashflowEvents).where(and(eq(cashflowEvents.userId, user.id), eq(cashflowEvents.isActive, true))),
    db.select().from(categories).where(eq(categories.userId, user.id)).orderBy(categories.name),
  ]);

  const accts = accountRows.map(toAccount);
  const evts = eventRows.map(toEvent);
  const cats = categoryRows.map(toCategory);

  const totalBalance = accts.reduce((sum, a) => sum + a.current_balance, 0);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));

  let incomeThisMonth = 0;
  let expensesThisMonth = 0;

  for (const event of evts) {
    const eventDate = new Date(event.event_date + "T00:00:00Z");
    if (eventDate >= monthStart && eventDate <= monthEnd) {
      if (event.event_type === "income") {
        incomeThisMonth += event.amount;
      } else {
        expensesThisMonth += event.amount;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-500">Your cashflow overview and forecast</p>
      </div>

      <StatsGrid
        totalBalance={totalBalance}
        incomeThisMonth={incomeThisMonth}
        expensesThisMonth={expensesThisMonth}
        activeAccounts={accts.length}
      />

      <ProjectionChart accounts={accts} events={evts} />

      <SankeyChart events={evts} categories={cats} />

      {accts.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Accounts</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accts.map((account) => (
              <AccountSummaryCard key={account.id} account={account} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
