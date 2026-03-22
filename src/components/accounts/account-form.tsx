"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCOUNT_TYPE_LABELS, SELECT_CLASS } from "@/lib/constants";
import type { Account, AccountType } from "@/lib/types/database";

interface AccountFormProps {
  account?: Account;
  action: (formData: FormData) => void;
  title: string;
}

const accountTypes = (Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][]).map(
  ([value, label]) => ({ value, label })
);

export function AccountForm({ account, action, title }: AccountFormProps) {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={account?.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_type">Account Type</Label>
            <select
              id="account_type"
              name="account_type"
              defaultValue={account?.account_type || "checking"}
              className={SELECT_CLASS}
            >
              {accountTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="current_balance">Current Balance</Label>
            <Input
              id="current_balance"
              name="current_balance"
              type="number"
              step="0.01"
              defaultValue={account?.current_balance ?? 0}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              name="currency"
              defaultValue={account?.currency || "USD"}
              required
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit">
              {account ? "Update Account" : "Create Account"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
