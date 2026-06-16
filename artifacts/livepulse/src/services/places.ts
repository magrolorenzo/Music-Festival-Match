// ============================================================================
// Place autocomplete — thin wrapper over the server-side Nominatim proxy.
//
// The frontend never talks to Nominatim directly; it calls the api-server
// `/api/places` endpoint (generated client), which keeps geocoding server-side
// and lets us return clean, exact lat/lon for each suggestion.
// ============================================================================

import { searchPlaces } from "@workspace/api-client-react";
import type { GeoLocation } from "./types";

const MIN_QUERY_LENGTH = 2;

/**
 * Fetches place suggestions for the given query. Returns up to 5 results with
 * exact coordinates. Pass an AbortSignal to cancel a stale in-flight request
 * (used by the debounced autocomplete to drop superseded keystrokes).
 */
export async function fetchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<GeoLocation[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const places = await searchPlaces({ q }, { signal });
  return places.slice(0, 5).map((p) => ({
    query: p.query,
    label: p.label,
    latitude: p.latitude,
    longitude: p.longitude,
  }));
}
