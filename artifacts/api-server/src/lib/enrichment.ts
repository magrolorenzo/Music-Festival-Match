import type { MoodKey } from "@workspace/api-zod";
import { normalizeArtistName, fetchArtistTracks } from "./musixmatch";
import { readCache, writeCache } from "./cache";
import { mapMoods } from "./taxonomy";
import { logger } from "./logger";

// ============================================================================
// Per-artist Musixmatch enrichment with api_cache TTL.
//
// For each artist we run track.search → track.lyrics.analysis.get (for tracks
// with lyrics), cache the assembled result in api_cache under the key
// "artist:{normalizedName}" (30-day TTL via the shared cache helper), and
// serve from cache on subsequent queries.
//
// Songstats is intentionally excluded from this flow but remains available
// in the backend for potential future reuse.
// ============================================================================

const CACHE_SERVICE = "musixmatch-enrichment";

export interface EnrichedTrack {
  trackId: number;
  trackName: string;
  trackRating: number;
  spotifyId: string | null;
  albumName: string;
  hasLyrics: boolean;
  quote: string | null;
  moods: string[];
}

export interface EnrichedArtistData {
  tracks: EnrichedTrack[];
  moodKeys: MoodKey[];
}

const PLACEHOLDER_DATA: EnrichedArtistData = {
  tracks: [],
  moodKeys: [],
};

export const PLACEHOLDER_ENRICHMENT: EnrichedArtistData = PLACEHOLDER_DATA;

async function computeEnrichment(name: string): Promise<EnrichedArtistData> {
  const tracks = await fetchArtistTracks(name);

  const moodSet = new Set<MoodKey>();
  for (const t of tracks) {
    if (t.moods.length > 0) {
      mapMoods(t.moods).forEach((m) => moodSet.add(m));
    }
  }

  return { tracks, moodKeys: [...moodSet] };
}

/** Cache read-through wrapper for a single artist. */
export async function enrichArtist(name: string): Promise<EnrichedArtistData> {
  const normalizedName = normalizeArtistName(name);
  if (!normalizedName) return { ...PLACEHOLDER_DATA };

  const cacheKey = `artist:${normalizedName}`;

  const cached = await readCache<EnrichedArtistData>(CACHE_SERVICE, cacheKey);
  if (cached) return cached;

  let data: EnrichedArtistData;
  try {
    data = await computeEnrichment(name);
  } catch (err) {
    logger.warn({ err, name }, "artist enrichment failed; using placeholder");
    data = { ...PLACEHOLDER_DATA };
  }

  await writeCache(CACHE_SERVICE, cacheKey, data);
  return data;
}
