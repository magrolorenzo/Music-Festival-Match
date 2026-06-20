---
name: Musixmatch enrichment flow
description: How per-artist enrichment works after the Songstats removal — track.search → lyrics.analysis, cache strategy, data shape.
---

## Flow
1. `fetchArtistTracks(name)` in `musixmatch.ts`:
   - Normalize name for API query: lowercase, strip accents/apostrophes, keep spaces.
   - Call `track.search?q_artist={name}&page_size=3&s_track_rating=desc` → top 3 tracks.
   - For each track where `has_lyrics === 1`, call `track.lyrics.analysis.get?track_id={id}`.
   - Extract: `analysis.moods.main_moods[]` (string array) and `analysis.themes.main_themes[0].quotes[]` — all excerpts of the top theme joined with ", " into one quote string (single excerpt passes through unchanged).
   - Each API call is URL-cached via `withCache("musixmatch", url, fn)`.

2. `enrichArtist(name)` in `enrichment.ts`:
   - Cache key: `artist:{normalizeArtistName(name)}` — lowercase, accents/apostrophes/spaces → `+`.
   - Service key: `musixmatch-enrichment` in `api_cache` table (30-day TTL).
   - Returns `EnrichedArtistData { tracks: EnrichedTrack[], moodKeys: MoodKey[] }`.
   - `moodKeys` are pre-computed via `mapMoods()` across all tracks with analysis.

## Performer shape (API response)
- `tracks: Track[]` — trackId, trackName, trackRating, spotifyId, albumName.
- `quotes: MusixmatchQuote[]` — one per track with lyrics: `{ trackName, moods: MoodKey[], quote: string }`.
- `cyanite.moodKeys` — aggregated from all tracks' analysis moods.
- **No** `songstats` or `recommendedSongs` fields.

## Frontend (DetailPopup PerformerCard)
- Mood badges from `performer.cyanite.moodKeys`.
- Quote box: `quote.quote` string + `quote.trackName`.
- Track list: up to 3 items, shows `trackName` + `albumName` (no Spotify player yet).
- `pickArtistQuote()` matches via `q.moods.includes(preferredMood)`.

**Why:** Songstats was removed from the flow; Musixmatch enterprise `track.lyrics.analysis.get` gives moods + theme quotes directly without needing Songstats track IDs as input.

**How to apply:** Any future change to per-artist enrichment should go through `enrichment.ts → fetchArtistTracks`. Do NOT re-add Songstats to the main pipeline without user approval. The `artist_enrichment` DB table is now unused (do not write to it).
