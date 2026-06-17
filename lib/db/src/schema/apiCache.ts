import { pgTable, text, serial, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Generic API response cache for all external partner services.
 * Stores raw JSON responses keyed by service + deterministic cache key,
 * with a 30-day TTL so repeated calls are served from DB rather than re-hitting
 * the upstream API.
 */
export const apiCacheTable = pgTable(
  "api_cache",
  {
    id: serial("id").primaryKey(),
    /** Service identifier, e.g. "jambase", "songstats", "musixmatch", "nominatim". */
    serviceKey: text("service_key").notNull(),
    /** Deterministic lookup key (e.g. URL or hashed parameters). */
    cacheKey: text("cache_key").notNull(),
    /** Raw JSON response body stored as JSONB. */
    data: jsonb("data").notNull(),
    /** Row is stale once now() passes this instant. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("service_cache_key").on(table.serviceKey, table.cacheKey),
  ],
);

export const insertApiCacheSchema = createInsertSchema(
  apiCacheTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApiCache = z.infer<typeof insertApiCacheSchema>;
export type ApiCache = typeof apiCacheTable.$inferSelect;
