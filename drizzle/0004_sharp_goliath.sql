ALTER TABLE "cashflow_events" ADD COLUMN "actual_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "cashflow_events" ADD COLUMN "occurred_date" date;