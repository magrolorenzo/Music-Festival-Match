---
name: JamBase genreSlug server-side filter
description: How genre filtering works via JamBase's genreSlug parameter and our client-side safety net.
---

## Behaviour
- When `SearchInput.genres` is non-empty, `fetchJamBaseEvents` adds `genreSlug=pop|rock|indie` (pipe-joined) to the JamBase URL.
- The genre→slug mapping lives in `GENRE_TO_JAMBASE` in `jambase.ts`.
- The JamBase URL including genreSlug becomes the cache key, so different genre selections cache independently.
- Client-side `eventMatchesGenres` filter is **kept** as a safety net (JamBase slugs may return broader results than performer-level genre arrays).

**Why:** User requested server-side genre filtering via JamBase `genreSlug` instead of fetching all events and filtering locally.

**How to apply:** If a new genre key is added to the taxonomy, add a corresponding entry to `GENRE_TO_JAMBASE`. Genres with no JamBase equivalent are silently omitted from the slug (client-side filter still catches them).
