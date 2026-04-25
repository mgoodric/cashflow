import { getTransactionsWithDetails } from "@/actions/transactions";
import { TransactionGrid } from "@/components/transactions/transaction-grid";

export default async function TransactionsPage() {
  const { transactions, accounts, categories } = await getTransactionsWithDetails();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          View and edit your transaction history
        </p>
      </div>
      <TransactionGrid
        transactions={transactions}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
