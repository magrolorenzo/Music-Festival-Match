import { fetchJson } from "./http";
import { withCache } from "./cache";
import { mapMoods } from "./taxonomy";
import type { MoodKey } from "@workspace/api-zod";

// ============================================================================
// Musixmatch client.
//
// New primary flow (per-artist enrichment):
//   track.search              → top 3 tracks by rating for an artist
//   track.lyrics.analysis.get → moods + theme quote (enterprise endpoint,
//                               only called when has_lyrics === 1)
//
// Legacy flow (kept for future reuse, not called by current enrichment):
//   matcher.track.get / track.lyrics.get / track.lyrics.mood.get
// ============================================================================

const MUSIXMATCH_BASE = "https://api.musixmatch.com/ws/1.1";

// ---------------------------------------------------------------------------
// Artist name normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises an artist name for use as a cache key:
 *   lowercase, accents/apostrophes/special chars → "+", spaces → "+".
 * Example: "Dov'è Liana" → "dov+e+liana"
 */
export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "+")
    .replace(/['\u2019\u2018\u02bc]/g, "+")
    .replace(/\s+/g, "+")
    .replace(/[^a-z0-9+]/g, "+")
    .replace(/\++/g, "+")
    .replace(/^\+|\+$/g, "");
}

/**
 * Normalises an artist name for use as a Musixmatch q_track_artist query:
 *   lowercase, accents stripped, apostrophes → space, spaces collapsed.
 * Example: "Dov'è Liana" → "dov e liana"
 */
function normalizeForQuery(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\u2019\u2018\u02bc]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// New primary flow: track.search → track.lyrics.analysis.get
// ---------------------------------------------------------------------------

export interface ArtistTrack {
  trackId: number;
  trackName: string;
  trackRating: number;
  spotifyId: string | null;
  albumName: string;
  hasLyrics: boolean;
  quote: string | null;
  moods: string[];
}

async function searchTracks(
  queryName: string,
  apiKey: string,
): Promise<any[]> {
  const qs = new URLSearchParams();
  qs.append("apikey", apiKey);
  qs.append("q_track_artist", queryName);
  qs.append("s_track_rating", "desc");
  qs.append("s_artist_rating", "desc");
  qs.append("page_size", "3");
  const url = `${MUSIXMATCH_BASE}/track.search?${qs.toString()}`;

  const data = await withCache(
    "musixmatch",
    url,
    () => fetchJson<any>(url),
  );
  return data?.message?.body?.track_list ?? [];
}

async function fetchLyricsAnalysis(
  trackId: number,
  apiKey: string,
): Promise<{ quote: string | null; moods: string[] }> {
  try {
    const url = new URL(`${MUSIXMATCH_BASE}/track.lyrics.analysis.get`);
    url.searchParams.set("track_id", String(trackId));
    url.searchParams.set("apikey", apiKey);

    const data = await withCache(
      "musixmatch",
      url.toString(),
      () => fetchJson<any>(url.toString()),
    );

    const analysis = data?.message?.body?.analysis;
    if (!analysis) return { quote: null, moods: [] };

    const mainMoods: string[] = Array.isArray(analysis?.moods?.main_moods)
      ? analysis.moods.main_moods.filter(
          (m: unknown): m is string => typeof m === "string",
        )
      : [];

    const firstQuote: string | null =
      analysis?.themes?.main_themes?.[0]?.quotes?.[0] ?? null;

    return { quote: firstQuote, moods: mainMoods };
  } catch {
    return { quote: null, moods: [] };
  }
}

/**
 * Fetches the top 3 tracks for an artist from Musixmatch, with lyrics
 * analysis (moods + theme quote) for tracks that have lyrics.
 */
export async function fetchArtistTracks(name: string): Promise<ArtistTrack[]> {
  const apiKey = process.env.MUSIXMATCH_API_KEY;
  if (!apiKey) return [];

  const queryName = normalizeForQuery(name);
  const trackList = await searchTracks(queryName, apiKey).catch(() => []);

  const tracks: ArtistTrack[] = [];

  for (const entry of trackList) {
    const track = entry?.track;
    if (!track) continue;

    const trackId = track.track_id;
    if (typeof trackId !== "number") continue;

    const trackName =
      typeof track.track_name === "string" ? track.track_name : "";
    const trackRating =
      typeof track.track_rating === "number" ? track.track_rating : 0;
    const spotifyId =
      typeof track.track_spotify_id === "string" &&
      track.track_spotify_id.length > 0
        ? track.track_spotify_id
        : null;
    const albumName =
      typeof track.album_name === "string" ? track.album_name : "";
    const hasLyrics = track.has_lyrics === 1;

    let quote: string | null = null;
    let moods: string[] = [];

    if (hasLyrics) {
      const analysis = await fetchLyricsAnalysis(trackId, apiKey);
      quote = analysis.quote;
      moods = analysis.moods;
    }

    tracks.push({
      trackId,
      trackName,
      trackRating,
      spotifyId,
      albumName,
      hasLyrics,
      quote,
      moods,
    });
  }

  return tracks;
}

// ---------------------------------------------------------------------------
// Legacy flow — kept in backend for future reuse, not called by enrichment
// ---------------------------------------------------------------------------

export interface TrackQuote {
  trackName: string;
  moods: MoodKey[];
  lyrics_body: string;
  script_tracking_url: string;
}

function snippet(lyrics: string): string {
  const lines = lyrics
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) => l.length > 0 && !/\*+/.test(l) && !/lyrics? provided/i.test(l),
    );
  return lines.slice(0, 2).join(" / ");
}

