'use client';

import * as React from 'react';
import { useHlsPlayer } from '@/lib/use-hls-player';

type VideoPlayerProps = {
  src: string;
  assetId: string;
  index: number;
  startAt?: number | null;
  onPlay: () => void;
  onTimeUpdate: () => void;
  onEnded: () => void;
  onError: () => void;
  /** Expose the internal video ref so sibling components (e.g. BufferBar) can read it */
  videoElRef?: React.RefObject<HTMLVideoElement | null>;
};

/**
 * Memoised video player component.
 *
 * Wraps hls.js adaptive-streaming logic and isolates the <video>
 * element so parent re-renders (playlist index, heartbeat state)
 * do NOT cause the video to re-mount / flash.
 */
export const VideoPlayer = React.memo(function VideoPlayer({
  src,
  assetId,
  index,
  startAt,
  onPlay,
  onTimeUpdate,
  onEnded,
  onError,
  videoElRef,
}: VideoPlayerProps) {
  const { videoRef } = useHlsPlayer({
    src,
    startAt,
    onPlay,
    onTimeUpdate,
    onEnded,
    onError,
  });

  // Sync external ref with internal ref
  React.useEffect(() => {
    if (videoElRef && 'current' in videoElRef) {
      (videoElRef as React.MutableRefObject<HTMLVideoElement | null>).current = videoRef.current;
    }
  });

  return (
    <video
      ref={videoRef}
      key={`${assetId}-${index}`}
      className="h-screen w-screen object-contain"
      autoPlay
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback"
      loop={false}
    />
  );
});
