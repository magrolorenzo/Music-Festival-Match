---
name: react-day-picker date serialization
description: Why LivePulse date helpers must use local calendar fields, not UTC
---

When pairing a date string filter (`"YYYY-MM-DD"`) with `react-day-picker`, serialize and parse using **local** calendar fields.

**Rule:** `toISODate` must build the string from `getFullYear`/`getMonth`/`getDate` (not `toISOString().slice(0,10)`), and `fromISODate` must use `new Date(y, m-1, d)` (not `new Date("...T00:00:00Z")`). Any pinned reference date (e.g. `APP_TODAY`) must be `new Date(y, m, d)`, not a UTC string literal.

**Why:** react-day-picker selects/returns local-time Date objects. Going through UTC shifts the day by one for users west/east of UTC (the bug is invisible in the UTC dev container but real for actual users), producing wrong start/end dates and wrong filtered results.

**How to apply:** Lives in `artifacts/livepulse/src/lib/dates.ts`. Note `formatEventDate`/`eventYear` intentionally still use UTC getters because they parse static dataset ISO strings (`"2026-06-24"`) which JS parses as UTC midnight — that path is internally consistent and must stay UTC.
