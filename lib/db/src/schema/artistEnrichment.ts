import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Shape of the per-artist enrichment blob cached from the Songstats + Musixmatch
 * cascade. Stored as JSONB so the server can read it back without re-hitting the
 * partner APIs while the row is still within its TTL.
 */
export interface ArtistEnrichmentData {
  songstats: {
    popularityTrend: string;
    monthlyListeners: number;
    popularityScore: number;
  };
  recommendedSongs: Array<{
    trackName: string;
    popularity: number;
    moodKeys: string[];
  }>;
  quotes: Array<{
    trackName: string;
    mood: string;
    lyrics_body: string;
    script_tracking_url: string;
  }>;
  moodKeys: string[];
  /** Marks rows where one or more partner calls degraded to placeholders. */
  partial: boolean;
}

export const artistEnrichmentTable = pgTable("artist_enrichment", {
  id: serial("id").primaryKey(),
  /** Normalized lookup key, e.g. lowercased + trimmed artist name. */
  artistKey: text("artist_key").notNull().unique(),
  artistName: text("artist_name").notNull(),
  data: jsonb("data").$type<ArtistEnrichmentData>().notNull(),
  /** Row is stale once now() passes this instant. */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertArtistEnrichmentSchema = createInsertSchema(
  artistEnrichmentTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArtistEnrichment = z.infer<
  typeof insertArtistEnrichmentSchema
>;
export type ArtistEnrichment = typeof artistEnrichmentTable.$inferSelect;
