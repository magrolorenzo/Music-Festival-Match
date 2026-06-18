// ============================================================================
// LivePulse client-side shared helpers.
// ============================================================================

import type { Performer, RadiusUnit, MusixmatchQuote, MoodKey } from "./types";

const QUOTE_SPLIT_CHARS = /[.;\u2014\u2015\u2013\u2012\u2010\u2011]/;

/** Split a quote into 2 lines if there's a sentence break. */
export function splitQuote(quote: string): [string, string] {
  const parts = quote.split(QUOTE_SPLIT_CHARS).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(". ")];
  if (quote.length > 60) {
    const mid = Math.floor(quote.length / 2);
    const space = quote.indexOf(" ", mid - 10);
    if (space > -1 && space < mid + 10) {
      return [quote.slice(0, space).trim(), quote.slice(space + 1).trim()];
    }
  }
  return [quote, ""];
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

/** Picks up to 2 quotes to display — prefers the mood-matched quote, then fills to 2. */
export function pickArtistQuotes(
  performer: Performer,
  preferredMood?: MoodKey,
): MusixmatchQuote[] {
  if (performer.quotes.length === 0) return [];

  const picked: MusixmatchQuote[] = [];
  if (preferredMood) {
    const moodMatch = performer.quotes.find((q) =>
      q.moods.includes(preferredMood),
    );
    if (moodMatch) picked.push(moodMatch);
  }
  if (picked.length === 0) picked.push(performer.quotes[0]);
  // Fill second slot with a different quote if available
  const second = performer.quotes.find((q) => q !== picked[0]);
  if (second) picked.push(second);
  return picked;
}
