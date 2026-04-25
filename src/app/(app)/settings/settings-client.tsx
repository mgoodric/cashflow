"use client";

import { useCallback, useState } from "react";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { ConnectedBanks } from "@/components/plaid/connected-banks";
import { getPlaidItems } from "@/actions/plaid";
import type { PlaidItem } from "@/lib/types/database";

interface SettingsClientProps {
  initialItems: PlaidItem[];
  configured: boolean;
}

export function SettingsClient({ initialItems, configured }: SettingsClientProps) {
  const [items, setItems] = useState(initialItems);

  const refresh = useCallback(async () => {
    const updated = await getPlaidItems();
    setItems(updated);
  }, []);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connected Banks</h2>
          {configured && <PlaidLinkButton onSuccess={refresh} />}
        </div>
        <ConnectedBanks items={items} onRefresh={refresh} />
      </section>
    </div>
  );
}
