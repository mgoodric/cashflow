"use client";

import { useState, useTransition, useCallback, useRef, useEffect, useMemo } from "react";
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
import { updateTransaction, deleteTransaction, confirmProjectedOccurrence } from "@/actions/transactions";
import type { Transaction, Account, Category } from "@/lib/types/database";
import type { ProjectedRow } from "@/lib/expand-events";

type TransactionWithDetails = Transaction & {
  account_name: string | null;
  category_name: string | null;
};

interface TransactionGridProps {
  transactions: TransactionWithDetails[];
  projectedRows: ProjectedRow[];
  accounts: Account[];
  categories: Category[];
  allAccounts: Account[];
}

type UnifiedRow = {
  id: string;
  date: string;
  name: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  account_id: string;
  account_name: string;
  category_name: string | null;
  source: "historical" | "projected";
  memo?: string | null;
  is_cleared?: boolean;
  transaction_type?: "income" | "expense";
  category_id?: string | null;
  event_id?: string;
  is_overridden?: boolean;
  loan_payment?: { interest: number; principal: number; extraPrincipal: number };
};

type SortField = "date" | "name" | "amount";
type SortDir = "asc" | "desc";
type TimeRange = "past" | "30d" | "90d" | "180d" | "1y";

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

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(n));

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "past", label: "Past Only" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "180d", label: "180d" },
  { value: "1y", label: "1y" },
];

