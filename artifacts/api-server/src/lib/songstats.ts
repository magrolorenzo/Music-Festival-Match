import { fetchJson } from "./http";

// ============================================================================
// Songstats artist hype client (enterprise API).
//
// Cascade: search artist -> read cross-platform stats -> read top tracks.
// Every shape is read defensively across the documented field variants; any
// gap returns null so the enrichment layer can fall back to placeholders.
// ============================================================================

const SONGSTATS_BASE = "https://api.songstats.com/enterprise/v1";

export interface SongstatsTrack {
  trackName: string;
  popularity: number;
  /** Spotify track id, used to resolve lyrics/mood deterministically downstream. */
  spotifyId: string | null;
}

export interface SongstatsResult {
  popularityTrend: string;
  monthlyListeners: number;
  popularityScore: number;
  topTracks: SongstatsTrack[];
}

function headers(apiKey: string): Record<string, string> {
  return { Accept: "application/json", apikey: apiKey };
}

function pickNumber(...values: unknown[]): number {
  for (const v of values) {
    const n = typeof v === "string" ? Number(v) : (v as number);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

async function findArtistId(
  name: string,
  apiKey: string,
): Promise<string | null> {
  const url = new URL(`${SONGSTATS_BASE}/artists/search`);
  url.searchParams.set("q", name);
  url.searchParams.set("limit", "1");
  const data = await fetchJson<any>(url.toString(), { headers: headers(apiKey) });
  const list = data?.results ?? data?.artists ?? data?.data ?? [];
  const first = Array.isArray(list) ? list[0] : null;
  const id =
    first?.songstats_artist_id ??
    first?.artist_id ??
    first?.id ??
    first?.songstats_id;
  return id ? String(id) : null;
}

async function fetchStats(
  artistId: string,
  apiKey: string,
): Promise<{ monthlyListeners: number; popularityScore: number; trend: string }> {
  const url = new URL(`${SONGSTATS_BASE}/artists/stats`);
  url.searchParams.set("songstats_artist_id", artistId);
  url.searchParams.set("source", "spotify");
  const data = await fetchJson<any>(url.toString(), { headers: headers(apiKey) });

  const stats =
    data?.stats?.[0]?.data ?? data?.stats?.data ?? data?.data ?? data?.stats ?? {};

  const monthlyListeners = pickNumber(
    stats.monthly_listeners_current,
    stats.monthly_listeners,
    stats.listeners,
    data?.monthly_listeners,
  );
  const popularityScore = pickNumber(
    stats.popularity_current,
    stats.popularity,
    stats.sp_popularity,
  );
  const growth = pickNumber(
    stats.monthly_listeners_growth_percent,
    stats.popularity_growth_percent,
    stats.growth_percent,
  );
  const trend = Number.isFinite(growth)
    ? `${growth >= 0 ? "+" : ""}${Math.round(growth)}%`
    : "—";

  return {
    monthlyListeners: Number.isFinite(monthlyListeners) ? monthlyListeners : 0,
    popularityScore: clampScore(popularityScore),
    trend,
  };
}

/** Reads the artist's track catalog (id + title), most-relevant first. */
async function fetchCatalog(
  artistId: string,
  apiKey: string,
  limit: number,
): Promise<Array<{ trackId: string; title: string }>> {
  const url = new URL(`${SONGSTATS_BASE}/artists/catalog`);
  url.searchParams.set("songstats_artist_id", artistId);
  url.searchParams.set("limit", String(limit));
  const data = await fetchJson<any>(url.toString(), { headers: headers(apiKey) });
  const list = data?.catalog ?? data?.results ?? data?.data ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .map((t: any) => ({
      trackId: t?.songstats_track_id ? String(t.songstats_track_id) : "",
      title:
        typeof t?.title === "string"
          ? t.title
          : typeof t?.name === "string"
            ? t.name
            : "",
    }))
    .filter((t: { trackId: string; title: string }) => t.trackId && t.title);
}

/**
 * Reads a single track's Spotify popularity and Spotify track id in one call.
 * The Spotify id is what Musixmatch consumes for deterministic lyric/mood
 * lookup, so it is carried through the enrichment payload.
 */
async function fetchTrackMeta(
  trackId: string,
  apiKey: string,
): Promise<{ popularity: number; spotifyId: string | null }> {
  const url = new URL(`${SONGSTATS_BASE}/tracks/stats`);
  url.searchParams.set("songstats_track_id", trackId);
  url.searchParams.set("source", "spotify");
  url.searchParams.set("with_links", "true");
  const data = await fetchJson<any>(url.toString(), { headers: headers(apiKey) });

  const stat = data?.stats?.[0]?.data ?? data?.stats?.data ?? {};
  const popularity = clampScore(
    pickNumber(stat.popularity_current, stat.popularity, stat.sp_popularity, 60),
  );

  const links = data?.track_info?.links ?? [];
  const spotify = Array.isArray(links)
    ? links.find((l: any) => l?.source === "spotify" && l?.external_id)
    : null;

  return {
    popularity,
    spotifyId: spotify ? String(spotify.external_id) : null,
  };
}

async function fetchTopTracks(
  artistId: string,
  apiKey: string,
): Promise<SongstatsTrack[]> {
  const catalog = await fetchCatalog(artistId, apiKey, 6);
  const targets = catalog.slice(0, 3);
  const metas = await Promise.all(
    targets.map((t) =>
      fetchTrackMeta(t.trackId, apiKey).catch(() => ({
        popularity: 60,
        spotifyId: null,
      })),
    ),
  );
  return targets.map((t, i) => ({
    trackName: t.title,
    popularity: metas[i].popularity,
    spotifyId: metas[i].spotifyId,
  }));
}

export function hasSongstatsKey(): boolean {
  return Boolean(process.env.SONGSTATS_API_KEY);
}

/** Returns hype metrics + top tracks for an artist, or null on any failure. */
export async function fetchArtistHype(
  name: string,
): Promise<SongstatsResult | null> {
  const apiKey = process.env.SONGSTATS_API_KEY;
  if (!apiKey) return null;

  const artistId = await findArtistId(name, apiKey);
  if (!artistId) return null;

  const [stats, topTracks] = await Promise.all([
    fetchStats(artistId, apiKey),
    fetchTopTracks(artistId, apiKey).catch(() => []),
  ]);

  return {
    popularityTrend: stats.trend,
    monthlyListeners: stats.monthlyListeners,
    popularityScore: stats.popularityScore,
    topTracks,
  };
}
