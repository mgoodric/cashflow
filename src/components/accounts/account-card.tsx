import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteAccountButton } from "./delete-account-button";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants";
import type { Account } from "@/lib/types/database";

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  const isNegative = account.current_balance < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{account.name}</CardTitle>
        <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-2xl font-bold ${isNegative ? "text-red-600" : ""}`}>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: account.currency,
              }).format(account.current_balance)}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/accounts/${account.id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
            <DeleteAccountButton accountId={account.id} accountName={account.name} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
