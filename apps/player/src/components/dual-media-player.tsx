'use client';

import * as React from 'react';
import Hls, { type HlsConfig } from 'hls.js';
import { BufferBar } from '@/components/buffer-bar';

// ── HLS config (shared with use-hls-player.ts) ─────────────────────
const HLS_CONFIG: Partial<HlsConfig> = {
  enableWorker: true,
  lowLatencyMode: false,
  maxBufferLength: 30,
  maxMaxBufferLength: 120,
  maxBufferSize: 60 * 1024 * 1024,
  maxBufferHole: 0.5,
  backBufferLength: 90,
  abrEwmaDefaultEstimate: 1_000_000,
  abrBandWidthFactor: 0.8,
  abrBandWidthUpFactor: 0.7,
  capLevelToPlayerSize: true,
  capLevelOnFPSDrop: true,
  fragLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: 10_000,
      maxLoadTimeMs: 120_000,
      timeoutRetry: { maxNumRetry: 4, retryDelayMs: 1_000, maxRetryDelayMs: 8_000 },
      errorRetry: { maxNumRetry: 6, retryDelayMs: 1_000, maxRetryDelayMs: 8_000, backoff: 'exponential' },
    },
  },
  manifestLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: 10_000,
      maxLoadTimeMs: 20_000,
      timeoutRetry: { maxNumRetry: 3, retryDelayMs: 1_000, maxRetryDelayMs: 8_000 },
      errorRetry: { maxNumRetry: 3, retryDelayMs: 1_000, maxRetryDelayMs: 8_000, backoff: 'exponential' },
    },
  },
};

// ── Types ────────────────────────────────────────────────────────────

export type PlaylistItem = {
  assetId: string;
  campaignId?: string;
  mediaType: 'IMAGE' | 'VIDEO';
  durationMs: number;
  url: string;
};

type SlotState = {
  item: PlaylistItem | null;
  loaded: boolean;
};

type DualMediaPlayerProps = {
  currentItem: PlaylistItem | null;
  nextItem: PlaylistItem | null;
  currentIndex: number;
  startAt?: number | null;
  onPlay: () => void;
  onTimeUpdate: () => void;
  onEnded: () => void;
  onError: () => void;
  /** Expose the active video element for BufferBar */
  videoElRef?: React.MutableRefObject<HTMLVideoElement | null>;
};

// ── Helpers ──────────────────────────────────────────────────────────

function isHlsUrl(url: string): boolean {
  return /\.m3u8($|\?)/.test(url);
}

function cleanupVideo(video: HTMLVideoElement, hls: Hls | null): void {
  if (hls) {
    hls.destroy();
  }
  video.pause();
  video.removeAttribute('src');
  video.load(); // resets MediaSource, releases memory
}

// ── Component ────────────────────────────────────────────────────────

/**
 * Dual-slot media player: eliminates black frames on item transitions.
 *
 * Two full-screen containers (slot A & B) always exist in the DOM.
 * The active slot is visible; the preload slot sits hidden behind it
 * with the next item pre-loaded.  On advance the slots swap instantly
 * — the preloaded content is already decoded and ready.
 */
