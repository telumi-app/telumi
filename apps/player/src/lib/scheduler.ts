/**
 * Deterministic Scheduler
 *
 * Given a playlist with known item durations, calculates which item
 * should be playing at any wall-clock instant.  Every device sharing
 * the same playlist shows the same content at the same moment —
 * enabling synchronised multi-screen displays.
 *
 * Algorithm:
 *   1. totalCycleMs  = sum(item.durationMs)
 *   2. elapsedInCycle = Date.now() % totalCycleMs
 *   3. Walk items accumulating duration to find current item + offset
 */

export type SchedulableItem = {
  assetId: string;
  durationMs: number;
};

export type SchedulePosition = {
  /** Index of the item that should be playing now */
  index: number;
  /** How many ms into this item we already are */
  offsetMs: number;
};

/**
 * Compute the deterministic playback position for the current instant.
 *
 * @param items  Playlist items with known durations
 * @param epoch  Optional epoch offset (ms). Defaults to 0 (Unix epoch).
 *               All devices sharing a playlist should use the same epoch.
 * @returns      Current index and offset within that item
 */
export function getSchedulePosition(
  items: readonly SchedulableItem[],
  epoch = 0,
): SchedulePosition {
  if (items.length === 0) return { index: 0, offsetMs: 0 };

  const totalCycleMs = items.reduce((sum, i) => sum + Math.max(1, i.durationMs), 0);
  if (totalCycleMs <= 0) return { index: 0, offsetMs: 0 };

  const now = Date.now() - epoch;
  const elapsedInCycle = ((now % totalCycleMs) + totalCycleMs) % totalCycleMs; // handle negative modulo

  let accumulated = 0;
  for (let i = 0; i < items.length; i++) {
    const dur = Math.max(1, items[i].durationMs);
    if (accumulated + dur > elapsedInCycle) {
      return {
        index: i,
        offsetMs: elapsedInCycle - accumulated,
      };
    }
    accumulated += dur;
  }

  // Rounding edge case — return last item
  return { index: items.length - 1, offsetMs: 0 };
}

/**
 * Calculate the time remaining (ms) for the current item.
 */
export function getRemainingMs(
  items: readonly SchedulableItem[],
  epoch = 0,
): number {
  if (items.length === 0) return 0;

  const pos = getSchedulePosition(items, epoch);
  const dur = Math.max(1, items[pos.index].durationMs);
  return Math.max(0, dur - pos.offsetMs);
}

/**
 * Returns the index of the next item after `currentIndex`.
 */
export function getNextIndex(currentIndex: number, totalItems: number): number {
  if (totalItems <= 0) return 0;
  return (currentIndex + 1) % totalItems;
}
