import { AccountForm } from "@/components/accounts/account-form";
import { createAccount } from "@/actions/accounts";

export default function NewAccountPage() {
  return (
    <div>
      <AccountForm action={createAccount} title="Create Account" />
    </div>
  );
}
