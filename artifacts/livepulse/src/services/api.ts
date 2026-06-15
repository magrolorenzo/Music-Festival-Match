// ============================================================================
// LivePulse API abstraction layer
//
// This is the single seam between the UI and the partner data sources. Today it
// resolves everything from a bundled mock JSON file. When live API keys are
// available, ONLY the request transport inside each function changes — the
// function signatures, query parameters and returned data models below are
// already shaped around the official partner schemas:
//
//   - JamBase    GET /events            -> fetchFestivals({ location, startDate, endDate })
//   - Cyanite    GraphQL musicAnalysis  -> fetchMusicAnalysis(artistId)
//   - Musixmatch GET track + lyrics     -> getTrackQuote(trackName, artistName)
//
// Swap notes for going live are inlined at each function.
// ============================================================================

import mockData from "@/data/festivals_mock.json";
import type {
  LiveEvent,
  Performer,
  LocationFilter,
  RegionKey,
  CyaniteAnalysis,
  MusixmatchQuote,
  MoodKey,
} from "./types";

// ----- Config (swap these for live mode) ------------------------------------

export const API_CONFIG = {
  jambase: {
    baseUrl: "https://www.jambase.com/jb-api/v1",
    apiKey: import.meta.env.VITE_JAMBASE_API_KEY ?? "",
  },
  cyanite: {
    baseUrl: "https://api.cyanite.ai/graphql",
    accessToken: import.meta.env.VITE_CYANITE_ACCESS_TOKEN ?? "",
  },
  musixmatch: {
    baseUrl: "https://api.musixmatch.com/ws/1.1",
    apiKey: import.meta.env.VITE_MUSIXMATCH_API_KEY ?? "",
  },
} as const;

/** Whether any live keys are present. When false, the layer serves mock data. */
export const isLiveMode = Boolean(
  API_CONFIG.jambase.apiKey &&
    API_CONFIG.cyanite.accessToken &&
    API_CONFIG.musixmatch.apiKey,
);

const VALID_GENRE_KEYS = new Set<string>([
  "rock",
  "pop",
  "electronic",
  "hip-hop",
  "jazz",
]);
const VALID_MOOD_KEYS = new Set<string>([
  "energetic",
  "chill",
  "emotional",
  "dark",
]);

/**
 * Runtime guard for the bundled mock dataset. TypeScript cannot verify the
 * shape of imported JSON, so we assert the taxonomy keys here. Records with
 * unknown genre/mood keys are dropped (and warned about) so the matching layer
 * never consumes structurally-invalid data. When live mode lands, the same
 * validation should run against the partner API responses.
 */
function validateEvents(raw: unknown): LiveEvent[] {
  const list = (raw as { events?: LiveEvent[] }).events;
  if (!Array.isArray(list)) {
    console.error("[LivePulse] mock dataset is missing an `events` array");
    return [];
  }
  return list.filter((event) => {
    const performers = event.performers ?? [];
    for (const performer of performers) {
      const badGenres = (performer.cyanite?.genreKeys ?? []).filter(
        (k) => !VALID_GENRE_KEYS.has(k),
      );
      const badMoods = [
        ...(performer.cyanite?.moodKeys ?? []),
        ...(performer.recommendedSongs ?? []).flatMap((s) => s.moodKeys ?? []),
      ].filter((k) => !VALID_MOOD_KEYS.has(k));
      if (badGenres.length || badMoods.length) {
        console.error(
          `[LivePulse] dropping event "${event.name}" — invalid keys for ${performer.name}:`,
          { genres: badGenres, moods: badMoods },
        );
        return false;
      }
    }
    return true;
  });
}

const events: LiveEvent[] = validateEvents(mockData);

// Simulate realistic network latency so loading states are visible.
function delay<T>(value: T, ms = 650): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Region centroids used to model JamBase's geoLatitude / geoLongitude / geoRadius
// query parameters. A real call would pass these straight through to /events.
const REGION_GEO: Record<RegionKey, { lat: number; lon: number; radiusKm: number }> = {
  europe: { lat: 50.0, lon: 10.0, radiusKm: 2500 },
  "north-america": { lat: 39.5, lon: -98.35, radiusKm: 4500 },
};

export interface FetchFestivalsParams {
  /** App location filter; "global" means no geo restriction. */
  location: LocationFilter;
  /** ISO date (inclusive). Maps to JamBase eventDateFrom. */
  startDate: string;
  /** ISO date (inclusive). Maps to JamBase eventDateTo. */
  endDate: string;
}

