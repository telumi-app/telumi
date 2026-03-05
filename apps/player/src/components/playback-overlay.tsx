'use client';

import * as React from 'react';

type PlaybackOverlayProps = {
  currentIndex: number;
  totalItems: number;
  mediaType: 'IMAGE' | 'VIDEO';
  isOffline?: boolean;
};

/**
 * Lightweight HUD overlay showing current position in the playlist.
 * Memoised to avoid re-paints from parent state changes.
 */
export const PlaybackOverlay = React.memo(function PlaybackOverlay({
  currentIndex,
  totalItems,
  mediaType,
  isOffline,
}: PlaybackOverlayProps) {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2">
      {isOffline && (
        <span className="rounded-md bg-amber-600/80 px-2 py-1.5 text-xs font-medium text-white">
          OFFLINE
        </span>
      )}
      <span className="rounded-md bg-black/55 px-3 py-2 text-xs text-white/80">
        {currentIndex + 1}/{totalItems} · {mediaType === 'VIDEO' ? 'vídeo' : 'imagem'}
      </span>
    </div>
  );
});
