import type {
  LiveEvent,
  Performer,
  GenreKey,
  MoodKey,
  RegionKey,
  SearchInput,
} from "@workspace/api-zod";
import { fetchJamBaseEvents, hasJamBaseKey, type RawEvent, type RawPerformer } from "./jambase";
import { mapGenres } from "./taxonomy";
import { enrichArtist, PLACEHOLDER_ENRICHMENT } from "./enrichment";
import { mapWithConcurrency } from "./http";
import { mockEvents } from "./mockEvents";
import { logger } from "./logger";

// ============================================================================
// Search orchestrator.
//
//   JamBase v3 events  ->  genre filter  ->  per-headliner enrichment
//   (Songstats hype + Musixmatch mood, DB-cached)  ->  assembled LiveEvent[].
//
// Fan-out is bounded: only headliners are enriched, only the top events are
// processed, and all artist enrichments share a single concurrency pool. Any
// failure (or a missing JamBase key) falls back to the mock dataset, surfaced
// via the `source` flag.
// ============================================================================

const MAX_EVENTS = 30;
const MAX_HEADLINERS_PER_EVENT = 5;
const ENRICH_CONCURRENCY = 5;

export interface SearchOutput {
  source: "live" | "mock";
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
        const moodKeys = enriched.moodKeys as MoodKey[];

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
            moodKeys: s.moodKeys as MoodKey[],
          })),
          quotes: enriched.quotes.map((q) => ({
            ...q,
            mood: q.mood as MoodKey,
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
 * Top-level search: runs the live pipeline when a JamBase key is present,
 * otherwise (or on any failure) returns the mock dataset with `source: "mock"`.
 */
export async function runSearch(input: SearchInput): Promise<SearchOutput> {
  if (hasJamBaseKey()) {
    try {
      const events = await buildLive(input);
      return { source: "live", events };
    } catch (err) {
      logger.warn({ err }, "live pipeline failed; falling back to mock data");
    }
  } else {
    logger.info("JAMBASE_API_KEY missing; serving mock data");
  }

  return {
    source: "mock",
    events: mockEvents({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      startDate: input.startDate,
      endDate: input.endDate,
    }),
  };
}
