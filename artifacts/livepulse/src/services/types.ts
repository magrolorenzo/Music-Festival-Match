// ============================================================================
// LivePulse domain types
//
// These types are shaped around the combined payloads of the partner APIs:
//   - JamBase   (event / venue / performer data)
//   - Musixmatch (track search + lyrics analysis)
// ============================================================================

export type RegionKey = "europe" | "north-america";

export type GenreKey =
  | "blues"
  | "classical"
  | "country-music"
  | "edm"
  | "folk"
  | "hip-hop-rap"
  | "indie"
  | "jazz"
  | "kpop"
  | "latin"
  | "metal"
  | "pop"
  | "punk"
  | "rhythm-and-blues-soul"
  | "reggae"
  | "rock";

export type MoodKey =
  | "love"
  | "heartbreak"
  | "joy"
  | "empowerment"
  | "angst"
  | "reflection"
  | "inspiration"
  | "nostalgia"
  | "despair"
  | "celebration"
  | "anger"
  | "peace"
  | "solitude"
  | "adventure"
  | "social-commentary"
  | "hope"
  | "spirituality"
  | "freedom"
  | "party"
  | "nature";

/** Distance unit for the location search radius. */
export type RadiusUnit = "km" | "mi";

/**
 * A free-text place the user searched, resolved to coordinates by the geocoder.
 */
export interface GeoLocation {
  query: string;
  label: string;
  latitude: number;
  longitude: number;
}

export type EventKind = "festival" | "concert";

/** JamBase-shaped geo location object. */
export interface JamBaseLocation {
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

/** Genre + mood analysis attached to a performer. */
export interface CyaniteAnalysis {
  musicGenres: string[];
  genreKeys: GenreKey[];
  audioValence: number;
  audioEnergy: number;
  /** Mood keys aggregated from Musixmatch lyrics analysis across all tracks. */
  moodKeys: MoodKey[];
}

/** A Musixmatch top track for a performer. */
export interface Track {
  trackId: number;
  trackName: string;
  /** Musixmatch popularity rating. */
  trackRating: number;
  /** Spotify track ID — stored for future playback integration. */
  spotifyId: string | null;
  albumName: string;
}

/** A Musixmatch quote with moods derived from lyrics analysis. */
export interface MusixmatchQuote {
  trackName: string;
  /** Mood keys derived from lyrics analysis for this track. */
  moods: MoodKey[];
  /** First available theme quote from lyrics analysis. */
  quote: string;
}

/** A performer on an event (JamBase `performers[]` enriched with Musixmatch data). */
export interface Performer {
  id: string;
  name: string;
  image: string | null;
  isHeadliner: boolean;
  cyanite: CyaniteAnalysis;
  /** Top tracks from Musixmatch (up to 3). */
  tracks: Track[];
  /** One quote per track that has lyrics, from lyrics analysis. */
  quotes: MusixmatchQuote[];
}

/** A live music event (JamBase `/events` entry, enriched). */
export interface LiveEvent {
  id: string;
  kind: EventKind;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  image: string | null;
  region: RegionKey;
  location: JamBaseLocation;
  geoRadiusKm: number;
  performers: Performer[];
  genreKeys: GenreKey[];
  moodKeys: MoodKey[];
}

export interface SearchFilters {
  location: GeoLocation | null;
  radius: number;
  radiusUnit: RadiusUnit;
  genres: GenreKey[];
  moods: MoodKey[];
  startDate: string;
  endDate: string;
}

export interface MatchReason {
  type: "genre" | "mood" | "location" | "period";
  key: string;
  label: string;
}

export interface MatchResult {
  event: LiveEvent;
  score: number;
  isExactMatch: boolean;
  reasons: MatchReason[];
  matchedGenreKeys: GenreKey[];
  matchedMoodKeys: MoodKey[];
  matchingPerformers: Performer[];
}
