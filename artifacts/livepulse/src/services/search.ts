// ============================================================================
// Search orchestrator — the single entry point the UI calls to run a search.
//
// Calls the api-server `/api/search` endpoint (generated client), which runs the
// live JamBase -> genre -> Songstats -> Musixmatch pipeline server-side and
// returns events already shaped to the LiveEvent contract. Ranking/scoring
// against the selected moods + genres happens locally in `rankEvents`.
//
// The pipeline is live-only: there is no mock fallback. If the request fails,
// the live service is unavailable, or no location is set, runSearch resolves to
// an empty result rather than throwing — so the UI always lands on the results
// page and renders a clear "no events" state instead of bouncing the user back.
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

function emptyResponse(filters: SearchFilters): SearchResponse {
  return { filters, results: [], exactCount: 0, partialCount: 0 };
}

/** Runs a full search: fetches events in the geo + date window, ranks them. */
export async function runSearch(
  filters: SearchFilters,
): Promise<SearchResponse> {
  if (!filters.location) return emptyResponse(filters);
  const radiusKm = radiusToKm(filters.radius, filters.radiusUnit);

  try {
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
  } catch (e) {
    // Live service unreachable / request failed: surface the no-events state
    // rather than throwing, so the user still gets guidance back to filters.
    console.error("Live search failed:", e);
    return emptyResponse(filters);
  }
}
