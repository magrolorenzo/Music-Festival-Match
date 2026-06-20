import { fetchJson } from "./http";
import { withCache } from "./cache";
import type { GenreKey } from "@workspace/api-zod";

// ============================================================================
// JamBase v3 events client.
//
// GET https://api.data.jambase.com/v3/events with Bearer auth. Responses follow
// schema.org JSON-LD, so every field is read defensively — partner payloads
// vary and a missing field must never crash the search.
//
// Genres are passed as a pipe-joined genreSlug parameter for server-side
// filtering when the user has selected one or more genre filters.
// ============================================================================

const JAMBASE_EVENTS_URL = "https://api.data.jambase.com/v3/events";

export interface RawPerformer {
  name: string;
  genres: string[];
  image: string | null;
  isHeadliner: boolean;
  /** JamBase `x-performanceRank` (per-day billing order); large when missing. */
  performanceRank: number;
}

export interface RawEvent {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  image: string | null;
  isFestival: boolean;
  location: {
    name: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  performers: RawPerformer[];
  ticketUrl: string | null;
}

export interface JamBaseQuery {
  latitude: number;
  longitude: number;
  radiusKm: number;
  startDate: string;
  endDate: string;
  genres?: GenreKey[];
}

const GENRE_TO_JAMBASE: Record<GenreKey, string> = {
  blues: "blues",
  classical: "classical",
  "country-music": "country",
  edm: "electronic",
  folk: "folk",
  "hip-hop-rap": "hip-hop",
  indie: "indie",
  jazz: "jazz",
  kpop: "k-pop",
  latin: "latin",
  metal: "metal",
  pop: "pop",
  punk: "punk",
  "rhythm-and-blues-soul": "r-b",
  reggae: "reggae",
  rock: "rock",
};

export function hasJamBaseKey(): boolean {
  return Boolean(process.env.JAMBASE_API_KEY);
}

/**
 * JamBase rejects an `eventDateFrom` earlier than tomorrow (UTC) unless the key
 * has `expandPastEvents` enabled. We clamp the lower bound so a search starting
 * "today" still succeeds — JamBase wouldn't return today's past events anyway.
 * Dates are ISO `YYYY-MM-DD`, so lexicographic comparison is safe.
 */
function clampDateWindow(
  startDate: string,
  endDate: string,
): { from: string; to: string } {
  const minFrom = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const from = startDate < minFrom ? minFrom : startDate;
  const to = endDate < from ? from : endDate;
  return { from, to };
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") return item;
      if (
        item &&
        typeof item === "object" &&
        typeof (item as any).url === "string"
      ) {
        return (item as any).url;
      }
    }
  }
  if (
    value &&
    typeof value === "object" &&
    typeof (value as any).url === "string"
  ) {
    return (value as any).url;
  }
  return null;
}

function toISODate(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value) return fallback;
  return value.slice(0, 10);
}

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : NaN;
}

