// ============================================================================
// LivePulse client-side shared helpers.
// ============================================================================

import type { Performer, RadiusUnit, MusixmatchQuote, MoodKey } from "./types";

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
 * Picks the single best quote to show for an artist given the selected mood.
 * Prefers a quote whose moods include the preferred mood; falls back to first.
 */
export function pickArtistQuote(
  performer: Performer,
  preferredMood?: MoodKey,
): MusixmatchQuote | null {
  if (performer.quotes.length === 0) return null;
  if (preferredMood) {
    const moodMatch = performer.quotes.find((q) =>
      q.moods.includes(preferredMood),
    );
    if (moodMatch) return moodMatch;
  }
  return performer.quotes[0];
}
