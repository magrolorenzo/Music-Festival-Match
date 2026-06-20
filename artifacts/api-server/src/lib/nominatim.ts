import type { Place } from "@workspace/api-zod";
import { fetchJson } from "./http";
import { withCache } from "./cache";

// ============================================================================
// OpenStreetMap Nominatim geocoder (keyless, server-side).
//
// Run server-side with a descriptive User-Agent per Nominatim's usage policy.
// Returns up to five structured suggestions, each carrying exact coordinates so
// the frontend never has to geocode raw text itself.
// ============================================================================

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "LivePulse/1.0 (Replit live music discovery app)";

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const hits = await withCache(
    "nominatim",
    url.toString(),
    () =>
      fetchJson<NominatimHit[]>(
        url.toString(),
        { headers: { Accept: "application/json", "User-Agent": USER_AGENT } },
        6000,
      ),
  );

  if (!Array.isArray(hits)) return [];

  // Nominatim often returns several OSM objects for one place (e.g. the city
  // node and its boundary relation) that share an identical display_name but
  // differ slightly in coordinates. Dedupe by label so the user doesn't see the
  // same place listed twice, keeping the first (most relevant) match.
  const seen = new Set<string>();

  return hits
    .map((hit) => ({
      query: trimmed,
      label: hit.display_name,
      latitude: Number(hit.lat),
      longitude: Number(hit.lon),
    }))
    .filter(
      (p) =>
        p.label &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude),
    )
    .filter((p) => {
      const key = p.label.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}
