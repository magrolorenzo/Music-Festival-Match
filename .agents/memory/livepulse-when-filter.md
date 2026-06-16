---
name: LivePulse When date filter
description: Design of the LivePulse "When" date filter (two separate From/To fields).
---

# LivePulse "When" date filter

Current design (replaced an earlier two-step single picker): the "When" area has
**two separate fields, "From" and "To"**, side by side. Each opens its own popover
with a **single-month** calendar (`numberOfMonths={1}`). They are edited
independently — there is no shared step/draft state.

Constraints:
- From defaults to today, disabled before APP_TODAY.
- To defaults to today + 15 days (`defaultDateRange()` in `lib/dates.ts`, via `defaultFilters()`).
- To disables days before the chosen From.
- Picking a From later than the current To advances To to match, so the range stays valid.

**Why:** The user explicitly rejected the range calendar AND the two-step / two-month
layouts; they want two plain From/To fields, one month at a time.
**How to apply:** Keep `range` (DayPickerRange) as the single source of truth; both
fields read/write it. handleReset/handleSubmit already fall back to APP_TODAY, so
keep those guards if refactoring.
