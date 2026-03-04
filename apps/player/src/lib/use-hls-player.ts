'use client';

import { useCallback, useEffect, useRef } from 'react';
import Hls, { type HlsConfig } from 'hls.js';

// ────────────────────────────────────────────────────────────
// HLS.js configuration optimised for digital-signage players
// running on low-power devices (smart TVs, sticks, mini-PCs).
// ────────────────────────────────────────────────────────────
const HLS_CONFIG: Partial<HlsConfig> = {
  // Worker off-loads demuxing from main thread → smoother UI
  enableWorker: true,

  // We are VOD / looped-VOD; low-latency mode adds overhead
  lowLatencyMode: false,

  // ── Buffer tuning ──────────────────────────────────────────
  // Keep up to 30 s ahead; never exceed 120 s
  maxBufferLength: 30,
  maxMaxBufferLength: 120,
  // Retain 90 s of back-buffer so seeks after stall are instant
  backBufferLength: 90,

  // ── Manifest / level / fragment loading ────────────────────
  manifestLoadingTimeOut: 10_000,
  manifestLoadingMaxRetry: 4,
  manifestLoadingRetryDelay: 1_000,

  levelLoadingTimeOut: 10_000,
  levelLoadingMaxRetry: 4,
  levelLoadingRetryDelay: 1_000,

  fragLoadingTimeOut: 20_000,
  fragLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 1_000,
  fragLoadingMaxRetryTimeout: 10_000,

  // ── ABR (Adaptive Bitrate) ─────────────────────────────────
  // Conservative: prefer uninterrupted playback over max quality
  abrEwmaDefaultEstimate: 1_000_000,  // 1 Mbps initial guess
  abrBandWidthFactor: 0.8,            // headroom down (80 %)
  abrBandWidthUpFactor: 0.7,          // conservative up-switch
};

export type UseHlsPlayerOptions = {
  /** Source URL — can be a plain mp4 OR an HLS m3u8 */
  src: string;
  /** Fires once actual playback starts */
  onPlay?: () => void;
  /** Fires periodically with current time */
  onTimeUpdate?: () => void;
  /** Fires when the media ended naturally */
  onEnded?: () => void;
  /** Fires on fatal / unrecoverable error */
  onError?: () => void;
  /** Optional initial seek position in seconds */
  startAt?: number | null;
};

/**
 * Hook that manages HLS.js lifecycle for a single <video> element.
 *
 * - If the browser supports HLS natively (Safari / iOS), it falls
 *   back to the native player (zero JS overhead).
 * - Otherwise, HLS.js handles adaptive streaming, buffering and
 *   error-recovery automatically.
 * - For plain mp4 URLs it simply sets `video.src`.
 */
export function useHlsPlayer(options: UseHlsPlayerOptions) {
  const { src, onPlay, onTimeUpdate, onEnded, onError, startAt } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const startAtRef = useRef<number | null>(startAt ?? null);

  // Keep startAt in sync
  useEffect(() => {
    startAtRef.current = startAt ?? null;
  }, [startAt]);

  // ── Core: attach / detach HLS source ────────────────────────
  const attach = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Tear down previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = /\.m3u8($|\?)/.test(src);

    if (isHls && Hls.isSupported()) {
      const hls = new Hls(HLS_CONFIG);
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (startAtRef.current != null) {
          try { video.currentTime = startAtRef.current; } catch { /* ignore */ }
          startAtRef.current = null;
        }
        void video.play().catch(() => {
          // Autoplay blocked — will retry on user interaction / visibility
        });
      });

      // ── Error recovery ──────────────────────────────────────
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Try to recover network errors (stalls)
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            // Truly fatal → signal caller
            hls.destroy();
            hlsRef.current = null;
            onError?.();
            break;
        }
      });
    } else {
      // Native HLS (Safari) or plain mp4
      video.src = src;

      const onLoaded = () => {
        if (startAtRef.current != null) {
          try { video.currentTime = startAtRef.current; } catch { /* ignore */ }
          startAtRef.current = null;
        }
        void video.play().catch(() => { /* autoplay blocked */ });
      };

      video.addEventListener('loadedmetadata', onLoaded, { once: true });
    }
  }, [src, onError]);

  // Attach whenever src changes
  useEffect(() => {
    attach();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [attach]);

  // ── Re-attach event listeners without tearing down HLS ──────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => onPlay?.();
    const handleTimeUpdate = () => onTimeUpdate?.();
    const handleEnded = () => onEnded?.();
    const handleNativeError = () => onError?.();

    // Visibility-based recovery: resume if tab comes back
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && video.paused) {
        void video.play().catch(() => { /* ignore */ });
      }
    };

    // Stall recovery
    const handleWaiting = () => {
      if (video.paused) {
        void video.play().catch(() => { /* ignore */ });
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleNativeError);
    video.addEventListener('waiting', handleWaiting);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleNativeError);
      video.removeEventListener('waiting', handleWaiting);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [onPlay, onTimeUpdate, onEnded, onError]);

  return { videoRef };
}
