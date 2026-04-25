"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncTransactions, disconnectPlaidItem } from "@/actions/plaid";
import type { PlaidItem } from "@/lib/types/database";

interface ConnectedBanksProps {
  items: PlaidItem[];
  onRefresh: () => void;
}

export function ConnectedBanks({ items, onRefresh }: ConnectedBanksProps) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSync(itemId: string) {
    setSyncingId(itemId);
    setMessage(null);

    const result = await syncTransactions(itemId);

    if ("error" in result) {
      setMessage(result.error);
    } else {
      setMessage(
        `Synced: ${result.added} added, ${result.modified} modified, ${result.removed} removed`,
      );
      startTransition(() => {
        onRefresh();
      });
    }

    setSyncingId(null);
  }

  async function handleDisconnect(itemId: string) {
    if (!confirm("Disconnect this bank account? Transaction history will be preserved.")) {
      return;
    }

    setDisconnectingId(itemId);
    setMessage(null);

    const result = await disconnectPlaidItem(itemId);

    if ("error" in result) {
      setMessage(result.error);
    } else {
      startTransition(() => {
        onRefresh();
      });
    }

    setDisconnectingId(null);
  }

  const activeItems = items.filter((item) => item.status === "active");
  const disconnectedItems = items.filter((item) => item.status === "disconnected");

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md border bg-muted/50 p-3 text-sm">
          {message}
        </div>
      )}

      {activeItems.length === 0 && disconnectedItems.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No bank accounts connected yet. Use the button above to connect your first bank.
        </p>
      )}

      {activeItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div>
            <h3 className="font-medium">
              {item.institution_name || "Unknown Bank"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Connected {new Date(item.created_at).toLocaleDateString()}
              {item.cursor && (
                <> &middot; Last synced {new Date(item.updated_at).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync(item.id)}
              disabled={syncingId === item.id || isPending}
            >
              {syncingId === item.id ? "Syncing..." : "Sync Transactions"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => handleDisconnect(item.id)}
              disabled={disconnectingId === item.id || isPending}
            >
              {disconnectingId === item.id ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        </div>
      ))}

      {disconnectedItems.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Previously Connected
          </h3>
          {disconnectedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-dashed p-4 opacity-60"
            >
              <div>
                <h3 className="font-medium">
                  {item.institution_name || "Unknown Bank"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Disconnected
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
