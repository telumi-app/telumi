/**
 * Telumi Player — Service Worker
 *
 * Strategies:
 *   /_next/static/*   → CacheFirst  (immutable build assets)
 *   Media files        → CacheFirst  (uses same cache name as media-cache.ts)
 *   Everything else    → NetworkOnly (API calls, HTML)
 *
 * The worker is intentionally dependency-free (no Workbox CDN import)
 * so it works on Smart TV browsers that may block external scripts.
 */

const STATIC_CACHE = 'telumi-static-v1';
const MEDIA_CACHE = 'telumi-media-v1'; // keep in sync with media-cache.ts
const KNOWN_CACHES = [STATIC_CACHE, MEDIA_CACHE];

// ── Lifecycle ────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  // Activate immediately — no waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Purge unknown caches from previous versions
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('telumi-') && !KNOWN_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      ),
    ]),
  );
});

// ── Fetch interception ───────────────────────────────────────────────

/**
 * Detect media URLs: HLS segments (.ts, .m3u8), images, videos.
 * Also matches MinIO presigned URLs by extension before query string.
 */
function isMediaUrl(url) {
  const path = url.pathname.toLowerCase();
  return (
    path.endsWith('.ts') ||
    path.endsWith('.m3u8') ||
    path.endsWith('.mp4') ||
    path.endsWith('.webm') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.png') ||
    path.endsWith('.webp') ||
    path.endsWith('.gif') ||
    path.endsWith('.svg') ||
    // HLS proxy path from our API
    path.includes('/media/hls/')
  );
}

/**
 * CacheFirst: return cached response or fetch → cache → return.
 */
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      // Clone before caching (response body is a stream)
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // If both cache and network fail, return a minimal error response
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension, devtools, etc.
  if (!url.protocol.startsWith('http')) return;

  // CacheFirst for immutable build assets
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // CacheFirst for media assets
  if (isMediaUrl(url)) {
    event.respondWith(cacheFirst(event.request, MEDIA_CACHE));
    return;
  }

  // Everything else: let the browser handle it normally (NetworkOnly)
});
