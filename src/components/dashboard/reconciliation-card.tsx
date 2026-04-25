"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reconcileAccount } from "@/actions/accounts";
import type { Account } from "@/lib/types/database";

interface ReconciliationCardProps {
  accounts: Account[];
}

function AccountReconcileRow({ account }: { account: Account }) {
  const [expanded, setExpanded] = useState(false);
  const [actualBalance, setActualBalance] = useState(String(account.current_balance));
  const [saving, setSaving] = useState(false);

  const format = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const diff = parseFloat(actualBalance || "0") - account.current_balance;

  const handleReconcile = async () => {
    setSaving(true);
    try {
      await reconcileAccount(account.id, parseFloat(actualBalance));
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-b last:border-0 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{account.name}</p>
          <p className="text-sm text-muted-foreground capitalize">{account.account_type}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono font-medium">{format(account.current_balance)}</span>
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Cancel" : "Reconcile"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 rounded-md border p-3 bg-muted/50">
          <div className="flex-1 w-full sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground">Actual Balance</label>
            <Input
              type="number"
              step="0.01"
              value={actualBalance}
              onChange={(e) => setActualBalance(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Difference: </span>
            <span className={`font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}>
              {diff > 0 ? "+" : ""}{format(diff)}
            </span>
          </div>
          <Button size="sm" onClick={handleReconcile} disabled={saving}>
            {saving ? "Updating..." : "Update Balance"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ReconciliationCard({ accounts }: ReconciliationCardProps) {
  if (accounts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance Reconciliation</CardTitle>
      </CardHeader>
      <CardContent>
        {accounts.map((account) => (
          <AccountReconcileRow key={account.id} account={account} />
        ))}
      </CardContent>
    </Card>
  );
}
