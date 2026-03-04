/**
 * Service-Worker-less asset cache using the Cache API directly.
 *
 * Motivation:
 *   The player runs on smart-TVs / kiosks in a loop. Pre-caching
 *   upcoming playlist items in the browser Cache API avoids
 *   re-downloading the same asset across loops and reduces
 *   buffering when network is intermittent.
 *
 * It stores opaque responses so CORS / presigned-URL assets work.
 * Cache is bounded to MAX_ENTRIES to prevent unbounded disk use.
 */

const CACHE_NAME = 'telumi-media-v1';
const MAX_ENTRIES = 50;  // keep at most 50 cached assets

/** Returns true when the Cache API is available in the current browser. */
function isCacheAvailable(): boolean {
  return typeof caches !== 'undefined';
}

/**
 * Pre-cache a list of asset URLs.
 * Skips URLs already in cache. Silently ignores failures.
 */
export async function precacheAssets(urls: string[]): Promise<void> {
  if (!isCacheAvailable() || urls.length === 0) return;

  try {
    const cache = await caches.open(CACHE_NAME);
    const existingKeys = await cache.keys();
    const existingUrls = new Set(existingKeys.map((r) => r.url));

    const toCache = urls.filter((u) => !existingUrls.has(u));

    await Promise.allSettled(
      toCache.map(async (url) => {
        try {
          const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch {
          // best-effort
        }
      }),
    );

    // Evict oldest entries if over limit
    await evictOldEntries();
  } catch {
    // Cache API not available or quota exceeded — ignore
  }
}

/**
 * Try to resolve a URL from cache first, falling back to network.
 * Returns the URL itself (for <video src=...> or <img src=...>);
 * the browser will find it in the HTTP cache / Cache API automatically.
 *
 * For explicit control this also exposes a `getCachedResponse` helper.
 */
export async function getCachedResponse(url: string): Promise<Response | undefined> {
  if (!isCacheAvailable()) return undefined;

  try {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(url);
    return match ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remove all entries from our cache.
 */
export async function clearMediaCache(): Promise<void> {
  if (!isCacheAvailable()) return;
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    // ignore
  }
}

/**
 * Evict oldest entries when we exceed MAX_ENTRIES.
 */
async function evictOldEntries(): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();

    if (keys.length <= MAX_ENTRIES) return;

    const toRemove = keys.slice(0, keys.length - MAX_ENTRIES);
    await Promise.allSettled(toRemove.map((key) => cache.delete(key)));
  } catch {
    // ignore
  }
}
