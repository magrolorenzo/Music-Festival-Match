// ============================================================================
// Search orchestrator — the single entry point the UI calls to run a search.
//
// Calls the api-server `/api/search` endpoint (generated client), which runs the
// live JamBase -> genre -> Songstats -> Musixmatch pipeline server-side and
// returns events already shaped to the LiveEvent contract. Ranking/scoring
// against the selected moods + genres happens locally in `rankEvents`.
//
// The pipeline is live-only: there is no mock fallback. If the request fails or
// the live service is unavailable, the call throws (caught by the caller) or
// returns an empty result, which the UI renders as a clear "no events" state.
// ============================================================================

import { searchEvents } from "@workspace/api-client-react";
import { radiusToKm } from "./api";
import { rankEvents } from "./matching";
import type { SearchFilters, MatchResult, LiveEvent } from "./types";

export interface SearchResponse {
  filters: SearchFilters;
  results: MatchResult[];
  exactCount: number;
  partialCount: number;
}

/** Runs a full search: fetches events in the geo + date window, ranks them. */
export async function runSearch(
  filters: SearchFilters,
): Promise<SearchResponse> {
  if (!filters.location) {
    throw new Error("A verified location is required to search.");
  }
  const radiusKm = radiusToKm(filters.radius, filters.radiusUnit);

  const result = await searchEvents({
    latitude: filters.location.latitude,
    longitude: filters.location.longitude,
    radiusKm,
    startDate: filters.startDate,
    endDate: filters.endDate,
    genres: filters.genres,
  });
  const events = result.events as unknown as LiveEvent[];

  const results = rankEvents(events, filters);
  return {
    filters,
    results,
    exactCount: results.filter((r) => r.isExactMatch).length,
    partialCount: results.filter((r) => !r.isExactMatch).length,
  };
}
