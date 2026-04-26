"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SELECT_CLASS } from "@/lib/constants";
import { updateTransaction, deleteTransaction } from "@/actions/transactions";
import type { Transaction, Account, Category } from "@/lib/types/database";

type TransactionWithDetails = Transaction & {
  account_name: string | null;
  category_name: string | null;
};

interface TransactionGridProps {
  transactions: TransactionWithDetails[];
  accounts: Account[];
  categories: Category[];
}

type SortField = "transaction_date" | "payee" | "amount";
type SortDir = "asc" | "desc";

interface EditState {
  transactionDate: string;
  payee: string;
  amount: string;
  transactionType: "income" | "expense";
  categoryId: string;
  accountId: string;
  memo: string;
  isCleared: boolean;
}

// -- Editable Row Component (isolated state to avoid full-table rerenders) --

function EditableRow({
  txn,
  accounts,
  categories,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  isSaving,
}: {
  txn: TransactionWithDetails;
  accounts: Account[];
  categories: Category[];
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (id: string, data: EditState) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  const [edit, setEdit] = useState<EditState>({
    transactionDate: txn.transaction_date,
    payee: txn.payee ?? "",
    amount: String(Math.abs(txn.amount)),
    transactionType: txn.transaction_type,
    categoryId: txn.category_id ?? "",
    accountId: txn.account_id,
    memo: txn.memo ?? "",
    isCleared: txn.is_cleared,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [isEditing]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave(txn.id, edit);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancelEdit();
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.abs(n));

  if (isEditing) {
    return (
      <TableRow
        className="bg-blue-50/60 dark:bg-blue-950/20 border-l-2 border-l-blue-400"
        onKeyDown={handleKeyDown}
      >
        <TableCell className="p-1">
          <input
            ref={firstInputRef}
            type="date"
            className="h-7 w-[130px] rounded border border-input bg-transparent px-1.5 text-sm"
            value={edit.transactionDate}
            onChange={(e) =>
              setEdit((s) => ({ ...s, transactionDate: e.target.value }))
            }
          />
        </TableCell>
        <TableCell className="p-1">
          <Input
            className="h-7 text-sm"
            value={edit.payee}
            onChange={(e) =>
              setEdit((s) => ({ ...s, payee: e.target.value }))
            }
          />
        </TableCell>
        <TableCell className="p-1">
          <Input
            type="number"
            step="0.01"
            className="h-7 w-[100px] text-sm"
            value={edit.amount}
            onChange={(e) =>
              setEdit((s) => ({ ...s, amount: e.target.value }))
            }
          />
        </TableCell>
        <TableCell className="p-1">
          <select
            className={`${SELECT_CLASS} h-7 w-[100px] text-sm py-0`}
            value={edit.transactionType}
            onChange={(e) =>
              setEdit((s) => ({
                ...s,
                transactionType: e.target.value as "income" | "expense",
              }))
            }
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </TableCell>
        <TableCell className="p-1">
          <select
            className={`${SELECT_CLASS} h-7 w-[140px] text-sm py-0`}
            value={edit.categoryId}
            onChange={(e) =>
              setEdit((s) => ({ ...s, categoryId: e.target.value }))
            }
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </TableCell>
        <TableCell className="p-1">
          <select
            className={`${SELECT_CLASS} h-7 w-[140px] text-sm py-0`}
            value={edit.accountId}
            onChange={(e) =>
              setEdit((s) => ({ ...s, accountId: e.target.value }))
            }
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </TableCell>
        <TableCell className="p-1">
          <Input
            className="h-7 text-sm"
            value={edit.memo}
            onChange={(e) =>
              setEdit((s) => ({ ...s, memo: e.target.value }))
            }
          />
        </TableCell>
        <TableCell className="p-1 text-center">
          <input
            type="checkbox"
            checked={edit.isCleared}
            onChange={(e) =>
              setEdit((s) => ({ ...s, isCleared: e.target.checked }))
            }
          />
        </TableCell>
        <TableCell className="p-1">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="default"
              className="h-6 px-2 text-xs"
              disabled={isSaving}
              onClick={() => onSave(txn.id, edit)}
            >
              {isSaving ? "..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      className="even:bg-muted/30 cursor-pointer"
      onDoubleClick={onStartEdit}
    >
      <TableCell className="p-1.5 text-sm">{txn.transaction_date}</TableCell>
      <TableCell className="p-1.5 text-sm max-w-[200px] truncate">
        {txn.payee ?? ""}
      </TableCell>
      <TableCell
        className={`p-1.5 text-sm font-mono tabular-nums ${
          txn.transaction_type === "income"
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {txn.transaction_type === "income" ? "+" : "-"}
        {fmt(txn.amount)}
      </TableCell>
      <TableCell className="p-1.5 text-sm">
        <Badge
          variant={txn.transaction_type === "income" ? "default" : "secondary"}
          className="text-xs"
        >
          {txn.transaction_type === "income" ? "Income" : "Expense"}
        </Badge>
      </TableCell>
      <TableCell className="p-1.5 text-sm text-muted-foreground">
        {txn.category_name ?? "--"}
      </TableCell>
      <TableCell className="p-1.5 text-sm text-muted-foreground">
        {txn.account_name ?? "--"}
      </TableCell>
      <TableCell className="p-1.5 text-sm text-muted-foreground max-w-[150px] truncate">
        {txn.memo ?? ""}
      </TableCell>
      <TableCell className="p-1.5 text-center text-sm">
        {txn.is_cleared ? (
          <span className="text-green-600 dark:text-green-400">&#10003;</span>
        ) : (
          ""
        )}
      </TableCell>
      <TableCell className="p-1.5">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={onStartEdit}
          >
            Edit
          </Button>
          {confirmDelete ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Sure?</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-5 px-1.5 text-xs"
                onClick={() => onDelete(txn.id)}
              >
                Yes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1.5 text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                No
              </Button>
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-red-500 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// -- Main Grid Component --

export function TransactionGrid({
  transactions,
  accounts,
  categories,
}: TransactionGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("transaction_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir(field === "amount" ? "desc" : "asc");
      }
    },
    [sortField]
  );

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  // Filter
  const filtered = transactions.filter((t) => {
    if (filterAccountId && t.account_id !== filterAccountId) return false;
    if (
      search &&
      !(t.payee ?? "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "transaction_date":
        return a.transaction_date.localeCompare(b.transaction_date) * dir;
      case "payee":
        return (a.payee ?? "").localeCompare(b.payee ?? "") * dir;
      case "amount":
        return (a.amount - b.amount) * dir;
      default:
        return 0;
    }
  });

  function handleSave(id: string, data: EditState) {
    startTransition(async () => {
      await updateTransaction(id, {
        transactionDate: data.transactionDate,
        payee: data.payee || undefined,
        amount: parseFloat(data.amount),
        transactionType: data.transactionType,
        categoryId: data.categoryId || null,
        accountId: data.accountId,
        memo: data.memo || null,
        isCleared: data.isCleared,
      });
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTransaction(id);
      router.refresh();
    });
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          No transactions yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Import transactions from the{" "}
          <Link href="/import" className="underline hover:text-foreground">
            Import
          </Link>{" "}
          page, or detect recurring patterns in{" "}
          <Link href="/insights" className="underline hover:text-foreground">
            Insights
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className={`${SELECT_CLASS} w-[200px]`}
          value={filterAccountId}
          onChange={(e) => setFilterAccountId(e.target.value)}
        >
          <option value="">All Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="Search payee..."
          className="w-[250px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("transaction_date")}
              >
                Date{sortArrow("transaction_date")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("payee")}
              >
                Payee{sortArrow("payee")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("amount")}
              >
                Amount{sortArrow("amount")}
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="text-center">Cleared</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((txn) => (
              <EditableRow
                key={txn.id}
                txn={txn}
                accounts={accounts}
                categories={categories}
                isEditing={editingId === txn.id}
                onStartEdit={() => setEditingId(txn.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={handleSave}
                onDelete={handleDelete}
                isSaving={isPending}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Row count */}
      <p className="text-sm text-muted-foreground">
        Showing {sorted.length} of {transactions.length} transactions
      </p>
    </div>
  );
}
