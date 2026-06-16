---
name: Songstats + Musixmatch enrichment chain
description: Working endpoint paths and the Spotify-ID handoff between Songstats and Musixmatch
---

# Songstats (enterprise) + Musixmatch chain

LivePulse enriches artists by Songstats hype → Spotify track id → Musixmatch lyrics/mood.

## Songstats enterprise v1 (`api.songstats.com/enterprise/v1`, header `apikey:`)
- `artists/search?q=&limit=1` → artist; id at `results[0].songstats_artist_id`.
- `artists/stats?songstats_artist_id=&source=spotify` → monthly listeners / popularity.
- `artists/tracks` **does NOT exist (404)** — the working track list is
  `artists/catalog?songstats_artist_id=&limit=N` → `catalog[]` of `{songstats_track_id, title}`.
- `tracks/stats?songstats_track_id=&source=spotify&with_links=true` → both
  `stats[0].data.popularity_current` **and** `track_info.links[]`; pick
  `links.find(source==='spotify').external_id` = the Spotify track id. One call gets
  popularity + Spotify id together. **Why it matters:** that Spotify id is the
  deterministic key passed to Musixmatch, avoiding fuzzy artist/track text matching.

## Musixmatch (`api.musixmatch.com/ws/1.1`, query `apikey=`)
- `track.get?track_spotify_id=<spotifyId>` → resolves `message.body.track.track_id`
  deterministically. Prefer this; fall back to `matcher.track.get?q_artist&q_track` only
  when no Spotify id is available.
- `track.lyrics.get?track_id=` → lyric snippet (works).
- `track.lyrics.mood.get?track_id=` → **403 Forbidden on the current key** (enterprise-only).
  Mood is therefore expected to be empty; the pipeline degrades to empty moodKeys (no
  guessed artist mood). Do not treat empty moods as a bug — it's a key-tier limitation.
