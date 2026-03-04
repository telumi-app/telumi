'use client';

import * as React from 'react';

type PlaybackOverlayProps = {
  currentIndex: number;
  totalItems: number;
  mediaType: 'IMAGE' | 'VIDEO';
};

/**
 * Lightweight HUD overlay showing current position in the playlist.
 * Memoised to avoid re-paints from parent state changes.
 */
export const PlaybackOverlay = React.memo(function PlaybackOverlay({
  currentIndex,
  totalItems,
  mediaType,
}: PlaybackOverlayProps) {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 rounded-md bg-black/55 px-3 py-2 text-xs text-white/80">
      {currentIndex + 1}/{totalItems} · {mediaType === 'VIDEO' ? 'vídeo' : 'imagem'}
    </div>
  );
});
