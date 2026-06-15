---
name: LivePulse design
description: Durable constraints/decisions for the LivePulse festival matchmaker app
---

# LivePulse

A dark-themed, frontend-only music festival matchmaker (React + Vite, in `artifacts/livepulse`).

## Pinned "today"
- The app's notion of "now" is a fixed pinned date, not the real clock.
- **Why:** the mock festivals are seeded for a specific season; using the real date pushes them out of the default time-period filters and the app returns empty results.
- **How to apply:** if seeded events look "missing", suspect the pinned-date vs period-range relationship before the matching logic. Don't move the pin without re-seeding the dataset.

## Data layer is a deliberate API seam
- The services layer is the single boundary between UI and data, intentionally shaped around the real partner schemas (JamBase events, Cyanite mood/audio analysis, Musixmatch quotes) so going live changes only the request transport, not the UI or data models.
- **How to apply:** keep UI reading from the service layer, not the raw mock JSON. A live swap should not require touching components.

## Taxonomy is a closed set; imported JSON is validated at runtime
- Genre/mood keys are a fixed taxonomy. The service layer validates the imported mock JSON at runtime and drops records whose keys fall outside that set.
- **Why:** TypeScript cannot type-check imported JSON, so a stray invalid key once passed compilation and fed bad data into matching.
- **How to apply:** only use keys defined in the taxonomy when adding events; if events silently vanish, check the console for the validation warning.
