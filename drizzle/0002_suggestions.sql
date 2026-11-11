CREATE TABLE "suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"message" text NOT NULL,
	"fingerprint" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"reviewer_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suggestion_queue_idx" ON "suggestions" USING btree ("status","created_at");