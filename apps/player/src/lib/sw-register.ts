/**
 * Service Worker registration helper.
 *
 * Registers the SW from /sw.js if the browser supports it.
 * Gracefully degrades on Smart TVs that lack SW support.
 */

let registered = false;

export async function registerServiceWorker(): Promise<void> {
  if (registered) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    registered = true;

    // Auto-update: when a new SW is found, activate it immediately
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          // Optional: could notify the player to refresh cache
          console.info('[SW] New service worker activated.');
        }
      });
    });
  } catch (err) {
    // SW registration failed — non-fatal, player continues without offline cache
    console.warn('[SW] Registration failed:', err);
  }
}
