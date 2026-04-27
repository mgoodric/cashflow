"use client";

import { useState, useTransition, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
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

type DisplayRow =
  | { kind: "data"; row: UnifiedRow }
  | { kind: "today-divider" };

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

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAhead = new Date(now);
  oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
  return { from: toDateStr(oneYearAgo), to: toDateStr(oneYearAhead) };
}

type DatePreset = "this-month" | "this-quarter" | "this-year" | "all-time";

function applyPreset(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  switch (preset) {
    case "this-month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toDateStr(start), to: toDateStr(end) };
    }
    case "this-quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { from: toDateStr(start), to: toDateStr(end) };
    }
    case "this-year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { from: toDateStr(start), to: toDateStr(end) };
    }
    case "all-time":
      return { from: "", to: "" };
  }
}

// -- Column widths (consistent between header and rows) --
const COL = {
  source: "w-[80px] min-w-[80px]",
  date: "w-[100px] min-w-[100px]",
  name: "flex-1 min-w-[120px]",
  amount: "w-[120px] min-w-[120px]",
  type: "w-[90px] min-w-[90px]",
  category: "w-[120px] min-w-[120px]",
  account: "w-[120px] min-w-[120px]",
  memo: "w-[140px] min-w-[140px]",
  balance: "w-[110px] min-w-[110px]",
  actions: "w-[160px] min-w-[160px]",
} as const;

// -- Editable Row Component (historical transactions only) --

function EditableRowEditing({
  txn,
  accounts,
  categories,
  onCancelEdit,
  onSave,
  isSaving,
}: {
  txn: TransactionWithDetails;
  accounts: Account[];
  categories: Category[];
  onCancelEdit: () => void;
  onSave: (id: string, data: EditState) => void;
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
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave(txn.id, edit);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancelEdit();
    }
  }

  return (
    <div
      className="flex items-center bg-blue-50/60 dark:bg-blue-950/20 border-l-2 border-l-blue-400 border-b border-border"
      style={{ height: 56 }}
      onKeyDown={handleKeyDown}
    >
      <div className={`${COL.source} shrink-0 p-1`} />
      <div className={`${COL.date} shrink-0 p-1`}>
        <input
          ref={firstInputRef}
          type="date"
          className="h-7 w-full rounded border border-input bg-transparent px-1.5 text-sm"
          value={edit.transactionDate}
          onChange={(e) => setEdit((s) => ({ ...s, transactionDate: e.target.value }))}
        />
      </div>
      <div className={`${COL.name} shrink-0 p-1`}>
        <Input
          className="h-7 text-sm"
          value={edit.payee}
          onChange={(e) => setEdit((s) => ({ ...s, payee: e.target.value }))}
        />
      </div>
      <div className={`${COL.amount} shrink-0 p-1`}>
        <Input
          type="number"
          step="0.01"
          className="h-7 w-full text-sm"
          value={edit.amount}
          onChange={(e) => setEdit((s) => ({ ...s, amount: e.target.value }))}
        />
      </div>
      <div className={`${COL.type} shrink-0 p-1`}>
        <select
          className={`${SELECT_CLASS} h-7 w-full text-sm py-0`}
          value={edit.transactionType}
          onChange={(e) =>
            setEdit((s) => ({ ...s, transactionType: e.target.value as "income" | "expense" }))
          }
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>
      <div className={`${COL.category} shrink-0 p-1`}>
        <select
          className={`${SELECT_CLASS} h-7 w-full text-sm py-0`}
          value={edit.categoryId}
          onChange={(e) => setEdit((s) => ({ ...s, categoryId: e.target.value }))}
        >
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className={`${COL.account} shrink-0 p-1`}>
        <select
          className={`${SELECT_CLASS} h-7 w-full text-sm py-0`}
          value={edit.accountId}
          onChange={(e) => setEdit((s) => ({ ...s, accountId: e.target.value }))}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div className={`${COL.memo} shrink-0 p-1`}>
        <Input
          className="h-7 text-sm"
          value={edit.memo}
          onChange={(e) => setEdit((s) => ({ ...s, memo: e.target.value }))}
        />
      </div>
      <div className={`${COL.balance} shrink-0 p-1`} />
      <div className={`${COL.actions} shrink-0 p-1`}>
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
      </div>
    </div>
  );
}

