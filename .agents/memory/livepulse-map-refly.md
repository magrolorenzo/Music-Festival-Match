---
name: LivePulse map re-fly on hover
description: Why MapController's flyToBounds effect must depend on primitive coords, not the searchCenter object.
---

# MapController flyToBounds must depend on primitive coords

In `artifacts/livepulse/src/components/LiveMap.tsx`, the `MapController` framing effect
that calls `map.flyToBounds(...)` must depend on the primitive `latitude` / `longitude`
/ `radiusKm` values, NOT on the `searchCenter` object reference.

**Why:** `Results.tsx` builds `searchCenter` as a fresh object literal on every render.
Hovering a list card calls `setHoveredEventId`, which re-renders `Results`, which gives
`searchCenter` a new reference. An effect keyed on `[searchCenter, map]` then re-runs
`flyToBounds` on every hover — the map visibly re-flies/zooms even though the actual
location never changed. This is the regression behind "hovering a card moves the map."

**How to apply:** When an effect should run only when *values* change but the parent
passes a freshly-constructed object/array each render, key the effect on the primitive
fields (or `useMemo` the object in the parent). Same pattern applies to any future
map-framing or selection effects here.
