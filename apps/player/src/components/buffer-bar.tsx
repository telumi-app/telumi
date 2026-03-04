'use client';

import * as React from 'react';

type BufferBarProps = {
  /** Ref to the <video> element to read buffered ranges from */
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

/**
 * YouTube-style buffer progress bar.
 *
 * Renders a thin bottom overlay showing:
 * - Colored bar (played progress)
 * - Gray bar (buffered ahead)
 * - Transparent (not yet buffered)
 *
 * Works with both HLS (adaptive) and plain mp4 (progressive download).
 * The browser populates `video.buffered` in both cases.
 */
export const BufferBar = React.memo(function BufferBar({ videoRef }: BufferBarProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rafRef = React.useRef<number>(0);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const video = videoRef.current;
      if (!video || !video.duration || video.duration === Infinity) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const { width, height } = canvas;
      const duration = video.duration;
      const currentTime = video.currentTime;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Background track (very subtle)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, 0, width, height);

      // Draw buffered ranges (gray)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      const buffered = video.buffered;
      for (let i = 0; i < buffered.length; i++) {
        const start = (buffered.start(i) / duration) * width;
        const end = (buffered.end(i) / duration) * width;
        ctx.fillRect(start, 0, end - start, height);
      }

      // Draw played progress (accent color)
      const playedWidth = (currentTime / duration) * width;
      ctx.fillStyle = 'rgba(99, 102, 241, 0.9)'; // indigo-500
      ctx.fillRect(0, 0, playedWidth, height);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef]);

  // Resize canvas to match display size
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        canvas.width = Math.round(width * (window.devicePixelRatio || 1));
        canvas.height = Math.round(3 * (window.devicePixelRatio || 1));
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute bottom-0 left-0 z-20 h-[3px] w-full"
      aria-hidden="true"
    />
  );
});
