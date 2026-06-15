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
  genres: GenreKey[],
  moods: MoodKey[],
): Performer[] {
  const scored = event.performers.map((p) => {
    const genreHits = genres.filter((g) =>
      p.cyanite.genreKeys.includes(g),
    ).length;
    const moodHits = moods.filter((m) =>
      p.cyanite.moodKeys.includes(m),
    ).length;
    const relevance =
      genreHits * 2 + moodHits * 2 + p.songstats.popularityScore / 100;
    return { p, relevance, anyHit: genreHits > 0 || moodHits > 0 };
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
  const { genres, moods } = filters;
  const reasons: MatchReason[] = [];

  let score = 0;
  let genreSatisfied = true;
  let moodSatisfied = true;

  const matchedGenreKeys: GenreKey[] = [];
  const matchedMoodKeys: MoodKey[] = [];

  // Genre dimension: an event matches if it covers ANY selected genre; the
  // more selected genres it covers, the higher its share of the genre weight.
  if (genres.length > 0) {
    const hits = genres.filter((g) => event.genreKeys.includes(g));
    if (hits.length > 0) {
      score += WEIGHTS.genre * (hits.length / genres.length);
      for (const g of hits) {
        matchedGenreKeys.push(g);
        reasons.push({ type: "genre", key: g, label: genreLabel(g) });
      }
    } else {
      genreSatisfied = false;
    }
  }

  // Mood dimension: same "any of, more is better" logic as genres.
  if (moods.length > 0) {
    const hits = moods.filter((m) => event.moodKeys.includes(m));
    if (hits.length > 0) {
      score += WEIGHTS.mood * (hits.length / moods.length);
      for (const m of hits) {
        matchedMoodKeys.push(m);
        reasons.push({ type: "mood", key: m, label: moodLabel(m) });
      }
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
    matchingPerformers: rankMatchingPerformers(event, genres, moods),
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
  if (filters.genres.length > 0) {
    total += 1;
    if (result.matchedGenreKeys.length > 0) matched += 1;
  }
  if (filters.moods.length > 0) {
    total += 1;
    if (result.matchedMoodKeys.length > 0) matched += 1;
  }
  return { matched, total };
}
