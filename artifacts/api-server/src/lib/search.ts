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
const MAX_PERFORMERS_PER_EVENT = 5;
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

function selectPerformers(event: RawEvent): RawPerformer[] {
  return event.performers.slice(0, MAX_PERFORMERS_PER_EVENT);
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

  // Collect unique performer names to enrich (deduped across all events).
  const enrichTargets = new Map<string, RawPerformer>();
  const eventPerformers = new Map<string, RawPerformer[]>();
  for (const event of filtered) {
    const performers = selectPerformers(event);
    eventPerformers.set(event.id, performers);
    for (const p of performers) {
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
    const enrichedNames = new Set(
      (eventPerformers.get(event.id) ?? []).map((p) => p.name),
    );

    const performers: Performer[] = event.performers
      .slice(0, 12)
      .map((p) => {
        const genreKeys = mapGenres(p.genres);
        const enriched = enrichedNames.has(p.name)
          ? (byName.get(p.name) ?? PLACEHOLDER_ENRICHMENT)
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

    const resultEvent = {
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
      ticketUrl: event.ticketUrl,
    } satisfies LiveEvent;

    // DEBUG: Stampa ticketUrl
    if (event.name.includes("Mac DeMarco")) {
      console.log("🎫 FINAL ticketUrl in search.ts:", resultEvent.ticketUrl);
    }

    return resultEvent;
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
