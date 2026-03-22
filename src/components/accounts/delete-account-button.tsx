"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteAccount } from "@/actions/accounts";

interface DeleteAccountButtonProps {
  accountId: string;
  accountName: string;
}

export function DeleteAccountButton({ accountId, accountName }: DeleteAccountButtonProps) {
  return (
    <ConfirmDialog
      title="Delete Account"
      description={`Are you sure you want to delete "${accountName}"? This will also delete all associated cashflow events. This action cannot be undone.`}
      onConfirm={() => deleteAccount(accountId)}
      trigger={
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      }
    />
  );
}
