CREATE TABLE "event_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"original_date" date NOT NULL,
	"override_amount" numeric(12, 2),
	"override_date" date,
	"is_skipped" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_overrides" ADD CONSTRAINT "event_overrides_event_id_cashflow_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."cashflow_events"("id") ON DELETE cascade ON UPDATE no action;