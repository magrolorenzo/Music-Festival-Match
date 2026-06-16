import type {
  LiveEvent,
  Performer,
  GenreKey,
  MoodKey,
  RegionKey,
  SearchInput,
} from "@workspace/api-zod";
import { fetchJamBaseEvents, hasJamBaseKey, type RawEvent, type RawPerformer } from "./jambase";
import { mapGenres, mapMoods } from "./taxonomy";
import { enrichArtist, PLACEHOLDER_ENRICHMENT } from "./enrichment";
import { mapWithConcurrency } from "./http";
import { logger } from "./logger";

// ============================================================================
// Search orchestrator.
//
//   JamBase v3 events  ->  genre filter  ->  per-headliner enrichment
//   (Songstats hype + Musixmatch mood, DB-cached)  ->  assembled LiveEvent[].
//
// Fan-out is bounded: only headliners are enriched, only the top events are
// processed, and all artist enrichments share a single concurrency pool. The
// pipeline is live-only: a missing JamBase key or any failure yields an empty
// result, so the UI shows a clear "no events" state rather than mock data.
// ============================================================================

const MAX_EVENTS = 30;
const MAX_HEADLINERS_PER_EVENT = 5;
const ENRICH_CONCURRENCY = 5;

export interface SearchOutput {
  events: LiveEvent[];
}

function regionFor(longitude: number): RegionKey {
  return longitude < -30 ? "north-america" : "europe";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function eventMatchesGenres(event: RawEvent, genres: GenreKey[]): boolean {
  if (genres.length === 0) return true;
  return event.performers.some((p) =>
    mapGenres(p.genres).some((g) => genres.includes(g)),
  );
}

function selectHeadliners(event: RawEvent): RawPerformer[] {
  const headliners = event.performers.filter((p) => p.isHeadliner);
  const pool = headliners.length > 0 ? headliners : event.performers;
  return pool.slice(0, MAX_HEADLINERS_PER_EVENT);
}

// Normalizes a single cached mood string to a valid MoodKey, defaulting to
// "party" when the label no longer maps to any current taxonomy entry.
function coerceMood(raw: string): MoodKey {
  return mapMoods([raw])[0] ?? "party";
}

function performerId(eventId: string, name: string): string {
  return `${eventId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(
    0,
    120,
  );
}

/** Builds the live pipeline result, enriching only the headliners we keep. */
async function buildLive(input: SearchInput): Promise<LiveEvent[]> {
  const raw = await fetchJamBaseEvents({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusKm: input.radiusKm,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  const genres = (input.genres ?? []) as GenreKey[];
  const filtered = raw
    .filter((e) => eventMatchesGenres(e, genres))
    .slice(0, MAX_EVENTS);

  // Collect the unique set of headliner names to enrich, so a shared concurrency
  // pool dedupes work and caps sockets across the whole result set.
  const enrichTargets = new Map<string, RawPerformer>();
  const eventHeadliners = new Map<string, RawPerformer[]>();
  for (const event of filtered) {
    const headliners = selectHeadliners(event);
    eventHeadliners.set(event.id, headliners);
    for (const p of headliners) {
      if (!enrichTargets.has(p.name)) enrichTargets.set(p.name, p);
    }
  }

  const names = [...enrichTargets.keys()];
  const enrichments = await mapWithConcurrency(
    names,
    ENRICH_CONCURRENCY,
    (name) => enrichArtist(name),
  );
  const byName = new Map(names.map((n, i) => [n, enrichments[i]]));

  return filtered.map((event) => {
    const headlinerNames = new Set(
      (eventHeadliners.get(event.id) ?? []).map((p) => p.name),
    );

    const performers: Performer[] = event.performers
      .slice(0, 12)
      .map((p) => {
        const genreKeys = mapGenres(p.genres);
        const enriched = headlinerNames.has(p.name)
          ? byName.get(p.name) ?? PLACEHOLDER_ENRICHMENT
          : PLACEHOLDER_ENRICHMENT;
        // Cached enrichment may predate the current taxonomy, so re-normalize
        // every mood string through mapMoods before it hits the response schema
        // (stray labels like "energetic" would otherwise fail Zod validation).
        const moodKeys = mapMoods(enriched.moodKeys);

        return {
          id: performerId(event.id, p.name),
          name: p.name,
          image: p.image,
          isHeadliner: p.isHeadliner,
          cyanite: {
            musicGenres: p.genres,
            genreKeys,
            audioValence: 0.5,
            audioEnergy: 0.5,
            moodKeys,
          },
          songstats: enriched.songstats,
          recommendedSongs: enriched.recommendedSongs.map((s) => ({
            ...s,
            moodKeys: mapMoods(s.moodKeys),
          })),
          quotes: enriched.quotes.map((q) => ({
            ...q,
            mood: coerceMood(q.mood),
          })),
        } satisfies Performer;
      });

    const genreKeys = unique(performers.flatMap((p) => p.cyanite.genreKeys));
    const moodKeys = unique(performers.flatMap((p) => p.cyanite.moodKeys));

    return {
      id: event.id,
      kind: event.isFestival ? "festival" : "concert",
      name: event.name,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      image: event.image,
      region: regionFor(event.location.longitude),
      location: event.location,
      geoRadiusKm: event.isFestival ? 25 : 5,
      performers,
      genreKeys,
      moodKeys,
    } satisfies LiveEvent;
  });
}

/**
 * Top-level search: runs the live pipeline when a JamBase key is present.
 * A missing key or any pipeline failure yields an empty result, so the UI
 * surfaces a clear "no events" state rather than illustrative mock data.
 */
export async function runSearch(input: SearchInput): Promise<SearchOutput> {
  if (!hasJamBaseKey()) {
    logger.warn("JAMBASE_API_KEY missing; returning no events");
    return { events: [] };
  }

  try {
    const events = await buildLive(input);
    return { events };
  } catch (err) {
    logger.warn({ err }, "live pipeline failed; returning no events");
    return { events: [] };
  }
}
