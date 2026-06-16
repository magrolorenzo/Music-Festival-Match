// ============================================================================
// Small HTTP / concurrency helpers shared by the partner clients.
// ============================================================================

/**
 * fetch() with an abort-based timeout. Throws on network error, non-2xx, or
 * timeout so callers can catch-and-degrade. Default budget keeps a single slow
 * partner from stalling the whole search.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 6000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Maps an array through an async worker with a bounded concurrency pool, so a
 * fan-out across many artists never opens hundreds of sockets at once.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runner(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  const pool = Array.from(
    { length: Math.min(limit, items.length) },
    () => runner(),
  );
  await Promise.all(pool);
  return results;
}
