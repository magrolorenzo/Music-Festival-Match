// ============================================================================
// Search orchestrator — the single entry point the UI calls to run a search.
//
// Calls the api-server `/api/search` endpoint (generated client), which runs the
// live JamBase -> genre -> Songstats -> Musixmatch pipeline server-side and
// returns events already shaped to the LiveEvent contract. Ranking/scoring
// against the selected moods + genres happens locally in `rankEvents`.
//
// If the network call itself fails (server unreachable), we degrade to the
// bundled mock dataset and flag `source: "mock"` so the UI can show a notice.
// ============================================================================

import { searchEvents } from "@workspace/api-client-react";
import { fetchFestivals, radiusToKm } from "./api";
import { rankEvents } from "./matching";
import type { SearchFilters, MatchResult, LiveEvent } from "./types";

export type SearchSource = "live" | "mock";

export interface SearchResponse {
  filters: SearchFilters;
  results: MatchResult[];
  exactCount: number;
  partialCount: number;
  source: SearchSource;
}

/** Runs a full search: fetches events in the geo + date window, ranks them. */
export async function runSearch(
  filters: SearchFilters,
): Promise<SearchResponse> {
  const radiusKm = radiusToKm(filters.radius, filters.radiusUnit);

  let events: LiveEvent[];
  let source: SearchSource;

  try {
    if (!filters.location) {
      throw new Error("A verified location is required to search.");
    }
    const result = await searchEvents({
      latitude: filters.location.latitude,
      longitude: filters.location.longitude,
      radiusKm,
      startDate: filters.startDate,
      endDate: filters.endDate,
      genres: filters.genres,
    });
    events = result.events as unknown as LiveEvent[];
    source = result.source;
  } catch {
    // Server unreachable — fall back to the bundled mock dataset client-side.
    events = await fetchFestivals({
      location: filters.location,
      radiusKm,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
    source = "mock";
  }

  const results = rankEvents(events, filters);
  return {
    filters,
    results,
    exactCount: results.filter((r) => r.isExactMatch).length,
    partialCount: results.filter((r) => !r.isExactMatch).length,
    source,
  };
}
