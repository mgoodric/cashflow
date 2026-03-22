import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants";
import type { Account } from "@/lib/types/database";

interface AccountSummaryCardProps {
  account: Account;
}

export function AccountSummaryCard({ account }: AccountSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
        <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.account_type]}</Badge>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${account.current_balance < 0 ? "text-red-600" : ""}`}>
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: account.currency,
          }).format(account.current_balance)}
        </div>
      </CardContent>
    </Card>
  );
}