function getTimeRangeCutoff(range: TimeRange): Date | null {
  if (range === "past") return new Date();
  const now = new Date();
  const days = range === "30d" ? 30 : range === "90d" ? 90 : range === "180d" ? 180 : 365;
  return new Date(now.getTime() + days * 86400000);
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

// -- Editable Row Component (historical transactions only) --

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

  if (isEditing) {
    return (
      <TableRow
        className="bg-blue-50/60 dark:bg-blue-950/20 border-l-2 border-l-blue-400"
        onKeyDown={handleKeyDown}
      >
        <TableCell className="p-1" />
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
        <TableCell className="p-1" />
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
      <TableCell className="p-1.5">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground border-muted-foreground/30">
          History
        </Badge>
      </TableCell>
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
      <TableCell className="p-1.5 text-sm font-mono tabular-nums text-muted-foreground">
        --
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

// -- Projected Row Component --

function ProjectedRowView({
  row,
  balance,
  onConfirm,
  isConfirming,
}: {
  row: UnifiedRow;
  balance: number | null;
  onConfirm: (row: UnifiedRow) => void;
  isConfirming: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAmount, setConfirmAmount] = useState(String(row.amount));

  const amountColor =
    row.type === "income"
      ? "text-green-600 dark:text-green-400"
      : row.type === "transfer"
        ? "text-blue-600 dark:text-blue-400"
        : "text-red-600 dark:text-red-400";

  const amountPrefix =
    row.type === "income" ? "+" : row.type === "transfer" ? "" : "-";

  return (
    <TableRow className="even:bg-muted/30 border-l-2 border-l-blue-400">
      <TableCell className="p-1.5">
        {row.is_overridden ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-yellow-600 dark:text-yellow-400 border-yellow-400/50">
            Override
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-blue-600 dark:text-blue-400 border-blue-400/50">
            Projected
          </Badge>
        )}
      </TableCell>
      <TableCell className="p-1.5 text-sm">{row.date}</TableCell>
      <TableCell className="p-1.5 text-sm max-w-[200px] truncate">
        {row.name}
      </TableCell>
      <TableCell className={`p-1.5 text-sm font-mono tabular-nums ${amountColor}`}>
        {amountPrefix}{fmt(row.amount)}
        {row.loan_payment && (
          <span
            className="ml-1 text-[10px] text-muted-foreground cursor-help"
            title={`Principal: ${fmt(row.loan_payment.principal)} | Interest: ${fmt(row.loan_payment.interest)}${row.loan_payment.extraPrincipal > 0 ? ` | Extra: ${fmt(row.loan_payment.extraPrincipal)}` : ""}`}
          >
            (P+I)
          </span>
        )}
      </TableCell>
      <TableCell className="p-1.5 text-sm">
        <Badge
          variant={row.type === "income" ? "default" : row.type === "transfer" ? "outline" : "secondary"}
          className="text-xs"
        >
          {row.type === "income" ? "Income" : row.type === "transfer" ? "Transfer" : "Expense"}
        </Badge>
      </TableCell>
      <TableCell className="p-1.5 text-sm text-muted-foreground">
        {row.category_name ?? "--"}
      </TableCell>
      <TableCell className="p-1.5 text-sm text-muted-foreground">
        {row.account_name ?? "--"}
      </TableCell>
      <TableCell className="p-1.5 text-sm text-muted-foreground">
        --
      </TableCell>
      <TableCell className={`p-1.5 text-sm font-mono tabular-nums ${balance !== null && balance < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
        {balance !== null ? fmt(balance) : "--"}
      </TableCell>
      <TableCell className="p-1.5">
        <div className="flex items-center gap-1">
          {!showConfirm ? (
            <>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center h-6 px-2 text-xs rounded-md text-green-600 dark:text-green-400 hover:bg-muted transition-colors"
              >
                Confirm
              </button>
              {row.event_id && (
                <Link
                  href={`/events/${row.event_id}/edit`}
                  className="inline-flex items-center h-6 px-2 text-xs rounded-md text-blue-600 dark:text-blue-400 hover:bg-muted transition-colors"
                >
                  Event
                </Link>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                value={confirmAmount}
                onChange={(e) => setConfirmAmount(e.target.value)}
                className="h-6 w-24 text-xs px-1"
              />
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => onConfirm({ ...row, amount: parseFloat(confirmAmount) || row.amount })}
                className="inline-flex items-center h-6 px-2 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isConfirming ? "..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirm(false); setConfirmAmount(String(row.amount)); }}
                className="inline-flex items-center h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// -- Main Grid Component --

export function TransactionGrid({
  transactions,
  projectedRows,
  accounts,
  categories,
  allAccounts,
}: TransactionGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [timeRange, setTimeRange] = useState<TimeRange>("90d");

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

  // Convert transactions to unified rows
  const historicalRows: UnifiedRow[] = useMemo(
    () =>
      transactions.map((t) => ({
        id: t.id,
        date: t.transaction_date,
        name: t.payee ?? "",
        amount: Math.abs(t.amount),
        type: t.transaction_type as "income" | "expense",
        account_id: t.account_id,
        account_name: t.account_name ?? "Unknown",
        category_name: t.category_name ?? null,
        source: "historical" as const,
        memo: t.memo,
        is_cleared: t.is_cleared,
        transaction_type: t.transaction_type,
        category_id: t.category_id,
      })),
    [transactions]
  );

  // Convert projected rows to unified rows
  const projectedUnified: UnifiedRow[] = useMemo(
    () =>
      projectedRows.map((p) => ({
        id: p.id,
        date: p.date,
        name: p.name,
        amount: p.amount,
        type: p.type,
        account_id: p.account_id,
        account_name: p.account_name,
        category_name: p.category_name,
        source: "projected" as const,
        event_id: p.event_id,
        is_overridden: p.is_overridden,
        loan_payment: p.loan_payment,
      })),
    [projectedRows]
  );

  // Merge and filter
  const mergedRows = useMemo(() => {
    const cutoff = getTimeRangeCutoff(timeRange);

    let rows: UnifiedRow[];
    if (timeRange === "past") {
      rows = historicalRows;
    } else {
      const filteredProjected = cutoff
        ? projectedUnified.filter((r) => r.date <= toDateStr(cutoff))
        : projectedUnified;
      rows = [...historicalRows, ...filteredProjected];
    }

    // Account filter
    if (filterAccountId) {
      rows = rows.filter((r) => r.account_id === filterAccountId);
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.memo ?? "").toLowerCase().includes(q)
      );
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (sortField) {
        case "date":
          return a.date.localeCompare(b.date) * dir;
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "amount":
          return (a.amount - b.amount) * dir;
        default:
          return 0;
      }
    });

    return rows;
  }, [historicalRows, projectedUnified, timeRange, filterAccountId, search, sortField, sortDir]);

  // Calculate running balance for projected rows
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    const totalBalance = allAccounts.reduce((sum, a) => sum + a.current_balance, 0);

    // Sort projected rows by date ascending for balance calculation
    const projectedSorted = mergedRows
      .filter((r) => r.source === "projected")
      .sort((a, b) => a.date.localeCompare(b.date));

    let running = totalBalance;
    for (const row of projectedSorted) {
      if (row.type === "income") {
        running += row.amount;
      } else if (row.type === "expense") {
        running -= row.amount;
      }
      // Transfers don't change total balance
      map.set(row.id, running);
    }

    return map;
  }, [mergedRows, allAccounts]);

  // Look up original transaction for editing
  const txnMap = useMemo(() => {
    const map = new Map<string, TransactionWithDetails>();
    for (const t of transactions) {
      map.set(t.id, t);
    }
    return map;
  }, [transactions]);

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

  function handleConfirm(row: UnifiedRow) {
    startTransition(async () => {
      await confirmProjectedOccurrence({
        eventId: row.event_id!,
        date: row.date,
        name: row.name,
        amount: row.amount,
        type: row.type === "income" ? "income" : "expense",
        accountId: row.account_id,
        categoryId: row.category_id ?? null,
      });
      router.refresh();
    });
  }

  const historicalCount = mergedRows.filter((r) => r.source === "historical").length;
  const projectedCount = mergedRows.filter((r) => r.source === "projected").length;

  if (transactions.length === 0 && projectedRows.length === 0) {
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
        {/* Time range selector */}
        <div className="inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5">
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                timeRange === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
          placeholder="Search name/memo..."
          className="w-[250px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Source</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("date")}
              >
                Date{sortArrow("date")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("name")}
              >
                Name{sortArrow("name")}
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
              <TableHead>Balance</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mergedRows.map((row) => {
              if (row.source === "historical") {
                const txn = txnMap.get(row.id);
                if (!txn) return null;
                return (
                  <EditableRow
                    key={row.id}
                    txn={txn}
                    accounts={accounts}
                    categories={categories}
                    isEditing={editingId === row.id}
                    onStartEdit={() => setEditingId(row.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    isSaving={isPending}
                  />
                );
              }

              return (
                <ProjectedRowView
                  key={row.id}
                  row={row}
                  balance={balanceMap.get(row.id) ?? null}
                  onConfirm={handleConfirm}
                  isConfirming={isPending}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Row counts */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          Showing {mergedRows.length} rows ({historicalCount} historical, {projectedCount} projected)
        </span>
        {timeRange !== "past" && (
          <span className="text-xs">
            Projections available up to 90 days out
          </span>
        )}
      </div>
    </div>
  );
}