export const DualMediaPlayer = React.memo(function DualMediaPlayer({
  currentItem,
  nextItem,
  currentIndex,
  startAt,
  onPlay,
  onTimeUpdate,
  onEnded,
  onError,
  videoElRef,
}: DualMediaPlayerProps) {
  // ── Refs ──────────────────────────────────────────────────
  const videoARef = React.useRef<HTMLVideoElement | null>(null);
  const videoBRef = React.useRef<HTMLVideoElement | null>(null);
  const hlsARef = React.useRef<Hls | null>(null);
  const hlsBRef = React.useRef<Hls | null>(null);

  // Track which slot is active and what each slot holds
  const [activeSlot, setActiveSlot] = React.useState<'A' | 'B'>('A');
  const slotAStateRef = React.useRef<SlotState>({ item: null, loaded: false });
  const slotBStateRef = React.useRef<SlotState>({ item: null, loaded: false });

  // Track the last index we rendered to detect transitions
  const prevIndexRef = React.useRef<number>(currentIndex);
  const startAtRef = React.useRef<number | null>(startAt ?? null);
  const recoverAttemptRef = React.useRef(0);

  React.useEffect(() => {
    startAtRef.current = startAt ?? null;
  }, [startAt]);

  // ── Get refs for active / preload slots ───────────────────
  const getSlotRefs = React.useCallback(
    (slot: 'A' | 'B') => ({
      videoRef: slot === 'A' ? videoARef : videoBRef,
      hlsRef: slot === 'A' ? hlsARef : hlsBRef,
      stateRef: slot === 'A' ? slotAStateRef : slotBStateRef,
    }),
    [],
  );

  const activeRefs = React.useMemo(
    () => getSlotRefs(activeSlot),
    [activeSlot, getSlotRefs],
  );

  const preloadSlot = activeSlot === 'A' ? 'B' : 'A';
  const preloadRefs = React.useMemo(
    () => getSlotRefs(preloadSlot),
    [preloadSlot, getSlotRefs],
  );

  // ── Sync external video ref ───────────────────────────────
  React.useEffect(() => {
    if (videoElRef) {
      videoElRef.current = activeRefs.videoRef.current;
    }
  }, [activeSlot, videoElRef, activeRefs]);

  // ── Load a video item into a specific slot ─────────────────
  const loadVideoIntoSlot = React.useCallback(
    (
      slot: 'A' | 'B',
      item: PlaylistItem,
      seekTo?: number | null,
      autoplay = true,
    ) => {
      const { videoRef, hlsRef, stateRef } = getSlotRefs(slot);
      const video = videoRef.current;
      if (!video) return;

      // Cleanup previous
      cleanupVideo(video, hlsRef.current);
      hlsRef.current = null;
      stateRef.current = { item, loaded: false };

      const src = item.url;

      if (item.mediaType === 'VIDEO' && isHlsUrl(src) && Hls.isSupported()) {
        const hls = new Hls(HLS_CONFIG);
        hlsRef.current = hls;

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          stateRef.current.loaded = true;
          if (seekTo != null) {
            try { video.currentTime = seekTo; } catch { /* ignore */ }
          }
          if (autoplay) {
            void video.play().catch(() => { /* autoplay blocked */ });
          }
        });

        // Escalated error recovery
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          const attempt = recoverAttemptRef.current;
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (attempt === 0) hls.recoverMediaError();
              else if (attempt === 1) { hls.swapAudioCodec(); hls.recoverMediaError(); }
              else { hls.detachMedia(); hls.attachMedia(video); hls.loadSource(src); }
              recoverAttemptRef.current = attempt + 1;
              break;
            default:
              hls.destroy();
              hlsRef.current = null;
              onError();
              break;
          }
        });

        hls.on(Hls.Events.FRAG_LOADED, () => { recoverAttemptRef.current = 0; });
      } else if (item.mediaType === 'VIDEO') {
        // Native HLS (Safari) or mp4
        video.src = src;
        const onLoaded = () => {
          stateRef.current.loaded = true;
          if (seekTo != null) {
            try { video.currentTime = seekTo; } catch { /* ignore */ }
          }
          if (autoplay) {
            void video.play().catch(() => { /* autoplay blocked */ });
          }
        };
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
      }
    },
    [getSlotRefs, onError],
  );

  // ── Load current item into active slot (initial + direct changes) ──
  React.useEffect(() => {
    if (!currentItem) return;

    const { stateRef } = activeRefs;

    // Already showing this item? Skip.
    if (stateRef.current.item?.assetId === currentItem.assetId) return;

    if (currentItem.mediaType === 'VIDEO') {
      loadVideoIntoSlot(activeSlot, currentItem, startAtRef.current, true);
      startAtRef.current = null;
    } else {
      // Image: just update state, rendering handled by JSX
      stateRef.current = { item: currentItem, loaded: true };
    }
  }, [currentItem, activeSlot, activeRefs, loadVideoIntoSlot]);

  // ── Preload next item into preload slot ────────────────────
  React.useEffect(() => {
    if (!nextItem) return;

    const { stateRef } = preloadRefs;

    // Already preloaded? Skip.
    if (stateRef.current.item?.assetId === nextItem.assetId) return;

    if (nextItem.mediaType === 'VIDEO') {
      // Preload but don't autoplay
      loadVideoIntoSlot(preloadSlot, nextItem, null, false);
    } else {
      // Image preload: the <img> in the hidden slot will load naturally
      stateRef.current = { item: nextItem, loaded: true };
    }
  }, [nextItem, preloadSlot, preloadRefs, loadVideoIntoSlot]);

  // ── Detect index changes → swap slots ─────────────────────
  React.useEffect(() => {
    if (prevIndexRef.current === currentIndex) return;
    prevIndexRef.current = currentIndex;

    // The preload slot should have the new current item already loaded.
    // If it does, just swap active/preload. Otherwise load fresh.
    const preloadState = preloadRefs.stateRef.current;

    if (
      preloadState.item?.assetId === currentItem?.assetId &&
      preloadState.loaded
    ) {
      // Instant swap — zero black frame!
      setActiveSlot(preloadSlot);

      // Start playback on the now-active preloaded video
      if (currentItem?.mediaType === 'VIDEO') {
        const video = preloadRefs.videoRef.current;
        if (video) {
          void video.play().catch(() => { /* autoplay blocked */ });
        }
      }
    } else if (currentItem) {
      // Preload missed — load directly into current active slot
      if (currentItem.mediaType === 'VIDEO') {
        loadVideoIntoSlot(activeSlot, currentItem, startAtRef.current, true);
        startAtRef.current = null;
      }
    }
  }, [
    currentIndex,
    currentItem,
    activeSlot,
    preloadSlot,
    preloadRefs,
    loadVideoIntoSlot,
  ]);

  // ── Video event listeners on active slot ───────────────────
  React.useEffect(() => {
    const video = activeRefs.videoRef.current;
    if (!video || currentItem?.mediaType !== 'VIDEO') return;

    const handlePlay = () => onPlay();
    const handleTimeUpdate = () => onTimeUpdate();
    const handleEnded = () => onEnded();
    const handleError = () => onError();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && video.paused) {
        void video.play().catch(() => { /* ignore */ });
      }
    };
    const handleWaiting = () => {
      if (video.paused) void video.play().catch(() => { /* ignore */ });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('waiting', handleWaiting);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('waiting', handleWaiting);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeSlot, activeRefs, currentItem?.mediaType, onPlay, onTimeUpdate, onEnded, onError]);

  // ── Cleanup on unmount ─────────────────────────────────────
  React.useEffect(() => {
    return () => {
      if (videoARef.current) cleanupVideo(videoARef.current, hlsARef.current);
      if (videoBRef.current) cleanupVideo(videoBRef.current, hlsBRef.current);
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────
  if (!currentItem) return null;

  const renderSlot = (
    slot: 'A' | 'B',
    item: PlaylistItem | null,
    isActive: boolean,
  ) => {
    const videoRef = slot === 'A' ? videoARef : videoBRef;

    return (
      <div
        key={slot}
        className="absolute inset-0"
        style={{
          zIndex: isActive ? 2 : 1,
          opacity: isActive ? 1 : 0,
          pointerEvents: isActive ? 'auto' : 'none',
        }}
      >
        {item?.mediaType === 'IMAGE' ? (
          <img
            src={item.url}
            alt="Mídia da campanha"
            className="h-screen w-screen object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            className="h-screen w-screen object-contain"
            autoPlay={isActive}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            loop={false}
          />
        )}
      </div>
    );
  };

  return (
    <>
      {renderSlot('A', activeSlot === 'A' ? currentItem : nextItem, activeSlot === 'A')}
      {renderSlot('B', activeSlot === 'B' ? currentItem : nextItem, activeSlot === 'B')}

      {/* Buffer bar on the active video */}
      {currentItem.mediaType === 'VIDEO' && (
        <BufferBar videoRef={activeRefs.videoRef as React.RefObject<HTMLVideoElement>} />
      )}
    </>
  );
});
