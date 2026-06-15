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
  GeoLocation,
  RadiusUnit,
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

const KM_PER_MILE = 1.60934;
const EARTH_RADIUS_KM = 6371;

/** Converts a radius in mi/km to kilometres. */
export function radiusToKm(radius: number, unit: RadiusUnit): number {
  return unit === "mi" ? radius * KM_PER_MILE : radius;
}

/** Great-circle distance in kilometres between two lat/lon points. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Geocodes free-text place names ("Europe", "Verona, Italy") to coordinates
 * using OpenStreetMap's Nominatim service — keyless and usable directly from
 * the browser, keeping LivePulse frontend-only. Returns null when the place
 * cannot be resolved, and throws on network failure so callers can surface it.
 *
 * LIVE SWAP: a production build would proxy this through the backend with a
 * proper User-Agent and rate limiting per Nominatim's usage policy.
 */
export async function geocodeLocation(
  query: string,
): Promise<GeoLocation | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`);
  }
  const hits = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  if (!Array.isArray(hits) || hits.length === 0) return null;

  const [hit] = hits;
  return {
    query: trimmed,
    label: hit.display_name,
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
  };
}

export interface FetchFestivalsParams {
  /** Resolved search center; null means no geo restriction (global). */
  location: GeoLocation | null;
  /** Radius around the search center, in kilometres. Ignored when global. */
  radiusKm: number;
  /** ISO date (inclusive). Maps to JamBase eventDateFrom. */
  startDate: string;
  /** ISO date (inclusive). Maps to JamBase eventDateTo. */
  endDate: string;
}

/**
 * JamBase `/events` — returns live events within a date window and (optionally)
 * a geo radius around a resolved location.
 *
 * LIVE SWAP: replace the mock filter below with:
 *   const url = new URL(`${API_CONFIG.jambase.baseUrl}/events`);
 *   url.searchParams.set("apikey", API_CONFIG.jambase.apiKey);
 *   url.searchParams.set("eventDateFrom", startDate);
 *   url.searchParams.set("eventDateTo", endDate);
 *   if (location) {
 *     url.searchParams.set("geoLatitude", String(location.latitude));
 *     url.searchParams.set("geoLongitude", String(location.longitude));
 *     url.searchParams.set("geoRadiusAmount", String(radiusKm));
 *     url.searchParams.set("geoRadiusUnits", "km");
 *   }
 *   const res = await fetch(url); ... map res.events -> LiveEvent[]
 */
export async function fetchFestivals(
  params: FetchFestivalsParams,
): Promise<LiveEvent[]> {
  const { location, radiusKm, startDate, endDate } = params;
  const from = new Date(startDate).getTime();
  const to = new Date(endDate).getTime();

  const filtered = events.filter((event) => {
    const inRadius =
      !location ||
      haversineKm(
        location.latitude,
        location.longitude,
        event.location.latitude,
        event.location.longitude,
      ) <= radiusKm;
    const ts = new Date(event.startDate).getTime();
    const inWindow = ts >= from && ts <= to;
    return inRadius && inWindow;
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
