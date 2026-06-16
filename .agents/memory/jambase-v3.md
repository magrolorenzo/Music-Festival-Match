---
name: JamBase v3 events API
description: Auth scheme, date constraints, and response shape for the JamBase v3 data API
---

# JamBase v3 (`api.data.jambase.com/v3/events`)

- **Auth:** `Authorization: Bearer <key>` header. Keys are `jbd_*` ("data" API). The
  older `www.jambase.com/jb-api/v1` endpoint with `apikey` query param rejects these
  `jbd_` keys (403 `api_key_invalid`). v3 with `apikey` query → 401. Bearer is correct.
- **Date floor:** `eventDateFrom` must be **on or after tomorrow** (relative to JamBase's
  server clock) unless the key has `expandPastEvents` enabled. Sending today's date → HTTP
  400 `invalid_param`. **Why:** a search defaulting startDate to "today" will 400 and look
  like an auth/param bug. **How to apply:** clamp `eventDateFrom` to `max(requested, today+1)`
  before the request; lexicographic compare on `YYYY-MM-DD` is safe.
- A 400 (not 401) from v3 means auth passed and a *param* is wrong — read the JSON
  `errors[].message`, it names the offending param precisely.
- **Response shape:** `{ success, pagination, events: [...] }`. Each event is schema.org-ish:
  `@type` ("Festival"/"Concert"), `name`, `identifier`, `startDate`/`endDate`,
  `location.geo.{latitude,longitude}`, `location.address.{addressLocality,addressCountry.name}`,
  `performer[]`. Parse defensively — fields vary and `performer` may be absent.
