import { eq } from "drizzle-orm";
import { db, artistEnrichmentTable } from "@workspace/db";
import type { ArtistEnrichmentData } from "@workspace/db";
import type { MoodKey } from "@workspace/api-zod";
import { artistKeyOf, mapMoods } from "./taxonomy";
import { fetchArtistHype } from "./songstats";
import { fetchTrackQuote } from "./musixmatch";
import { logger } from "./logger";

// ============================================================================
// Per-artist enrichment with DB-cached TTL.
//
// For each (headliner) artist we run the Songstats -> Musixmatch cascade once,
// cache the result keyed by artist name, and serve it from the cache while the
// row is fresh. Any partner gap degrades to neutral placeholders and is flagged
// `partial` so a later run can refresh it.
// ============================================================================

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_QUOTE_TRACKS = 3;

const PLACEHOLDER: ArtistEnrichmentData = {
  songstats: { popularityTrend: "—", monthlyListeners: 0, popularityScore: 50 },
  recommendedSongs: [],
  quotes: [],
  moodKeys: [],
  partial: true,
};

async function readCache(
  artistKey: string,
): Promise<ArtistEnrichmentData | null> {
  try {
    const [row] = await db
      .select()
      .from(artistEnrichmentTable)
      .where(eq(artistEnrichmentTable.artistKey, artistKey));
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    return row.data;
  } catch (err) {
    logger.warn({ err, artistKey }, "enrichment cache read failed");
    return null;
  }
}

async function writeCache(
  artistKey: string,
  artistName: string,
  data: ArtistEnrichmentData,
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + TTL_MS);
    await db
      .insert(artistEnrichmentTable)
      .values({ artistKey, artistName, data, expiresAt })
      .onConflictDoUpdate({
        target: artistEnrichmentTable.artistKey,
        set: { artistName, data, expiresAt },
      });
  } catch (err) {
    logger.warn({ err, artistKey }, "enrichment cache write failed");
  }
}

/** Runs the live Songstats + Musixmatch cascade for one artist. */
async function computeEnrichment(name: string): Promise<ArtistEnrichmentData> {
  let partial = false;

  const hype = await fetchArtistHype(name).catch((err) => {
    logger.warn({ err, name }, "songstats lookup failed");
    return null;
  });

  const songstats = hype
    ? {
        popularityTrend: hype.popularityTrend,
        monthlyListeners: hype.monthlyListeners,
        popularityScore: hype.popularityScore,
      }
    : ((partial = true), { ...PLACEHOLDER.songstats });

  const topTracks = hype?.topTracks ?? [];

  // Musixmatch mood + quote per top track (bounded), runs after we know tracks.
  const quotes: ArtistEnrichmentData["quotes"] = [];
  const moodSet = new Set<MoodKey>();

  const trackTargets = topTracks.slice(0, MAX_QUOTE_TRACKS);
  const trackQuotes = await Promise.all(
    trackTargets.map((t) =>
      fetchTrackQuote(name, t.trackName, t.spotifyId).catch((err) => {
        logger.warn({ err, name, track: t.trackName }, "musixmatch lookup failed");
        return null;
      }),
    ),
  );

  for (const tq of trackQuotes) {
    if (!tq) {
      partial = true;
      continue;
    }
    const primaryMood: MoodKey = tq.moods[0] ?? "energetic";
    if (tq.moods.length === 0) partial = true;
    tq.moods.forEach((m) => moodSet.add(m));
    quotes.push({
      trackName: tq.trackName,
      mood: primaryMood,
      lyrics_body: tq.lyrics_body,
      script_tracking_url: tq.script_tracking_url,
    });
  }

  const recommendedSongs = topTracks.map((t) => {
    const tq = trackQuotes.find((q) => q?.trackName === t.trackName);
    return {
      trackName: t.trackName,
      popularity: t.popularity,
      moodKeys: tq?.moods ?? [],
    };
  });

  if (topTracks.length === 0) partial = true;

  return {
    songstats,
    recommendedSongs,
    quotes,
    moodKeys: [...moodSet],
    partial,
  };
}

/** Cache read-through wrapper for a single artist. */
export async function enrichArtist(
  name: string,
): Promise<ArtistEnrichmentData> {
  const key = artistKeyOf(name);
  if (!key) return { ...PLACEHOLDER };

  const cached = await readCache(key);
  if (cached) return cached;

  let data: ArtistEnrichmentData;
  try {
    data = await computeEnrichment(name);
  } catch (err) {
    logger.warn({ err, name }, "artist enrichment failed; using placeholder");
    data = { ...PLACEHOLDER };
  }

  await writeCache(key, name, data);
  return data;
}

export const PLACEHOLDER_ENRICHMENT = PLACEHOLDER;

/** Re-export so the orchestrator can normalize stray mood strings if needed. */
export { mapMoods };
