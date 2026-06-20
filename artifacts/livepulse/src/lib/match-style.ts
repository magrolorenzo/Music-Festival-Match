// ============================================================================
// Shared styling + ordering for "matched" genre/mood badges.
//
// A genre or mood that satisfies the user's active filters is highlighted in
// the brand orange (primary) — the same cue across the result list cards and
// the detail popup — and is sorted ahead of the non-matching ones.
// ============================================================================

/** Badge classes for a key that matches an active filter (brand orange). */
export const MATCH_BADGE =
  "bg-primary/30 text-white border-primary/60 font-semibold shadow-[0_0_12px_rgba(255,69,0,0.35)]";

/** Badge classes for a non-matching key (muted, neutral). */
export const PLAIN_BADGE = "bg-white/5 text-white/70 border-white/5";

/**
 * Returns `keys` with the matching ones first, preserving the original relative
 * order within each group (Array.prototype.sort is stable).
 */
export function matchedFirst<T>(keys: T[], matched: Iterable<T>): T[] {
  const set = new Set(matched);
  return [...keys].sort(
    (a, b) => Number(set.has(b)) - Number(set.has(a)),
  );
}
