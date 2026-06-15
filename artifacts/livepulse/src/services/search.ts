// ============================================================================
// Search orchestrator — the single entry point the UI calls to run a search.
// Combines the JamBase-style fetch with the local matching engine.
// ============================================================================

import { fetchFestivals, radiusToKm } from "./api";
import { rankEvents } from "./matching";
import type { SearchFilters, MatchResult } from "./types";

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
  const events = await fetchFestivals({
    location: filters.location,
    radiusKm: radiusToKm(filters.radius, filters.radiusUnit),
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  const results = rankEvents(events, filters);
  return {
    filters,
    results,
    exactCount: results.filter((r) => r.isExactMatch).length,
    partialCount: results.filter((r) => !r.isExactMatch).length,
  };
}