async function matchTrackIdBySpotify(
  spotifyId: string,
  apiKey: string,
): Promise<number | null> {
  const url = new URL(`${MUSIXMATCH_BASE}/track.get`);
  url.searchParams.set("track_spotify_id", spotifyId);
  url.searchParams.set("apikey", apiKey);
  const data = await withCache("musixmatch", url.toString(), () =>
    fetchJson<any>(url.toString()),
  );
  const id = data?.message?.body?.track?.track_id;
  return typeof id === "number" ? id : null;
}

async function matchTrackId(
  artist: string,
  track: string,
  apiKey: string,
): Promise<number | null> {
  const url = new URL(`${MUSIXMATCH_BASE}/matcher.track.get`);
  url.searchParams.set("q_artist", artist);
  url.searchParams.set("q_track", track);
  url.searchParams.set("apikey", apiKey);
  const data = await withCache("musixmatch", url.toString(), () =>
    fetchJson<any>(url.toString()),
  );
  const id = data?.message?.body?.track?.track_id;
  return typeof id === "number" ? id : null;
}

async function fetchLyricsBody(
  trackId: number,
  apiKey: string,
): Promise<{ body: string; url: string } | null> {
  const url = new URL(`${MUSIXMATCH_BASE}/track.lyrics.get`);
  url.searchParams.set("track_id", String(trackId));
  url.searchParams.set("apikey", apiKey);
  const data = await withCache("musixmatch", url.toString(), () =>
    fetchJson<any>(url.toString()),
  );
  const lyrics = data?.message?.body?.lyrics;
  const body =
    typeof lyrics?.lyrics_body === "string" ? lyrics.lyrics_body : "";
  if (!body) return null;
  return {
    body,
    url:
      typeof lyrics?.script_tracking_url === "string"
        ? lyrics.script_tracking_url
        : "",
  };
}

async function fetchMoodLabels(
  trackId: number,
  apiKey: string,
): Promise<string[]> {
  try {
    const url = new URL(`${MUSIXMATCH_BASE}/track.lyrics.mood.get`);
    url.searchParams.set("track_id", String(trackId));
    url.searchParams.set("apikey", apiKey);
    const data = await withCache("musixmatch", url.toString(), () =>
      fetchJson<any>(url.toString()),
    );
    const moodList =
      data?.message?.body?.mood_list ?? data?.message?.body?.moods;
    if (!Array.isArray(moodList)) return [];
    return moodList
      .map((m: any) => m?.label ?? m?.mood ?? m?.name)
      .filter((l: unknown): l is string => typeof l === "string");
  } catch {
    return [];
  }
}

export function hasMusixmatchKey(): boolean {
  return Boolean(process.env.MUSIXMATCH_API_KEY);
}

export async function fetchTrackQuote(
  artist: string,
  track: string,
  spotifyId?: string | null,
): Promise<TrackQuote | null> {
  const apiKey = process.env.MUSIXMATCH_API_KEY;
  if (!apiKey) return null;

  let trackId = spotifyId
    ? await matchTrackIdBySpotify(spotifyId, apiKey).catch(() => null)
    : null;
  if (!trackId) trackId = await matchTrackId(artist, track, apiKey);
  if (!trackId) return null;

  const [lyrics, moodLabels] = await Promise.all([
    fetchLyricsBody(trackId, apiKey),
    fetchMoodLabels(trackId, apiKey),
  ]);
  if (!lyrics) return null;

  const body = snippet(lyrics.body);
  if (!body) return null;

  return {
    trackName: track,
    moods: mapMoods(moodLabels),
    lyrics_body: body,
    script_tracking_url: lyrics.url,
  };
}
