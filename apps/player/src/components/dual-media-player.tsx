'use client';
/* eslint-disable @next/next/no-img-element */

import * as React from 'react';
import Hls, { type HlsConfig } from 'hls.js';

import { BufferBar } from '@/components/buffer-bar';

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

export type PlaylistItem = {
  assetId: string;
  playbackKey: string;
  campaignId?: string;
  mediaType: 'IMAGE' | 'VIDEO';
  durationMs: number;
  url: string;
};

type SlotState = {
  item: PlaylistItem | null;
  loaded: boolean;
  metadataReady: boolean;
  readyForPlayback: boolean;
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
  onNextReadyChange?: (payload: { assetId: string | null; playbackKey: string | null; ready: boolean }) => void;
  videoElRef?: React.MutableRefObject<HTMLVideoElement | null>;
};

function isHlsUrl(url: string): boolean {
  return /\.m3u8($|\?)/.test(url);
}

function cleanupVideo(video: HTMLVideoElement, hls: Hls | null): void {
  if (hls) {
    hls.destroy();
  }
  video.pause();
  video.removeAttribute('src');
  video.load();
}

export const DualMediaPlayer = React.memo(function DualMediaPlayer({
  currentItem,
  nextItem,
  currentIndex,
  startAt,
  onPlay,
  onTimeUpdate,
  onEnded,
  onError,
  onNextReadyChange,
  videoElRef,
}: DualMediaPlayerProps) {
  const videoARef = React.useRef<HTMLVideoElement | null>(null);
  const videoBRef = React.useRef<HTMLVideoElement | null>(null);
  const hlsARef = React.useRef<Hls | null>(null);
  const hlsBRef = React.useRef<Hls | null>(null);
  const cleanupARef = React.useRef<(() => void) | null>(null);
  const cleanupBRef = React.useRef<(() => void) | null>(null);

  const [activeSlot, setActiveSlot] = React.useState<'A' | 'B'>('A');
  const slotAStateRef = React.useRef<SlotState>({ item: null, loaded: false, metadataReady: false, readyForPlayback: false });
  const slotBStateRef = React.useRef<SlotState>({ item: null, loaded: false, metadataReady: false, readyForPlayback: false });
  const prevIndexRef = React.useRef<number>(currentIndex);
  const startAtRef = React.useRef<number | null>(startAt ?? null);
  const recoverAttemptRef = React.useRef(0);

  React.useEffect(() => {
    startAtRef.current = startAt ?? null;
  }, [startAt]);

  const getSlotRefs = React.useCallback(
    (slot: 'A' | 'B') => ({
      videoRef: slot === 'A' ? videoARef : videoBRef,
      hlsRef: slot === 'A' ? hlsARef : hlsBRef,
      cleanupRef: slot === 'A' ? cleanupARef : cleanupBRef,
      stateRef: slot === 'A' ? slotAStateRef : slotBStateRef,
    }),
    [],
  );

  const activeRefs = React.useMemo(() => getSlotRefs(activeSlot), [activeSlot, getSlotRefs]);
  const preloadSlot = activeSlot === 'A' ? 'B' : 'A';
  const preloadRefs = React.useMemo(() => getSlotRefs(preloadSlot), [preloadSlot, getSlotRefs]);

  const notifyReady = React.useCallback((item: PlaylistItem | null, ready: boolean) => {
    onNextReadyChange?.({
      assetId: item?.assetId ?? null,
      playbackKey: item?.playbackKey ?? null,
      ready,
    });
  }, [onNextReadyChange]);

  const updateWarmState = React.useCallback((slot: 'A' | 'B', item: PlaylistItem | null, ready: boolean) => {
    if (slot === preloadSlot) {
      notifyReady(item, ready);
    }
  }, [notifyReady, preloadSlot]);

  React.useEffect(() => {
    if (videoElRef) {
      videoElRef.current = activeRefs.videoRef.current;
    }
  }, [activeRefs, videoElRef]);

  const attachWarmupListeners = React.useCallback((params: {
    slot: 'A' | 'B';
    video: HTMLVideoElement;
    item: PlaylistItem;
    seekTo?: number | null;
    autoplay: boolean;
  }) => {
    const { slot, video, item, seekTo, autoplay } = params;
    const { stateRef, cleanupRef } = getSlotRefs(slot);

    cleanupRef.current?.();

    const maybeMarkReady = () => {
      if (stateRef.current.item?.playbackKey !== item.playbackKey) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      stateRef.current.loaded = true;
      stateRef.current.readyForPlayback = true;
      updateWarmState(slot, item, true);

      if (autoplay) {
        void video.play().catch(() => { /* autoplay blocked */ });
      }
    };

    const handleLoadedMetadata = () => {
      if (stateRef.current.item?.playbackKey !== item.playbackKey) return;
      stateRef.current.metadataReady = true;
      if (seekTo != null) {
        try { video.currentTime = seekTo; } catch { /* ignore */ }
      }
      maybeMarkReady();
    };

    const handleLoadedData = () => {
      maybeMarkReady();
    };

    const handleCanPlay = () => {
      maybeMarkReady();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);

    cleanupRef.current = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      cleanupRef.current = null;
    };
  }, [getSlotRefs, updateWarmState]);

  const loadVideoIntoSlot = React.useCallback((slot: 'A' | 'B', item: PlaylistItem, seekTo?: number | null, autoplay = true) => {
    const { videoRef, hlsRef, stateRef, cleanupRef } = getSlotRefs(slot);
    const video = videoRef.current;
    if (!video) return;

    cleanupRef.current?.();
    cleanupVideo(video, hlsRef.current);
    hlsRef.current = null;
    stateRef.current = { item, loaded: false, metadataReady: false, readyForPlayback: false };
    updateWarmState(slot, item, false);

    attachWarmupListeners({ slot, video, item, seekTo, autoplay });

    if (item.mediaType === 'VIDEO' && isHlsUrl(item.url) && Hls.isSupported()) {
      const hls = new Hls(HLS_CONFIG);
      hlsRef.current = hls;
      hls.loadSource(item.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        const attempt = recoverAttemptRef.current;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            if (attempt === 0) hls.recoverMediaError();
            else if (attempt === 1) {
              hls.swapAudioCodec();
              hls.recoverMediaError();
            } else {
              hls.detachMedia();
              hls.attachMedia(video);
              hls.loadSource(item.url);
            }
            recoverAttemptRef.current = attempt + 1;
            break;
          default:
            hls.destroy();
            hlsRef.current = null;
            onError();
            break;
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        recoverAttemptRef.current = 0;
      });
      return;
    }

    video.src = item.url;
  }, [attachWarmupListeners, getSlotRefs, onError, updateWarmState]);

  React.useEffect(() => {
    if (!currentItem) return;

    const { stateRef } = getSlotRefs(activeSlot);
    if (stateRef.current.item?.playbackKey === currentItem.playbackKey) return;

    if (currentItem.mediaType === 'VIDEO') {
      loadVideoIntoSlot(activeSlot, currentItem, startAtRef.current, true);
      startAtRef.current = null;
    } else {
      stateRef.current = { item: currentItem, loaded: true, metadataReady: true, readyForPlayback: true };
    }
  }, [activeSlot, currentItem, getSlotRefs, loadVideoIntoSlot]);

  React.useEffect(() => {
    if (!nextItem) {
      notifyReady(null, false);
      return;
    }

    const { stateRef } = getSlotRefs(preloadSlot);
    if (stateRef.current.item?.playbackKey === nextItem.playbackKey) return;

    if (nextItem.mediaType === 'VIDEO') {
      loadVideoIntoSlot(preloadSlot, nextItem, null, false);
      return;
    }

    stateRef.current = { item: nextItem, loaded: false, metadataReady: false, readyForPlayback: false };
    notifyReady(nextItem, false);
  }, [getSlotRefs, loadVideoIntoSlot, nextItem, notifyReady, preloadSlot]);

  React.useEffect(() => {
    if (prevIndexRef.current === currentIndex) return;
    prevIndexRef.current = currentIndex;

    const preloadState = preloadRefs.stateRef.current;
    if (preloadState.item?.playbackKey === currentItem?.playbackKey && preloadState.readyForPlayback) {
      setActiveSlot(preloadSlot);
      if (currentItem?.mediaType === 'VIDEO') {
        const video = preloadRefs.videoRef.current;
        if (video) {
          void video.play().catch(() => { /* autoplay blocked */ });
        }
      }
      return;
    }

    if (currentItem?.mediaType === 'VIDEO') {
      loadVideoIntoSlot(activeSlot, currentItem, startAtRef.current, true);
      startAtRef.current = null;
    }
  }, [activeSlot, currentIndex, currentItem, loadVideoIntoSlot, preloadRefs, preloadSlot]);

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
      if (video.paused) {
        void video.play().catch(() => { /* ignore */ });
      }
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
  }, [activeRefs, currentItem?.mediaType, onEnded, onError, onPlay, onTimeUpdate]);

  const teardownAll = React.useCallback(() => {
    cleanupARef.current?.();
    cleanupBRef.current?.();
    if (videoARef.current) cleanupVideo(videoARef.current, hlsARef.current);
    if (videoBRef.current) cleanupVideo(videoBRef.current, hlsBRef.current);
  }, []);

  React.useEffect(() => {
    return teardownAll;
  }, [teardownAll]);

  if (!currentItem) return null;

  const renderSlot = (slot: 'A' | 'B', item: PlaylistItem | null, isActive: boolean) => {
    const videoRef = slot === 'A' ? videoARef : videoBRef;
    const stateRef = slot === 'A' ? slotAStateRef : slotBStateRef;

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
            onLoad={() => {
              stateRef.current = { item, loaded: true, metadataReady: true, readyForPlayback: true };
              updateWarmState(slot, item, true);
            }}
            onError={() => {
              updateWarmState(slot, item, false);
              if (isActive) {
                onError();
              }
            }}
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

      {currentItem.mediaType === 'VIDEO' && (
        <BufferBar videoRef={videoElRef as React.RefObject<HTMLVideoElement>} />
      )}
    </>
  );
});
