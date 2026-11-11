CREATE TABLE "agent_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_connections_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "agent_pairings" (
	"id" text PRIMARY KEY NOT NULL,
	"secret_hash" text NOT NULL,
	"user_code" text NOT NULL,
	"name" text NOT NULL,
	"fingerprint" text NOT NULL,
	"user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_pairings_secret_hash_unique" UNIQUE("secret_hash")
);
--> statement-breakpoint
ALTER TABLE "agent_connections" ADD CONSTRAINT "agent_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pairings" ADD CONSTRAINT "agent_pairings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_connection_user_idx" ON "agent_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_pairing_fingerprint_idx" ON "agent_pairings" USING btree ("fingerprint","created_at");