function eventIdentifier(raw: any, index: number): string {
  const id =
    raw?.identifier ??
    raw?.["@id"] ??
    raw?.id ??
    raw?.url ??
    `${raw?.name ?? "event"}-${index}`;
  if (Array.isArray(id)) {
    const found = id.find((i) => i?.value)?.value ?? id[0];
    return `evt-${String(found ?? index)}`;
  }
  return `evt-${String(id)}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function mapPerformers(raw: any): RawPerformer[] {
  const list = Array.isArray(raw?.performer) ? raw.performer : [];
  return list
    .map((p: any) => {
      const name = typeof p?.name === "string" ? p.name : null;
      if (!name) return null;
      const genreField = p?.genre ?? p?.genres ?? [];
      const genres = Array.isArray(genreField)
        ? genreField.filter((g: unknown): g is string => typeof g === "string")
        : typeof genreField === "string"
          ? [genreField]
          : [];
      const isHeadliner = Boolean(
        p?.["x-isHeadliner"] ?? p?.isHeadliner ?? p?.headliner,
      );
      const rankRaw = num(p?.["x-performanceRank"]);
      const performanceRank = Number.isFinite(rankRaw)
        ? rankRaw
        : Number.MAX_SAFE_INTEGER;
      return {
        name,
        genres,
        image: firstString(p?.image),
        isHeadliner,
        performanceRank,
      } satisfies RawPerformer;
    })
    .filter((p: RawPerformer | null): p is RawPerformer => p !== null);
}

function mapEvent(raw: any, index: number): RawEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name : null;
  if (!name) return null;

  const loc = raw.location ?? {};
  const geo = loc.geo ?? {};
  const address = loc.address ?? {};
  const latitude = num(geo.latitude ?? loc.latitude);
  const longitude = num(geo.longitude ?? loc.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const startDate = toISODate(raw.startDate, "");
  if (!startDate) return null;

  const typeField = raw["@type"] ?? raw.type ?? "";
  const typeText = (
    Array.isArray(typeField) ? typeField.join(" ") : String(typeField)
  ).toLowerCase();
  const isFestival =
    typeText.includes("festival") || name.toLowerCase().includes("festival");

  // The first offer is JamBase's primary ticketing link (ticketingLinkPrimary).
  const offers = Array.isArray(raw.offers) ? raw.offers : [];
  const ticketUrl =
    offers.length > 0 && typeof offers[0]?.url === "string"
      ? offers[0].url
      : null;

  return {
    id: eventIdentifier(raw, index),
    name,
    description: typeof raw.description === "string" ? raw.description : "",
    startDate,
    endDate: toISODate(raw.endDate, startDate),
    image: firstString(raw.image),
    isFestival,
    location: {
      name: typeof loc.name === "string" ? loc.name : name,
      city:
        typeof address.addressLocality === "string"
          ? address.addressLocality
          : typeof loc.city === "string"
            ? loc.city
            : "",
      country:
        typeof address.addressCountry === "string"
          ? address.addressCountry
          : typeof address.addressCountry?.name === "string"
            ? address.addressCountry.name
            : typeof loc.country === "string"
              ? loc.country
              : "",
      latitude,
      longitude,
    },
    performers: mapPerformers(raw),
    ticketUrl,
  };
}

/**
 * Fetches events from JamBase v3 in the geo + date window. When genres are
 * provided, passes them as a pipe-joined genreSlug for server-side filtering.
 * Throws on missing key or transport failure.
 */
export async function fetchJamBaseEvents(
  query: JamBaseQuery,
): Promise<RawEvent[]> {
  const apiKey = process.env.JAMBASE_API_KEY;
  if (!apiKey) throw new Error("JAMBASE_API_KEY is not configured");

  const { from, to } = clampDateWindow(query.startDate, query.endDate);

  const url = new URL(JAMBASE_EVENTS_URL);
  url.searchParams.set("geoLatitude", String(query.latitude));
  url.searchParams.set("geoLongitude", String(query.longitude));
  url.searchParams.set("geoRadiusAmount", String(Math.round(query.radiusKm)));
  url.searchParams.set("geoRadiusUnits", "km");
  url.searchParams.set("eventDateFrom", from);
  url.searchParams.set("eventDateTo", to);
  url.searchParams.set("perPage", "50");

  if (query.genres && query.genres.length > 0) {
    const slugs = query.genres
      .map((g) => GENRE_TO_JAMBASE[g])
      .filter(Boolean)
      .join("|");
    if (slugs) url.searchParams.set("genreSlug", slugs);
  }

  const cacheKey = url.toString();

  const payload = await withCache(
    "jambase",
    cacheKey,
    () =>
      fetchJson<any>(
        url.toString(),
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        },
        15000,
      ),
  );

  const list = Array.isArray(payload?.events)
    ? payload.events
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];

  return list
    .map((raw: any, i: number) => mapEvent(raw, i))
    .filter((e: RawEvent | null): e is RawEvent => e !== null);
}
