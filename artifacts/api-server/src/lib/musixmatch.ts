import { fetchJson } from "./http";
import { mapMoods } from "./taxonomy";
import type { MoodKey } from "@workspace/api-zod";

// ============================================================================
// Musixmatch lyric + mood client.
//
// matcher.track.get  -> resolve a track id for an (artist, track) pair
// track.lyrics.get   -> a short, legal lyric snippet + tracking url
// track.lyrics.mood.get (enterprise) -> emotion/mood labels
//
// Mood is best-effort: when the mood endpoint is unavailable we still return a
// quote, just with an "unknown" mood profile rather than a guessed one.
// ============================================================================

const MUSIXMATCH_BASE = "https://api.musixmatch.com/ws/1.1";

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
    .filter((l) => l.length > 0 && !/\*+/.test(l) && !/lyrics? provided/i.test(l));
  return lines.slice(0, 2).join(" / ");
}

/**
 * Resolves a Musixmatch track id from a Spotify track id. This is the preferred
 * path: the Spotify id comes from Songstats, giving a deterministic handoff that
 * avoids the mismatch risk of fuzzy artist/track text matching.
 */
async function matchTrackIdBySpotify(
  spotifyId: string,
  apiKey: string,
): Promise<number | null> {
  const url = new URL(`${MUSIXMATCH_BASE}/track.get`);
  url.searchParams.set("track_spotify_id", spotifyId);
  url.searchParams.set("apikey", apiKey);
  const data = await fetchJson<any>(url.toString());
  const id = data?.message?.body?.track?.track_id;
  return typeof id === "number" ? id : null;
}

/** Fallback resolver by fuzzy (artist, track) text when no Spotify id exists. */
async function matchTrackId(
  artist: string,
  track: string,
  apiKey: string,
): Promise<number | null> {
  const url = new URL(`${MUSIXMATCH_BASE}/matcher.track.get`);
  url.searchParams.set("q_artist", artist);
  url.searchParams.set("q_track", track);
  url.searchParams.set("apikey", apiKey);
  const data = await fetchJson<any>(url.toString());
  const id = data?.message?.body?.track?.track_id;
  return typeof id === "number" ? id : null;
}

async function fetchLyrics(
  trackId: number,
  apiKey: string,
): Promise<{ body: string; url: string } | null> {
  const url = new URL(`${MUSIXMATCH_BASE}/track.lyrics.get`);
  url.searchParams.set("track_id", String(trackId));
  url.searchParams.set("apikey", apiKey);
  const data = await fetchJson<any>(url.toString());
  const lyrics = data?.message?.body?.lyrics;
  const body = typeof lyrics?.lyrics_body === "string" ? lyrics.lyrics_body : "";
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
    const data = await fetchJson<any>(url.toString());
    const moodList = data?.message?.body?.mood_list ?? data?.message?.body?.moods;
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

/**
 * Fetches a mood-tagged lyric quote for a track, or null on failure. Resolves
 * the Musixmatch track id from the Spotify id when available (deterministic),
 * and only falls back to fuzzy (artist, track) text matching otherwise.
 */
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
    fetchLyrics(trackId, apiKey),
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
