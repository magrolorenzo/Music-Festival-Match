// ============================================================================
// LivePulse domain types
//
// These types are intentionally shaped around the combined payloads of the
// three partner APIs the app is designed to consume later:
//   - JamBase   (event / venue / performer data)  https://data.jambase.com/api/reference
//   - Cyanite   (genre + acoustic mood analysis)   https://api-docs.cyanite.ai/docs/create-integration
//   - Musixmatch (track / lyric quote data)         https://docs.musixmatch.com/overview
//
// Right now everything is read from a local mock JSON file. When live keys are
// available, only the transport in `api.ts` changes — these shapes stay stable.
// ============================================================================

export type RegionKey = "europe" | "north-america";
export type LocationFilter = "global" | RegionKey;

export type GenreKey = "rock" | "pop" | "electronic" | "hip-hop" | "jazz";
export type MoodKey = "energetic" | "chill" | "emotional" | "dark";
export type PeriodKey = "current-month" | "next-3-months";

export type EventKind = "festival" | "concert";

/** JamBase-shaped geo location object. */
export interface JamBaseLocation {
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

/** Cyanite-shaped music analysis attached to a performer. */
export interface CyaniteAnalysis {
  /** Cyanite `musicGenres` field, e.g. ["Electronic", "House"]. */
  musicGenres: string[];
  /** Normalized genre keys mapping to the app's filters. */
  genreKeys: GenreKey[];
  /** Cyanite `audioValence` 0..1 (low = sad/dark, high = happy/energetic). */
  audioValence: number;
  /** Cyanite acoustic energy 0..1. */
  audioEnergy: number;
  /** Cyanite-derived emotional/mood profile keys mapping to the app's filters. */
  moodKeys: MoodKey[];
}

/** Songstats-shaped popularity snapshot. */
export interface SongstatsTrend {
  /** e.g. "+24%". */
  popularityTrend: string;
  monthlyListeners: number;
  /** Streaming/popularity score 0..100. */
  popularityScore: number;
}

/** Musixmatch-shaped track quote. */
export interface MusixmatchQuote {
  trackName: string;
  /** Mood this quote best expresses (used to pick the right line per filter). */
  mood: MoodKey;
  /** Short lyric-style snippet (original placeholder text, not real lyrics). */
  lyrics_body: string;
  script_tracking_url: string;
}

/** A recommended track for an artist (Musixmatch / Songstats blend). */
export interface RecommendedSong {
  trackName: string;
  popularity: number;
  moodKeys: MoodKey[];
}

/** A performer on an event (JamBase `performers[]` enriched with partner data). */
export interface Performer {
  id: string;
  name: string;
  /** Optional artist portrait; UI shows a placeholder when missing. */
  image: string | null;
  isHeadliner: boolean;
  cyanite: CyaniteAnalysis;
  songstats: SongstatsTrend;
  recommendedSongs: RecommendedSong[];
  quotes: MusixmatchQuote[];
}

/** A live music event (JamBase `/events` entry, enriched). */
export interface LiveEvent {
  id: string;
  kind: EventKind;
  name: string;
  description: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  /** Optional festival hero image; UI shows a placeholder when missing. */
  image: string | null;
  region: RegionKey;
  location: JamBaseLocation;
  geoRadiusKm: number;
  performers: Performer[];
  /** Aggregated genre keys across the lineup (for fast filtering). */
  genreKeys: GenreKey[];
  /** Aggregated mood keys across the lineup. */
  moodKeys: MoodKey[];
}

// ----- Search / matching -----------------------------------------------------

export interface SearchFilters {
  location: LocationFilter;
  genre: GenreKey | "any";
  mood: MoodKey | "any";
  period: PeriodKey;
}

/** A single reason an event matched the filters. */
export interface MatchReason {
  type: "genre" | "mood" | "location" | "period";
  key: string;
  label: string;
}

/** An event paired with its score against the active filters. */
export interface MatchResult {
  event: LiveEvent;
  score: number;
  /** Whether the event matched every active filter dimension. */
  isExactMatch: boolean;
  reasons: MatchReason[];
  matchedGenreKeys: GenreKey[];
  matchedMoodKeys: MoodKey[];
  /** Performers that contributed to the genre/mood match, best-first. */
  matchingPerformers: Performer[];
}
