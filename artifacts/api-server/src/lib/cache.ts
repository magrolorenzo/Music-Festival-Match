import { eq, and } from "drizzle-orm";
import { db, apiCacheTable } from "@workspace/db";
import { logger } from "./logger";

// ============================================================================
// Global API response cache for all external partner services.
//
// Controlled by ENABLE_API_CACHE env var. When false, every call goes straight
// to the upstream API. When true (or unset), responses are cached in PostgreSQL
// for 30 days and served from the DB while the row is still fresh.
// ============================================================================

export const CACHE_ENABLED = false;

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Read a cached API response by service + cache key, or null if stale/missing. */
export async function readCache<T>(
  serviceKey: string,
  cacheKey: string,
): Promise<T | null> {
  if (!CACHE_ENABLED) return null;
  try {
    const [row] = await db
      .select()
      .from(apiCacheTable)
      .where(
        and(
          eq(apiCacheTable.serviceKey, serviceKey),
          eq(apiCacheTable.cacheKey, cacheKey),
        ),
      );
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    return row.data as T;
  } catch (err) {
    logger.warn({ err, serviceKey, cacheKey }, "cache read failed");
    return null;
  }
}

/** Write a raw JSON response to the cache with a 30-day TTL. */
export async function writeCache<T>(
  serviceKey: string,
  cacheKey: string,
  data: T,
): Promise<void> {
  if (!CACHE_ENABLED) return;
  try {
    const expiresAt = new Date(Date.now() + TTL_MS);
    await db
      .insert(apiCacheTable)
      .values({ serviceKey, cacheKey, data, expiresAt })
      .onConflictDoUpdate({
        target: [apiCacheTable.serviceKey, apiCacheTable.cacheKey],
        set: { data, expiresAt },
      });
  } catch (err) {
    logger.warn({ err, serviceKey, cacheKey }, "cache write failed");
  }
}

/**
 * Wrap any async fetch function with the cache layer.
 * When cache is enabled, tries read first; on miss, calls fn, then writes.
 */
export async function withCache<T>(
  serviceKey: string,
  cacheKey: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!CACHE_ENABLED) return fn();
  const cached = await readCache<T>(serviceKey, cacheKey);
  if (cached !== null) {
    return cached;
  }
  const fresh = await fn();
  await writeCache(serviceKey, cacheKey, fresh);
  return fresh;
}
