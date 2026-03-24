import type { InferSelectModel } from "drizzle-orm";
import type { accounts, cashflowEvents, categories, transactions } from "./schema";
import type { Account, CashflowEvent, Category, Transaction } from "@/lib/types/database";

type AccountRow = InferSelectModel<typeof accounts>;
type EventRow = InferSelectModel<typeof cashflowEvents>;
type CategoryRow = InferSelectModel<typeof categories>;
type TransactionRow = InferSelectModel<typeof transactions>;

export function toAccount(r: AccountRow): Account {
  return {
    id: r.id,
    user_id: r.userId,
    name: r.name,
    account_type: r.accountType as Account["account_type"],
    current_balance: Number(r.currentBalance),
    currency: r.currency,
    is_active: r.isActive,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

export function toEvent(r: EventRow): CashflowEvent {
  return {
    id: r.id,
    user_id: r.userId,
    account_id: r.accountId,
    category_id: r.categoryId,
    name: r.name,
    event_type: r.eventType as CashflowEvent["event_type"],
    amount: Number(r.amount),
    event_date: r.eventDate,
    is_recurring: r.isRecurring,
    recurrence_rule: r.recurrenceRule as CashflowEvent["recurrence_rule"],
    notes: r.notes,
    is_active: r.isActive,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

export function toCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    user_id: r.userId,
    name: r.name,
    parent_id: r.parentId,
    created_at: r.createdAt.toISOString(),
  };
}

export function toTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    user_id: r.userId,
    account_id: r.accountId,
    import_session_id: r.importSessionId,
    category_id: r.categoryId,
    transaction_date: r.transactionDate,
    amount: Number(r.amount),
    payee: r.payee,
    payee_normalized: r.payeeNormalized,
    memo: r.memo,
    check_number: r.checkNumber,
    transaction_type: r.transactionType as "income" | "expense",
    source: r.source,
    event_id: r.eventId,
    suggested_event_id: r.suggestedEventId,
    is_cleared: r.isCleared,
    original_category: r.originalCategory,
    is_flagged: r.isFlagged,
    flag_reason: r.flagReason,
    created_at: r.createdAt.toISOString(),
  };
}
