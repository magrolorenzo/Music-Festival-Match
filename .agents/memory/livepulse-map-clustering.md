---
name: LivePulse results map clustering
description: How the results map groups/splits markers and why there is no "Show more" paging.
---

# LivePulse results map: city clustering, no per-venue paging

The results map groups venues into ONE pin per city when zoomed out (below
Leaflet zoom ~12), showing the city's total event count + name. Clicking a city
pin flies into it (or zooming past the threshold) splits it into individual
venue dots. Venue popups list ALL events in a scroll container.

**Why:** The user explicitly wants overlapping city venues grouped under the
city name and split on click/zoom, and explicitly asked to REMOVE the venue
popup "Show more" / paging button. An earlier task scoped this as "make Show
more work" — that was the wrong interpretation; do not reintroduce per-venue
event pagination.

**How to apply:** Keep the zoom-gated city/venue rendering. If adding marker
features, preserve: list-hover must NOT move the map (only recolor the matching
pin), and selecting an event flies in at venue-level zoom (the detail overlay
covers the map anyway).