function EditableRowDisplay({
  txn,
  onStartEdit,
  onDelete,
  rowIndex,
}: {
  txn: TransactionWithDetails;
  onStartEdit: () => void;
  onDelete: (id: string) => void;
  rowIndex: number;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`flex items-center cursor-pointer border-b border-border ${rowIndex % 2 === 1 ? "bg-muted/30" : ""}`}
      style={{ height: 40 }}
      onDoubleClick={onStartEdit}
    >
      <div className={`${COL.source} shrink-0 p-1.5`}>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground border-muted-foreground/30">
          History
        </Badge>
      </div>
      <div className={`${COL.date} shrink-0 p-1.5 text-sm`}>{txn.transaction_date}</div>
      <div className={`${COL.name} shrink-0 p-1.5 text-sm truncate`}>{txn.payee ?? ""}</div>
      <div className={`${COL.amount} shrink-0 p-1.5 text-sm font-mono tabular-nums ${
        txn.transaction_type === "income"
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
      }`}>
        {txn.transaction_type === "income" ? "+" : "-"}{fmt(txn.amount)}
      </div>
      <div className={`${COL.type} shrink-0 p-1.5 text-sm`}>
        <Badge variant={txn.transaction_type === "income" ? "default" : "secondary"} className="text-xs">
          {txn.transaction_type === "income" ? "Income" : "Expense"}
        </Badge>
      </div>
      <div className={`${COL.category} shrink-0 p-1.5 text-sm text-muted-foreground truncate`}>
        {txn.category_name ?? "--"}
      </div>
      <div className={`${COL.account} shrink-0 p-1.5 text-sm text-muted-foreground truncate`}>
        {txn.account_name ?? "--"}
      </div>
      <div className={`${COL.memo} shrink-0 p-1.5 text-sm text-muted-foreground truncate`}>
        {txn.memo ?? ""}
      </div>
      <div className={`${COL.balance} shrink-0 p-1.5 text-sm font-mono tabular-nums text-muted-foreground`}>
        --
      </div>
      <div className={`${COL.actions} shrink-0 p-1.5`}>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onStartEdit}>
            Edit
          </Button>
          {confirmDelete ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Sure?</span>
              <Button size="sm" variant="destructive" className="h-5 px-1.5 text-xs" onClick={() => onDelete(txn.id)}>
                Yes
              </Button>
              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-xs" onClick={() => setConfirmDelete(false)}>
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
      </div>
    </div>
  );
}

// -- Projected Row Component --

