---
name: LivePulse design
description: Durable constraints/decisions for the LivePulse festival matchmaker app
---

# LivePulse

A dark-themed, frontend-only music festival matchmaker (React + Vite, in `artifacts/livepulse`).

## Pinned "today"
- The app's notion of "now" is pinned to a fixed date (`APP_TODAY` in `src/lib/dates.ts`), not the real clock.
- **Why:** mock festivals are seeded for summer 2026; using the real date would push them out of the default period filters and the app would return empty results.
- **How to apply:** when seeded events look "missing", check the period range math against the pinned date before suspecting matching logic. Don't move the pin without re-seeding the dataset.

## Data layer is a deliberate API seam
- `src/services/{api,matching,search,types}.ts` is the single boundary between UI and data; it is intentionally shaped around real JamBase / Cyanite / Musixmatch schemas so a future live swap changes only the request transport inside each function, not the UI or models.
- **How to apply:** keep UI components reading from the service layer, not the raw JSON. Going live should not require touching components.

## Taxonomy is a closed set; JSON is validated at runtime
- Valid genre/mood keys live in `src/lib/taxonomy.ts` and `src/services/types.ts`. `validateEvents` in `api.ts` drops (and console-errors) any event whose performer carries a genre/mood key outside that set, because TypeScript cannot type-check imported JSON.
- **Why:** an earlier data bug (a stray `"pop"` mood key) passed typecheck silently and fed invalid data into matching.
- **How to apply:** when adding mock events, only use keys defined in the taxonomy; if events vanish, check the console for the validation warning.
