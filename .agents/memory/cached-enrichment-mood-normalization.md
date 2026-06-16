---
name: Cached enrichment mood normalization
description: Why search assembly must re-run mapMoods over DB-cached enrichment before responding.
---

Re-normalize every mood string from cached artist enrichment through `mapMoods`
(and `coerceMood` for single quote moods) in the search orchestrator before the
data hits the response Zod schema.

**Why:** Enrichment is DB-cached and can outlive a taxonomy change. Cached rows
held raw labels like `"energetic"` that are not in the current MoodKey enum.
Casting `as MoodKey` does not validate, so the stray value sailed through until
the response Zod parse threw, returning HTTP 500 on `/api/search`. Removing the
mock-data fallback made every search hit live + cache, so the latent bug became
a hard failure.

**How to apply:** Treat any cached/external taxonomy value as untrusted. Map it
through the current taxonomy rules (all MoodKey/GenreKey rules include their own
key as a self-matching pattern, so valid values survive) and fall back to a safe
default (`"party"`) rather than trusting a type cast.
