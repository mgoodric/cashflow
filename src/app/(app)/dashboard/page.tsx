import { createClient } from "@/lib/supabase/server";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { ProjectionChart } from "@/components/dashboard/projection-chart";
import { AccountSummaryCard } from "@/components/dashboard/account-summary-card";
import type { Account, CashflowEvent } from "@/lib/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [accountsResult, eventsResult] = await Promise.all([
    supabase.from("accounts").select("*").eq("is_active", true).order("name"),
    supabase.from("cashflow_events").select("*").eq("is_active", true),
  ]);

  const accounts = (accountsResult.data as Account[]) || [];
  const events = (eventsResult.data as CashflowEvent[]) || [];

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

  // Compute this month's income/expenses from one-off events
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));

  let incomeThisMonth = 0;
  let expensesThisMonth = 0;

  for (const event of events) {
    const eventDate = new Date(event.event_date + "T00:00:00Z");
    if (eventDate >= monthStart && eventDate <= monthEnd) {
      if (event.event_type === "income") {
        incomeThisMonth += Number(event.amount);
      } else {
        expensesThisMonth += Number(event.amount);
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
        activeAccounts={accounts.length}
      />

      <ProjectionChart accounts={accounts} events={events} />

      {accounts.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Accounts</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <AccountSummaryCard key={account.id} account={account} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
