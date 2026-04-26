import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  date,
  jsonb,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  sub: text("sub").unique().notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  accountType: text("account_type").notNull(),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }).default("0").notNull(),
  currency: text("currency").default("USD").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  categoryType: text("category_type"),
  budgetLimit: numeric("budget_limit", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cashflowEvents = pgTable("cashflow_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  accountId: uuid("account_id").references(() => accounts.id).notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  name: text("name").notNull(),
  eventType: text("event_type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  eventDate: date("event_date").notNull(),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurrenceRule: jsonb("recurrence_rule"),
  notes: text("notes"),
  destinationAccountId: uuid("destination_account_id").references(() => accounts.id),
  loanConfig: jsonb("loan_config"),
  actualAmount: numeric("actual_amount", { precision: 12, scale: 2 }),
  occurredDate: date("occurred_date"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const eventTemplates = pgTable("event_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  eventType: text("event_type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  accountId: uuid("account_id").references(() => accounts.id),
  categoryId: uuid("category_id").references(() => categories.id),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurrenceRule: jsonb("recurrence_rule"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scenarios = pgTable("scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  balanceAdjustments: jsonb("balance_adjustments"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scenarioEvents = pgTable("scenario_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenarioId: uuid("scenario_id").references(() => scenarios.id, { onDelete: "cascade" }).notNull(),
  eventId: uuid("event_id").references(() => cashflowEvents.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'exclude' | 'modify' | 'add'
  name: text("name"),
  eventType: text("event_type"),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  eventDate: date("event_date"),
  accountId: uuid("account_id").references(() => accounts.id),
  isRecurring: boolean("is_recurring"),
  recurrenceRule: jsonb("recurrence_rule"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const eventOverrides = pgTable("event_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => cashflowEvents.id, { onDelete: "cascade" }).notNull(),
  originalDate: date("original_date").notNull(),
  overrideAmount: numeric("override_amount", { precision: 12, scale: 2 }),
  overrideDate: date("override_date"),
  isSkipped: boolean("is_skipped").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const importSessions = pgTable("import_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  source: text("source").notNull(),
  filename: text("filename").notNull(),
  accountId: uuid("account_id").references(() => accounts.id),
  transactionCount: integer("transaction_count").default(0).notNull(),
  status: text("status").default("pending").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const plaidItems = pgTable("plaid_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  itemId: text("item_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  cursor: text("cursor"),
  accountId: uuid("account_id").references(() => accounts.id),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  accountId: uuid("account_id").references(() => accounts.id).notNull(),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  categoryId: uuid("category_id").references(() => categories.id),
  transactionDate: date("transaction_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  payee: text("payee"),
  payeeNormalized: text("payee_normalized"),
  memo: text("memo"),
  checkNumber: text("check_number"),
  transactionType: text("transaction_type").notNull(),
  source: text("source").notNull(),
  eventId: uuid("event_id").references(() => cashflowEvents.id),
  suggestedEventId: uuid("suggested_event_id").references(() => cashflowEvents.id),
  isCleared: boolean("is_cleared").default(false).notNull(),
  originalCategory: text("original_category"),
  isFlagged: boolean("is_flagged").default(false).notNull(),
  flagReason: text("flag_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
