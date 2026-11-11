import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  check,
  jsonb,
} from "drizzle-orm/pg-core";

const dates = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
export const userRole = pgEnum("user_role", ["member", "moderator", "admin"]);
export const listingStatus = pgEnum("listing_status", [
  "pending",
  "published",
  "rejected",
  "archived",
]);
export const condition = pgEnum("item_condition", ["new", "used"]);

export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: userRole("role").default("member").notNull(),
  ...dates(),
});
export const session = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    ...dates(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...dates(),
  },
  (t) => [
    uniqueIndex("account_provider_idx").on(t.providerId, t.accountId),
    index("account_user_idx").on(t.userId),
  ],
);
export const verification = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...dates(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// Separate from browser sessions and the operator credential. Only digests are stored.
export const agentConnections = pgTable("agent_connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, {onDelete: "cascade"}).notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").unique().notNull(),
  expiresAt: timestamp("expires_at", {withTimezone: true}).notNull(),
  revokedAt: timestamp("revoked_at", {withTimezone: true}),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
}, t => [index("agent_connection_user_idx").on(t.userId)]);

export const agentPairings = pgTable("agent_pairings", {
  id: text("id").primaryKey(),
  secretHash: text("secret_hash").unique().notNull(),
  userCode: text("user_code").notNull(),
  name: text("name").notNull(),
  fingerprint: text("fingerprint").notNull(),
  userId: text("user_id").references(() => user.id, {onDelete: "cascade"}),
  expiresAt: timestamp("expires_at", {withTimezone: true}).notNull(),
  approvedAt: timestamp("approved_at", {withTimezone: true}),
  consumedAt: timestamp("consumed_at", {withTimezone: true}),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
}, t => [index("agent_pairing_fingerprint_idx").on(t.fingerprint, t.createdAt)]);

export const listings = pgTable(
  "listings",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .references(() => user.id)
      .notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    // Second level of the catalog and the make: optional, filled from the form or its smart reading.
    subcategory: text("subcategory"),
    brand: text("brand"),
    model: text("model"),
    country: text("country").default("RU").notNull(),
    city: text("city").notNull(),
    priceKopecks: integer("price_kopecks").notNull(),
    condition: condition("condition").notNull(),
    contactUrl: text("contact_url").notNull(),
    contactConditions: text("contact_conditions").default("").notNull(),
    legalVersion: text("legal_version"),
    status: listingStatus("status").default("pending").notNull(),
    revision: integer("revision").default(1).notNull(),
    moderationNote: text("moderation_note"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    vkPostId: text("vk_post_id"),
    ...dates(),
  },
  (t) => [
    index("listing_public_idx").on(t.status, t.publishedAt, t.id),
    index("listing_owner_idx").on(t.ownerId, t.createdAt),
    index("listing_filter_idx").on(t.status, t.category, t.city),
    index("listing_search_idx").using(
      "gin",
      sql`to_tsvector('russian', ${t.title} || ' ' || ${t.description})`,
    ),
    check("listing_price_nonnegative", sql`${t.priceKopecks} >= 0`),
  ],
);
export const photos = pgTable(
  "listing_photos",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .references(() => listings.id, { onDelete: "cascade" })
      .notNull(),
    storageKey: text("storage_key").notNull().unique(),
    position: integer("position").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
  },
  (t) => [uniqueIndex("photo_position_idx").on(t.listingId, t.position)],
);
export const favorites = pgTable(
  "favorites",
  {
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    listingId: text("listing_id")
      .references(() => listings.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);
export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .references(() => listings.id)
      .notNull(),
    actorId: text("actor_id")
      .references(() => user.id)
      .notNull(),
    decision: listingStatus("decision").notNull(),
    listingRevision: integer("listing_revision").default(1).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("moderation_listing_idx").on(t.listingId)],
);

export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id)
      .notNull(),
    kind: text("kind").notNull(),
    version: text("version").notNull(),
    listingId: text("listing_id").references(() => listings.id),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("legal_acceptance_user_idx").on(t.userId, t.createdAt)],
);

export const supportRequests = pgTable(
  "support_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id)
      .notNull(),
    listingId: text("listing_id").references(() => listings.id),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    status: text("status").default("open").notNull(),
    resolution: text("resolution"),
    reviewerId: text("reviewer_id").references(() => user.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("support_queue_idx").on(t.status, t.createdAt)],
);
export const suggestions = pgTable(
  "suggestions",
  {
    id: text("id").primaryKey(),
    contact: text("contact").default("").notNull(),
    message: text("message").notNull(),
    fingerprint: text("fingerprint").default("").notNull(),
    status: text("status").default("open").notNull(),
    resolution: text("resolution"),
    reviewerId: text("reviewer_id").references(() => user.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("suggestion_queue_idx").on(t.status, t.createdAt)],
);
