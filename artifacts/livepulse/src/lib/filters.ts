// ============================================================================
// Shared filter defaults — the single source of truth for the initial search
// state. Used by App.tsx for the initial filters and by Landing's "Reset"
// action, so both always agree on what "default" means.
// ============================================================================

import type { GeoLocation, SearchFilters } from "@/services/types";
import { defaultDateRange } from "@/lib/dates";

/** Pre-verified default search location (treated like a selected place). */
export const DEFAULT_LOCATION: GeoLocation = {
  query: "Bologna",
  label: "Bologna, Emilia-Romagna, Italia",
  latitude: 44.4949,
  longitude: 11.3426,
};

export const DEFAULT_RADIUS = 50;
export const DEFAULT_RADIUS_UNIT = "km" as const;

/** The default set of search filters the app opens with. */
export function defaultFilters(): SearchFilters {
  const { startDate, endDate } = defaultDateRange();
  return {
    location: DEFAULT_LOCATION,
    radius: DEFAULT_RADIUS,
    radiusUnit: DEFAULT_RADIUS_UNIT,
    genres: [],
    moods: [],
    startDate,
    endDate,
  };
}
