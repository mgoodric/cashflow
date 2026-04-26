import { requireUser } from "@/lib/auth";
import { isPlaidConfigured } from "@/lib/plaid";
import { getPlaidItems } from "@/actions/plaid";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  await requireUser();
  const configured = isPlaidConfigured();
  const items = await getPlaidItems();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage connected bank accounts and integrations
        </p>
      </div>

      {!configured && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Plaid integration requires <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">PLAID_CLIENT_ID</code>,{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">PLAID_SECRET</code>, and{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">PLAID_ENV</code> environment
            variables. Set these to connect bank accounts.
          </p>
        </div>
      )}

      <SettingsClient initialItems={items} configured={configured} />
    </div>
  );
}
