import type {
  LiveEvent,
  Performer,
  GenreKey,
  MoodKey,
  RegionKey,
  SearchInput,
} from "@workspace/api-zod";
import {
  fetchJamBaseEvents,
  hasJamBaseKey,
  type RawEvent,
  type RawPerformer,
} from "./jambase";
import { mapGenres, mapMoods } from "./taxonomy";
import { enrichArtist, PLACEHOLDER_ENRICHMENT } from "./enrichment";
import { mapWithConcurrency } from "./http";
import { logger } from "./logger";

// ============================================================================
// Search orchestrator.
//
//   JamBase v3 events (server-side genre filter via genreSlug)
//   → per-performer Musixmatch enrichment (track.search + lyrics.analysis)
//   → assembled LiveEvent[].
//
// Fan-out is bounded: only the top events are processed, and all artist
// enrichments share a single concurrency pool. The pipeline is live-only:
// a missing JamBase key or any failure yields an empty result.
// ============================================================================

const MAX_EVENTS = 30;
const MAX_PERFORMERS_PER_EVENT = 6;
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

/**
 * Orders performers for display: headliners first, then by JamBase
 * `x-performanceRank` ascending. Stable, so ties keep the original order.
 */
function sortPerformers(performers: RawPerformer[]): RawPerformer[] {
  return [...performers].sort((a, b) => {
    if (a.isHeadliner !== b.isHeadliner) return a.isHeadliner ? -1 : 1;
    return a.performanceRank - b.performanceRank;
  });
}

function performerId(eventId: string, name: string): string {
  return `${eventId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(
    0,
    120,
  );
}

/** Builds the live pipeline result, enriching all performers up to the cap. */
async function buildLive(input: SearchInput): Promise<LiveEvent[]> {
  const genres = (input.genres ?? []) as GenreKey[];

  const raw = await fetchJamBaseEvents({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusKm: input.radiusKm,
    startDate: input.startDate,
    endDate: input.endDate,
    genres,
  });

  // Keep client-side genre filter as a safety net: JamBase genreSlug broadens
  // the search but performer-level genre arrays are more accurate.
  const filtered = raw
    .filter((e) => eventMatchesGenres(e, genres))
    .slice(0, MAX_EVENTS);

  // Sort each lineup (headliners first, then performanceRank) and split into the
  // top N shown as enriched cards and the rest shown as plain names.
  const enrichTargets = new Map<string, RawPerformer>();
  const eventLineup = new Map<string, RawPerformer[]>();
  for (const event of filtered) {
    const sorted = sortPerformers(event.performers);
    eventLineup.set(event.id, sorted);
    for (const p of sorted.slice(0, MAX_PERFORMERS_PER_EVENT)) {
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
    const lineup = eventLineup.get(event.id) ?? [];
    const shown = lineup.slice(0, MAX_PERFORMERS_PER_EVENT);
    const otherPerformerNames = lineup
      .slice(MAX_PERFORMERS_PER_EVENT)
      .map((p) => p.name);

    const performers: Performer[] = shown.map((p) => {
        const genreKeys = mapGenres(p.genres);
        const enriched = byName.get(p.name) ?? PLACEHOLDER_ENRICHMENT;

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
          tracks: enriched.tracks.map((t) => ({
            trackId: t.trackId,
            trackName: t.trackName,
            trackRating: t.trackRating,
            spotifyId: t.spotifyId,
            albumName: t.albumName,
          })),
          quotes: enriched.tracks
            .filter((t) => t.quote !== null)
            .map((t) => ({
              trackName: t.trackName,
              moods: mapMoods(t.moods),
              quote: t.quote!,
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
      otherPerformerNames,
      genreKeys,
      moodKeys,
      ticketUrl: event.ticketUrl,
    } satisfies LiveEvent;
  });
}

/**
 * Top-level search: runs the live pipeline when a JamBase key is present.
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
