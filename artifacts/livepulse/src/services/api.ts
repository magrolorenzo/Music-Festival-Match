// ============================================================================
// LivePulse client-side fallback + shared helpers.
//
// The live pipeline now runs server-side in api-server (see services/search.ts,
// which calls the generated /api/search client). This module retains only:
//   - the bundled mock dataset + its validation (offline fallback)
//   - `fetchFestivals`, used when the server is unreachable
//   - pure helpers reused across the UI (radiusToKm, haversineKm, pickArtistQuote)
//
// All third-party keys live as server secrets; the frontend holds no API keys.
// ============================================================================

import mockData from "@/data/festivals_mock.json";
import { GENRES, MOODS } from "@/lib/taxonomy";
import type {
  LiveEvent,
  Performer,
  GeoLocation,
  RadiusUnit,
  MusixmatchQuote,
  MoodKey,
} from "./types";

// Derived from the taxonomy so the mock validator can never drift from the
// canonical genre/mood keys the rest of the app uses.
const VALID_GENRE_KEYS = new Set<string>(GENRES.map((g) => g.key));
const VALID_MOOD_KEYS = new Set<string>(MOODS.map((m) => m.key));

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
 * Offline fallback: filters the bundled mock dataset by the geo + date window.
 * Used only when the api-server is unreachable; the live pipeline runs entirely
 * server-side (see services/search.ts).
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
