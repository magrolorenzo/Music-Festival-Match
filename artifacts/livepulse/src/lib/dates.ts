// ============================================================================
// Date helpers for the calendar date filter.
//
// The mock dataset is seeded around summer 2026, so "today" is pinned to a
// fixed reference date. This keeps the default date window deterministic
// regardless of the real system clock. When live data is wired in, replace
// APP_TODAY with `new Date()`.
// ============================================================================

// Pinned to a fixed reference "today". Constructed from local calendar
// components (not a UTC string) so it round-trips correctly with the calendar
// picker, which operates on local-time Date objects.
export const APP_TODAY = new Date(2026, 5, 15);

/**
 * Formats a Date as a "YYYY-MM-DD" string using its LOCAL calendar fields.
 * The calendar picker hands us local-time dates, so we must not go through UTC
 * (which would shift the day for users west/east of UTC).
 */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses a "YYYY-MM-DD" string into a LOCAL-time Date (midnight). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * The default search window: from today through the last day of the third
 * month ahead (inclusive). e.g. on Jun 15 this spans Jun 15 -> Sep 30.
 */
export function defaultDateRange(): DateRange {
  const today = APP_TODAY;
  const end = new Date(today.getFullYear(), today.getMonth() + 4, 0);
  return { startDate: toISODate(today), endDate: toISODate(end) };
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Jun 24" or "Jun 24 – 28" or "Jun 24 – Jul 2". */
export function formatEventDate(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const sM = MONTHS[start.getUTCMonth()];
  const sD = start.getUTCDate();
  if (startISO === endISO) return `${sM} ${sD}`;
  const eM = MONTHS[end.getUTCMonth()];
  const eD = end.getUTCDate();
  if (sM === eM) return `${sM} ${sD} – ${eD}`;
  return `${sM} ${sD} – ${eM} ${eD}`;
}

/** "2026" — the year of the event start. */
export function eventYear(startISO: string): string {
  return String(new Date(startISO).getUTCFullYear());
}
