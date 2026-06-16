---
name: LivePulse When date filter
description: Two-step start/end date picker design constraints for the LivePulse "When" filter.
---

# LivePulse "When" date filter

The "When" filter is a **two-step sequential** picker in a dropdown: step 1 picks a
start date, step 2 picks an end date. Each step renders two months (current + next).
It is NOT a single range calendar and NOT two side-by-side calendars (user explicitly
rejected both).

**Rule:** Hold the in-progress start in a separate draft state and only commit to the
real range state when the end date is selected. Selecting a new start must NOT mutate
the committed range.
**Why:** If the start immediately overwrites the committed range (clearing the end),
closing the popover mid-flow silently shrinks the search window to a single day — a
data-loss bug caught in review. Draft-commit keeps the prior range intact on mid-flow
close and on the back button (which keeps the draft start highlighted).
**How to apply:** Any rework of this picker (or similar multi-step commit flows) should
preserve the draft-then-commit pattern and reset draft/step state on open and on reset.

Default window is today → today + 15 days (see `defaultDateRange()` in `lib/dates.ts`),
sourced via `defaultFilters()`. Minimum selectable date is always APP_TODAY.
