'use client';

import * as React from 'react';

type AssetPrefetchProps = {
  url: string;
  mediaType: 'IMAGE' | 'VIDEO';
};

/**
 * Invisible prefetch component for the next playlist item.
 * For images uses a hidden <img> with eager loading;
 * for videos uses a hidden <video> with preload="auto".
 *
 * Memoised so it only re-renders when the actual URL changes.
 */
export const AssetPrefetch = React.memo(function AssetPrefetch({
  url,
  mediaType,
}: AssetPrefetchProps) {
  if (mediaType === 'IMAGE') {
    return (
      <img
        src={url}
        alt="Pré-carregamento"
        className="hidden"
        loading="eager"
        decoding="async"
      />
    );
  }

  return (
    <video
      src={url}
      className="hidden"
      muted
      playsInline
      preload="auto"
    />
  );
});
