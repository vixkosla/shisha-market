ALTER TABLE "listings" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD COLUMN "listing_revision" integer DEFAULT 1 NOT NULL;