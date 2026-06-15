// ============================================================================
// Matching engine — ranks live events against the user's filters.
//
// Scoring favours events that satisfy every active filter dimension (exact
// matches), but still surfaces strong partial matches, flagged so the UI can
// label them. Results are returned best-first.
// ============================================================================

import type {
  LiveEvent,
  Performer,
  SearchFilters,
  MatchResult,
  MatchReason,
  GenreKey,
  MoodKey,
} from "./types";
import { genreLabel, moodLabel } from "@/lib/taxonomy";

const WEIGHTS = {
  genre: 40,
  mood: 35,
  // Popularity acts as a tiebreaker / quality signal (0..25 scaled).
  popularity: 25,
};

function eventPeakPopularity(event: LiveEvent): number {
  return event.performers.reduce(
    (max, p) => Math.max(max, p.songstats.popularityScore),
    0,
  );
}

/** Performers contributing to the active genre/mood filters, best-first. */
function rankMatchingPerformers(
  event: LiveEvent,
  genre: GenreKey | "any",
  mood: MoodKey | "any",
): Performer[] {
  const scored = event.performers.map((p) => {
    const genreHit = genre !== "any" && p.cyanite.genreKeys.includes(genre);
    const moodHit = mood !== "any" && p.cyanite.moodKeys.includes(mood);
    const relevance =
      (genreHit ? 2 : 0) +
      (moodHit ? 2 : 0) +
      p.songstats.popularityScore / 100;
    return { p, relevance, anyHit: genreHit || moodHit };
  });

  const hits = scored.filter((s) => s.anyHit);
  const pool = hits.length > 0 ? hits : scored;
  return pool.sort((a, b) => b.relevance - a.relevance).map((s) => s.p);
}

/** Scores a single event against the active filters. */
export function scoreEvent(
  event: LiveEvent,
  filters: SearchFilters,
): MatchResult {
  const { genre, mood } = filters;
  const reasons: MatchReason[] = [];

  let score = 0;
  let genreSatisfied = true;
  let moodSatisfied = true;

  const matchedGenreKeys: GenreKey[] = [];
  const matchedMoodKeys: MoodKey[] = [];

  if (genre !== "any") {
    if (event.genreKeys.includes(genre)) {
      score += WEIGHTS.genre;
      matchedGenreKeys.push(genre);
      reasons.push({ type: "genre", key: genre, label: genreLabel(genre) });
    } else {
      genreSatisfied = false;
    }
  }

  if (mood !== "any") {
    if (event.moodKeys.includes(mood)) {
      score += WEIGHTS.mood;
      matchedMoodKeys.push(mood);
      reasons.push({ type: "mood", key: mood, label: moodLabel(mood) });
    } else {
      moodSatisfied = false;
    }
  }

  // Popularity contribution (always applies, scaled).
  const peak = eventPeakPopularity(event);
  score += (peak / 100) * WEIGHTS.popularity;

  const isExactMatch = genreSatisfied && moodSatisfied;

  return {
    event,
    score: Math.round(score),
    isExactMatch,
    reasons,
    matchedGenreKeys,
    matchedMoodKeys,
    matchingPerformers: rankMatchingPerformers(event, genre, mood),
  };
}

/**
 * Ranks a list of events against the filters, best-first.
 * Exact matches always rank above partial matches; within each tier, higher
 * score wins, then earlier date.
 */
export function rankEvents(
  events: LiveEvent[],
  filters: SearchFilters,
): MatchResult[] {
  return events
    .map((event) => scoreEvent(event, filters))
    .sort((a, b) => {
      if (a.isExactMatch !== b.isExactMatch) {
        return a.isExactMatch ? -1 : 1;
      }
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(a.event.startDate).getTime() -
        new Date(b.event.startDate).getTime()
      );
    });
}

/** Number of filter dimensions a result fully satisfied (for UI badges). */
export function matchStrength(result: MatchResult, filters: SearchFilters): {
  matched: number;
  total: number;
} {
  let total = 0;
  let matched = 0;
  if (filters.genre !== "any") {
    total += 1;
    if (result.matchedGenreKeys.length > 0) matched += 1;
  }
  if (filters.mood !== "any") {
    total += 1;
    if (result.matchedMoodKeys.length > 0) matched += 1;
  }
  return { matched, total };
}
