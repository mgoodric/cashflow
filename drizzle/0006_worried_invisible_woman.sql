ALTER TABLE "event_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plaid_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "event_templates" CASCADE;--> statement-breakpoint
DROP TABLE "plaid_items" CASCADE;--> statement-breakpoint
ALTER TABLE "cashflow_events" DROP CONSTRAINT "cashflow_events_destination_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "cashflow_events" DROP COLUMN "destination_account_id";--> statement-breakpoint
ALTER TABLE "cashflow_events" DROP COLUMN "actual_amount";--> statement-breakpoint
ALTER TABLE "cashflow_events" DROP COLUMN "occurred_date";--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "budget_limit";