/**
 * JamBase `/events` — returns live events within a date window and (optionally)
 * a geo radius.
 *
 * LIVE SWAP: replace the mock filter below with:
 *   const geo = location === "global" ? {} : REGION_GEO[location];
 *   const url = new URL(`${API_CONFIG.jambase.baseUrl}/events`);
 *   url.searchParams.set("apikey", API_CONFIG.jambase.apiKey);
 *   url.searchParams.set("eventDateFrom", startDate);
 *   url.searchParams.set("eventDateTo", endDate);
 *   if (geo) {
 *     url.searchParams.set("geoLatitude", String(geo.lat));
 *     url.searchParams.set("geoLongitude", String(geo.lon));
 *     url.searchParams.set("geoRadiusAmount", String(geo.radiusKm));
 *     url.searchParams.set("geoRadiusUnits", "km");
 *   }
 *   const res = await fetch(url); ... map res.events -> LiveEvent[]
 */
export async function fetchFestivals(
  params: FetchFestivalsParams,
): Promise<LiveEvent[]> {
  const { location, startDate, endDate } = params;
  const from = new Date(startDate).getTime();
  const to = new Date(endDate).getTime();

  const filtered = events.filter((event) => {
    const inRegion = location === "global" || event.region === location;
    const ts = new Date(event.startDate).getTime();
    const inWindow = ts >= from && ts <= to;
    return inRegion && inWindow;
  });

  return delay(filtered);
}

/** Returns every event regardless of filters (used for the global map view). */
export async function fetchAllEvents(): Promise<LiveEvent[]> {
  return delay(events, 300);
}

/**
 * Cyanite music analysis for a single artist.
 *
 * LIVE SWAP: POST a GraphQL query to API_CONFIG.cyanite.baseUrl:
 *   query { libraryTrack(id: $artistId) {
 *     audioAnalysisV7 { result { genre { ... } mood { ... } valence energy } }
 *   } }
 * with header Authorization: `Bearer ${API_CONFIG.cyanite.accessToken}`,
 * then map the result into CyaniteAnalysis.
 */
export async function fetchMusicAnalysis(
  artistId: string,
): Promise<CyaniteAnalysis | null> {
  for (const event of events) {
    const performer = event.performers.find((p) => p.id === artistId);
    if (performer) return delay(performer.cyanite, 200);
  }
  return delay(null, 200);
}

/**
 * Musixmatch track + lyric quote lookup. Returns the best quote for the
 * requested track, optionally biased toward a target mood.
 *
 * LIVE SWAP: call matcher.track.get + track.lyrics.get on
 * API_CONFIG.musixmatch.baseUrl with `apikey`, reading `lyrics_body` and
 * `script_tracking_url` from the response (legal snippet only).
 */
export async function getTrackQuote(
  trackName: string,
  artistName: string,
  preferredMood?: MoodKey,
): Promise<MusixmatchQuote | null> {
  const performer = findPerformerByName(artistName);
  if (!performer) return delay(null, 150);

  const byTrack = performer.quotes.find((q) => q.trackName === trackName);
  const byMood = preferredMood
    ? performer.quotes.find((q) => q.mood === preferredMood)
    : undefined;

  return delay(byTrack ?? byMood ?? performer.quotes[0] ?? null, 150);
}

/**
 * Picks the single best quote to show for an artist given the selected mood:
 * a quote that matches the mood, else the quote from the most popular track.
 */
export function pickArtistQuote(
  performer: Performer,
  preferredMood?: MoodKey,
): MusixmatchQuote | null {
  if (performer.quotes.length === 0) return null;
  if (preferredMood) {
    const moodMatch = performer.quotes.find((q) => q.mood === preferredMood);
    if (moodMatch) return moodMatch;
  }
  // Fall back to the quote tied to the artist's most popular recommended song,
  // else the first available quote.
  const topSong = [...performer.recommendedSongs].sort(
    (a, b) => b.popularity - a.popularity,
  )[0];
  if (topSong) {
    const tied = performer.quotes.find((q) => q.trackName === topSong.trackName);
    if (tied) return tied;
  }
  return performer.quotes[0];
}

function findPerformerByName(name: string): Performer | undefined {
  for (const event of events) {
    const performer = event.performers.find((p) => p.name === name);
    if (performer) return performer;
  }
  return undefined;
}

export { REGION_GEO };
