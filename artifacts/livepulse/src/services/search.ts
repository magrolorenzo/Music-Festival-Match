// ============================================================================
// Search orchestrator — the single entry point the UI calls to run a search.
// Combines the JamBase-style fetch with the local matching engine.
// ============================================================================

import { fetchFestivals } from "./api";
import { rankEvents } from "./matching";
import { periodToRange } from "@/lib/dates";
import type { SearchFilters, MatchResult } from "./types";

export interface SearchResponse {
  filters: SearchFilters;
  results: MatchResult[];
  exactCount: number;
  partialCount: number;
}

/** Runs a full search: resolves the period window, fetches events, ranks them. */
export async function runSearch(
  filters: SearchFilters,
): Promise<SearchResponse> {
  const { startDate, endDate } = periodToRange(filters.period);
  const events = await fetchFestivals({
    location: filters.location,
    startDate,
    endDate,
  });
  const results = rankEvents(events, filters);
  return {
    filters,
    results,
    exactCount: results.filter((r) => r.isExactMatch).length,
    partialCount: results.filter((r) => !r.isExactMatch).length,
  };
}
