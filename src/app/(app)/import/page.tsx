import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/components/import/import-wizard";
import type { Account, Category } from "@/lib/types/database";

export default async function ImportPage() {
  const supabase = await createClient();

  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("categories")
      .select("*")
      .order("name"),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Transactions</h1>
        <p className="text-sm text-gray-500">
          Import transactions from QIF files exported from Quicken or other financial software
        </p>
      </div>
      <ImportWizard
        existingAccounts={(accounts as Account[]) ?? []}
        existingCategories={(categories as Category[]) ?? []}
      />
    </div>
  );
}
