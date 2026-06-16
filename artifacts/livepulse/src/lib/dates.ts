// ============================================================================
// Date helpers for the calendar date filter.
//
// "Today" is the real current day (local midnight). The default search window
// starts today, so the From field always opens on today's date.
// ============================================================================

// The app's reference "today" — the real current day, normalised to local
// midnight. Constructed from local calendar components (not a UTC string) so it
// round-trips correctly with the calendar picker, which operates on local-time
// Date objects.
const NOW = new Date();
export const APP_TODAY = new Date(
  NOW.getFullYear(),
  NOW.getMonth(),
  NOW.getDate(),
);

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
 * The default search window: from today through 15 days later (inclusive).
 * e.g. on Jun 15 this spans Jun 15 -> Jun 30.
 */
export function defaultDateRange(): DateRange {
  const today = APP_TODAY;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 15);
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
