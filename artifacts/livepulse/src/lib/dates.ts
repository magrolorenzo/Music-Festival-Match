// ============================================================================
// Date helpers for the Period filter.
//
// The mock dataset is seeded around summer 2026, so "today" is pinned to a
// fixed reference date. This keeps the Current Month / Next 3 Months filters
// deterministic regardless of the real system clock. When live data is wired
// in, replace APP_TODAY with `new Date()`.
// ============================================================================

import type { PeriodKey } from "@/services/types";

export const APP_TODAY = new Date("2026-06-15T00:00:00Z");

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

/** Resolves a Period filter into an inclusive ISO date range. */
export function periodToRange(period: PeriodKey): DateRange {
  const today = APP_TODAY;
  if (period === "current-month") {
    const start = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );
    return { startDate: toISODate(start), endDate: toISODate(end) };
  }
  // next-3-months: from today through the last day of the third month ahead
  // (inclusive). e.g. on Jun 15 this spans Jun 15 -> Sep 30.
  const start = today;
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 4, 0),
  );
  return { startDate: toISODate(start), endDate: toISODate(end) };
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