function ProjectedRowView({
  row,
  balance,
  onConfirm,
  isConfirming,
  rowIndex,
}: {
  row: UnifiedRow;
  balance: number | null;
  onConfirm: (row: UnifiedRow) => void;
  isConfirming: boolean;
  rowIndex: number;
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
    <div
      className={`flex items-center border-l-2 border-l-blue-400 border-b border-border ${rowIndex % 2 === 1 ? "bg-muted/30" : ""}`}
      style={{ height: 40 }}
    >
      <div className={`${COL.source} shrink-0 p-1.5`}>
        {row.is_overridden ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-yellow-600 dark:text-yellow-400 border-yellow-400/50">
            Override
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-blue-600 dark:text-blue-400 border-blue-400/50">
            Projected
          </Badge>
        )}
      </div>
      <div className={`${COL.date} shrink-0 p-1.5 text-sm`}>{row.date}</div>
      <div className={`${COL.name} shrink-0 p-1.5 text-sm truncate`}>{row.name}</div>
      <div className={`${COL.amount} shrink-0 p-1.5 text-sm font-mono tabular-nums ${amountColor}`}>
        {amountPrefix}{fmt(row.amount)}
        {row.loan_payment && (
          <span
            className="ml-1 text-[10px] text-muted-foreground cursor-help"
            title={`Principal: ${fmt(row.loan_payment.principal)} | Interest: ${fmt(row.loan_payment.interest)}${row.loan_payment.extraPrincipal > 0 ? ` | Extra: ${fmt(row.loan_payment.extraPrincipal)}` : ""}`}
          >
            (P+I)
          </span>
        )}
      </div>
      <div className={`${COL.type} shrink-0 p-1.5 text-sm`}>
        <Badge
          variant={row.type === "income" ? "default" : row.type === "transfer" ? "outline" : "secondary"}
          className="text-xs"
        >
          {row.type === "income" ? "Income" : row.type === "transfer" ? "Transfer" : "Expense"}
        </Badge>
      </div>
      <div className={`${COL.category} shrink-0 p-1.5 text-sm text-muted-foreground truncate`}>
        {row.category_name ?? "--"}
      </div>
      <div className={`${COL.account} shrink-0 p-1.5 text-sm text-muted-foreground truncate`}>
        {row.account_name ?? "--"}
      </div>
      <div className={`${COL.memo} shrink-0 p-1.5 text-sm text-muted-foreground`}>--</div>
      <div className={`${COL.balance} shrink-0 p-1.5 text-sm font-mono tabular-nums ${balance !== null && balance < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
        {balance !== null ? fmt(balance) : "--"}
      </div>
      <div className={`${COL.actions} shrink-0 p-1.5`}>
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
      </div>
    </div>
  );
}

// -- Today Divider --

function TodayDivider() {
  return (
    <div
      className="flex items-center border-b border-border bg-amber-50/60 dark:bg-amber-950/20"
      style={{ height: 40 }}
    >
      <div className="w-full flex items-center gap-3 px-4">
        <div className="flex-1 h-px bg-amber-400/60" />
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
          Today &mdash; {toDateStr(new Date())}
        </span>
        <div className="flex-1 h-px bg-amber-400/60" />
      </div>
    </div>
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
  const parentRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

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

  function handlePreset(preset: DatePreset) {
    const range = applyPreset(preset);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

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
        event_id: t.event_id ?? undefined,
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
    // Build set of confirmed event+date combos to dedup projected rows
    const confirmedKeys = new Set<string>();
    for (const h of historicalRows) {
      if (h.event_id) {
        confirmedKeys.add(`${h.event_id}|${h.date}`);
      }
    }

    // Remove projected rows that have been confirmed as real transactions
    const filteredProjected = projectedUnified.filter(
      (r) => !r.event_id || !confirmedKeys.has(`${r.event_id}|${r.date}`)
    );

    let rows: UnifiedRow[] = [...historicalRows, ...filteredProjected];

    // Date range filter
    if (dateFrom) {
      rows = rows.filter((r) => r.date >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((r) => r.date <= dateTo);
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
  }, [historicalRows, projectedUnified, dateFrom, dateTo, filterAccountId, search, sortField, sortDir]);

  // Build display rows with today divider inserted
  const { displayRows, todayIndex } = useMemo(() => {
    const todayStr = toDateStr(new Date());
    const result: DisplayRow[] = [];
    let foundTodayIdx = -1;
    let dividerInserted = false;

    // Only insert the today divider when sorting by date ascending
    const shouldInsertDivider = sortField === "date" && sortDir === "asc";

    for (let i = 0; i < mergedRows.length; i++) {
      const row = mergedRows[i];

      if (shouldInsertDivider && !dividerInserted && row.date >= todayStr) {
        // Insert divider before the first row that is >= today
        // but only if the previous row was < today (avoid divider at very start if all rows are future)
        const prevRow = i > 0 ? mergedRows[i - 1] : null;
        if (prevRow === null || prevRow.date < todayStr) {
          foundTodayIdx = result.length;
          result.push({ kind: "today-divider" });
          dividerInserted = true;
        }
      }

      result.push({ kind: "data", row });
    }

    // If no divider was inserted but we should have one (all rows are past)
    // place it at the end
    if (shouldInsertDivider && !dividerInserted && mergedRows.length > 0) {
      foundTodayIdx = result.length;
      result.push({ kind: "today-divider" });
    }

    return { displayRows: result, todayIndex: foundTodayIdx };
  }, [mergedRows, sortField, sortDir]);

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

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const displayRow = displayRows[index];
      if (displayRow.kind === "today-divider") return 40;
      if (displayRow.kind === "data" && displayRow.row.source === "historical" && editingId === displayRow.row.id) {
        return 56;
      }
      return 40;
    },
    overscan: 10,
  });

  // Scroll to today on mount
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (todayIndex >= 0 && !hasScrolledRef.current) {
      // Small delay to let the virtualizer initialize
      const timer = setTimeout(() => {
        virtualizer.scrollToIndex(todayIndex, { align: "start" });
        hasScrolledRef.current = true;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [todayIndex, virtualizer]);

  function handleJumpToToday() {
    if (todayIndex >= 0) {
      virtualizer.scrollToIndex(todayIndex, { align: "start" });
    }
  }

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

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range inputs */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">From</label>
          <input
            type="date"
            className="h-8 rounded border border-input bg-transparent px-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <label className="text-xs text-muted-foreground">To</label>
          <input
            type="date"
            className="h-8 rounded border border-input bg-transparent px-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        {/* Preset buttons */}
        <div className="inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5">
          {(
            [
              { value: "this-month", label: "This Month" },
              { value: "this-quarter", label: "This Quarter" },
              { value: "this-year", label: "This Year" },
              { value: "all-time", label: "All Time" },
            ] as { value: DatePreset; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => handlePreset(opt.value)}
              className="px-2.5 py-1 text-xs font-medium rounded-sm transition-colors text-muted-foreground hover:text-foreground"
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

      {/* Virtualized Table */}
      <div className="rounded-md border border-border relative">
        {/* Sticky Header */}
        <div className="flex items-center border-b border-border bg-muted/50 text-sm font-medium text-muted-foreground sticky top-0 z-10" style={{ height: 36 }}>
          <div className={`${COL.source} shrink-0 px-1.5`}>Source</div>
          <div
            className={`${COL.date} shrink-0 px-1.5 cursor-pointer select-none`}
            onClick={() => toggleSort("date")}
          >
            Date{sortArrow("date")}
          </div>
          <div
            className={`${COL.name} shrink-0 px-1.5 cursor-pointer select-none`}
            onClick={() => toggleSort("name")}
          >
            Name{sortArrow("name")}
          </div>
          <div
            className={`${COL.amount} shrink-0 px-1.5 cursor-pointer select-none`}
            onClick={() => toggleSort("amount")}
          >
            Amount{sortArrow("amount")}
          </div>
          <div className={`${COL.type} shrink-0 px-1.5`}>Type</div>
          <div className={`${COL.category} shrink-0 px-1.5`}>Category</div>
          <div className={`${COL.account} shrink-0 px-1.5`}>Account</div>
          <div className={`${COL.memo} shrink-0 px-1.5`}>Memo</div>
          <div className={`${COL.balance} shrink-0 px-1.5`}>Balance</div>
          <div className={`${COL.actions} shrink-0 px-1.5`}>Actions</div>
        </div>

        {/* Scrollable virtualized body */}
        <div
          ref={parentRef}
          className="overflow-y-auto overflow-x-auto"
          style={{ height: "calc(100vh - 280px)" }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualRow) => {
              const displayRow = displayRows[virtualRow.index];

              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {displayRow.kind === "today-divider" ? (
                    <TodayDivider />
                  ) : displayRow.row.source === "historical" ? (
                    (() => {
                      const row = displayRow.row;
                      const txn = txnMap.get(row.id);
                      if (!txn) return null;
                      if (editingId === row.id) {
                        return (
                          <EditableRowEditing
                            txn={txn}
                            accounts={accounts}
                            categories={categories}
                            onCancelEdit={() => setEditingId(null)}
                            onSave={handleSave}
                            isSaving={isPending}
                          />
                        );
                      }
                      return (
                        <EditableRowDisplay
                          txn={txn}
                          onStartEdit={() => setEditingId(row.id)}
                          onDelete={handleDelete}
                          rowIndex={virtualRow.index}
                        />
                      );
                    })()
                  ) : (
                    <ProjectedRowView
                      row={displayRow.row}
                      balance={balanceMap.get(displayRow.row.id) ?? null}
                      onConfirm={handleConfirm}
                      isConfirming={isPending}
                      rowIndex={virtualRow.index}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Jump to Today floating button */}
        {todayIndex >= 0 && (
          <button
            type="button"
            onClick={handleJumpToToday}
            className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-amber-600 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Jump to Today
          </button>
        )}
      </div>

      {/* Row counts */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          Showing {mergedRows.length} rows ({historicalCount} historical, {projectedCount} projected)
        </span>
      </div>
    </div>
  );
}
