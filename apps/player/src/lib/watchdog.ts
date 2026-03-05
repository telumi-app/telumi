/**
 * Playback Watchdog
 *
 * Monitors a <video> element for stalled playback and escalates
 * recovery actions:
 *
 *   Level 0 – Wait 5 s (may self-recover)
 *   Level 1 – Force play()
 *   Level 2 – Skip to next item (callback)
 *   Level 3 – Full page reload
 *
 * Also detects "hung items" — when an item has been active longer
 * than maxItemDurationMs (3× its declared duration or 5 min max).
 */

export type WatchdogCallbacks = {
  /** Called when the watchdog decides to skip the current item */
  onSkip: () => void;
  /** Called when the watchdog decides the page must reload */
  onReload: () => void;
};

export type WatchdogConfig = {
  /** Interval (ms) between health checks. Default: 3000 */
  checkIntervalMs?: number;
  /** Consecutive stall ticks before escalating. Default: 2 (= ~6 s) */
  stallThreshold?: number;
  /** Max multiplier of item duration before forcing skip. Default: 3 */
  maxDurationMultiplier?: number;
  /** Absolute max ms an item can stay active. Default: 300000 (5 min) */
  absoluteMaxMs?: number;
};

const DEFAULT_CHECK_INTERVAL = 3_000;
const DEFAULT_STALL_THRESHOLD = 2;
const DEFAULT_MAX_DURATION_MULT = 3;
const DEFAULT_ABSOLUTE_MAX = 300_000;

export class PlaybackWatchdog {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private lastCurrentTime = -1;
  private stallCount = 0;
  private escalationLevel = 0;
  private itemStartedAt = 0;
  private itemDurationMs = 0;
  private callbacks: WatchdogCallbacks;
  private config: Required<WatchdogConfig>;

  constructor(callbacks: WatchdogCallbacks, config: WatchdogConfig = {}) {
    this.callbacks = callbacks;
    this.config = {
      checkIntervalMs: config.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL,
      stallThreshold: config.stallThreshold ?? DEFAULT_STALL_THRESHOLD,
      maxDurationMultiplier: config.maxDurationMultiplier ?? DEFAULT_MAX_DURATION_MULT,
      absoluteMaxMs: config.absoluteMaxMs ?? DEFAULT_ABSOLUTE_MAX,
    };
  }

  /**
   * Start monitoring a video element.
   * Call this whenever the active video changes.
   */
  watch(video: HTMLVideoElement | null, itemDurationMs: number): void {
    this.stop();

    this.videoEl = video;
    this.itemDurationMs = itemDurationMs;
    this.itemStartedAt = Date.now();
    this.lastCurrentTime = -1;
    this.stallCount = 0;
    this.escalationLevel = 0;

    if (!video) return;

    this.intervalId = setInterval(() => this.tick(), this.config.checkIntervalMs);
  }

  /**
   * Notify the watchdog that we moved to an image item (no video to monitor).
   * Resets stall counters, monitors only for hung items.
   */
  watchImage(itemDurationMs: number): void {
    this.stop();

    this.videoEl = null;
    this.itemDurationMs = itemDurationMs;
    this.itemStartedAt = Date.now();
    this.stallCount = 0;
    this.escalationLevel = 0;

    this.intervalId = setInterval(() => this.tickImage(), this.config.checkIntervalMs);
  }

  /** Stop monitoring. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.videoEl = null;
  }

  /** Reset escalation (e.g., after successful item transition). */
  reset(): void {
    this.stallCount = 0;
    this.escalationLevel = 0;
    this.lastCurrentTime = -1;
    this.itemStartedAt = Date.now();
  }

  // ── Private ────────────────────────────────────────────────

  private tick(): void {
    const video = this.videoEl;
    if (!video) return;

    // Check for hung item (way past expected duration)
    if (this.isHung()) {
      this.callbacks.onSkip();
      this.reset();
      return;
    }

    const currentTime = video.currentTime;

    // Video is advancing normally
    if (currentTime !== this.lastCurrentTime && currentTime > 0) {
      this.lastCurrentTime = currentTime;
      this.stallCount = 0;
      this.escalationLevel = 0;
      return;
    }

    // Video appears stalled
    this.stallCount++;

    if (this.stallCount < this.config.stallThreshold) return;

    // Escalate
    switch (this.escalationLevel) {
      case 0:
        // Level 1: force play
        void video.play().catch(() => { /* ignore */ });
        this.escalationLevel = 1;
        this.stallCount = 0;
        break;

      case 1:
        // Level 2: skip to next item
        this.callbacks.onSkip();
        this.escalationLevel = 2;
        this.stallCount = 0;
        break;

      default:
        // Level 3: full page reload
        this.callbacks.onReload();
        break;
    }
  }

  private tickImage(): void {
    if (this.isHung()) {
      this.callbacks.onSkip();
      this.reset();
    }
  }

  private isHung(): boolean {
    const elapsed = Date.now() - this.itemStartedAt;
    const maxMs = Math.min(
      this.itemDurationMs * this.config.maxDurationMultiplier,
      this.config.absoluteMaxMs,
    );
    return elapsed > maxMs;
  }
}
