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
 * Cache is bounded by adaptive quota logic based on available storage.
 *
 * Cache modes (based on navigator.storage.estimate):
 *   full     – ≥ 500 MB free → cache all playlist items (MAX_ENTRIES)
 *   limited  – 100–500 MB free → cache next 3 items only
 *   streaming – < 100 MB free → no precaching, rely on network
 */

const CACHE_NAME = 'telumi-media-v1';

// ── Adaptive quota thresholds ────────────────────────────────────────
const FULL_THRESHOLD_BYTES = 500 * 1024 * 1024;     // 500 MB
const LIMITED_THRESHOLD_BYTES = 100 * 1024 * 1024;   // 100 MB
const FULL_MAX_ENTRIES = 50;
const LIMITED_MAX_ENTRIES = 3;

export type CacheMode = 'full' | 'limited' | 'streaming';

let _currentCacheMode: CacheMode = 'full';

/** Returns the current caching mode. */
export function getCacheMode(): CacheMode {
  return _currentCacheMode;
}

/** Detect available storage and set the cache mode accordingly. */
export async function detectCacheMode(): Promise<CacheMode> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    _currentCacheMode = 'limited';
    return _currentCacheMode;
  }

  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    const available = quota - usage;

    if (available >= FULL_THRESHOLD_BYTES) {
      _currentCacheMode = 'full';
    } else if (available >= LIMITED_THRESHOLD_BYTES) {
      _currentCacheMode = 'limited';
    } else {
      _currentCacheMode = 'streaming';
    }
  } catch {
    _currentCacheMode = 'limited';
  }

  return _currentCacheMode;
}

function getMaxEntries(): number {
  switch (_currentCacheMode) {
    case 'full': return FULL_MAX_ENTRIES;
    case 'limited': return LIMITED_MAX_ENTRIES;
    case 'streaming': return 0;
  }
}

/** Returns true when the Cache API is available in the current browser. */
function isCacheAvailable(): boolean {
  return typeof caches !== 'undefined';
}

/**
 * Pre-cache a list of asset URLs.
 * Skips URLs already in cache. Silently ignores failures.
 * Respects the current cache mode — in streaming mode, does nothing.
 */
export async function precacheAssets(
  urls: string[],
  options?: { limit?: number },
): Promise<void> {
  if (!isCacheAvailable() || urls.length === 0) return;

  const maxEntries = getMaxEntries();
  if (maxEntries <= 0) return; // streaming mode

  // In limited mode, only cache the first N URLs
  const adaptiveUrls = _currentCacheMode === 'limited'
    ? urls.slice(0, LIMITED_MAX_ENTRIES)
    : urls;
  const urlsToCache = options?.limit != null
    ? adaptiveUrls.slice(0, Math.max(0, options.limit))
    : adaptiveUrls;

  try {
    const cache = await caches.open(CACHE_NAME);
    const existingKeys = await cache.keys();
    const existingUrls = new Set(existingKeys.map((r) => r.url));

    const toCache = urlsToCache.filter((u) => !existingUrls.has(u));

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

export async function isAssetCached(url: string): Promise<boolean> {
  const response = await getCachedResponse(url);
  return Boolean(response);
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
 * Evict oldest entries when we exceed the adaptive max.
 */
async function evictOldEntries(): Promise<void> {
  try {
    const maxEntries = getMaxEntries();
    if (maxEntries <= 0) {
      // streaming mode — purge everything
      await caches.delete(CACHE_NAME);
      return;
    }

    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();

    if (keys.length <= maxEntries) return;

    const toRemove = keys.slice(0, keys.length - maxEntries);
    await Promise.allSettled(toRemove.map((key) => cache.delete(key)));
  } catch {
    // ignore
  }
}
