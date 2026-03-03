import * as React from 'react';

export type ResizeEdge = 'left' | 'right';

type UseTimelineResizeParams = {
  duration: number;
  minDuration?: number;
  maxDuration?: number;
  pixelsPerSecond: number;
  snapSeconds?: number;
  onPreview: (duration: number) => void;
  onCommit: (duration: number) => void;
};

function roundToStep(value: number, step: number) {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max?: number) {
  if (max === undefined) return Math.max(min, value);
  return Math.min(Math.max(value, min), max);
}

/**
 * Resize hook using Pointer Capture API.
 *
 * Pointer capture binds all subsequent pointer events (move/up/cancel)
 * directly to the handle element that initiated the resize, avoiding
 * conflicts with dnd-kit sensors and eliminating stale-closure issues.
 */
export function useTimelineResize({
  duration,
  minDuration = 3,
  maxDuration,
  pixelsPerSecond,
  snapSeconds = 0.5,
  onPreview,
  onCommit,
}: UseTimelineResizeParams) {
  const [isResizing, setIsResizing] = React.useState(false);
  const [activeEdge, setActiveEdge] = React.useState<ResizeEdge | null>(null);
  const [displayDuration, setDisplayDuration] = React.useState(duration);

  /* ---- mutable ref (always current, no stale closures) ---- */
  const ref = React.useRef({
    active: false,
    startX: 0,
    startDuration: duration,
    currentDuration: duration,
    edge: null as ResizeEdge | null,
  });

  /* Sync external duration when idle */
  React.useEffect(() => {
    if (!ref.current.active) {
      setDisplayDuration(duration);
      ref.current.currentDuration = duration;
    }
  }, [duration]);

  const calcDuration = React.useCallback(
    (deltaX: number, edge: ResizeEdge) => {
      const sign = edge === 'right' ? 1 : -1;
      const raw = ref.current.startDuration + (deltaX / pixelsPerSecond) * sign;
      return clamp(roundToStep(raw, snapSeconds), minDuration, maxDuration);
    },
    [maxDuration, minDuration, pixelsPerSecond, snapSeconds],
  );

  /* ---- Pointer-capture event handlers (attach to handle elements) ---- */

  const onHandlePointerDown = React.useCallback(
    (edge: ResizeEdge, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      // Capture pointer → all move/up go to this element
      event.currentTarget.setPointerCapture(event.pointerId);

      ref.current = {
        active: true,
        startX: event.clientX,
        startDuration: duration,
        currentDuration: duration,
        edge,
      };

      setActiveEdge(edge);
      setIsResizing(true);
    },
    [duration],
  );

  const onHandlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const r = ref.current;
      if (!r.active || !r.edge) return;

      const deltaX = event.clientX - r.startX;
      const next = calcDuration(deltaX, r.edge);

      r.currentDuration = next;
      setDisplayDuration(next);
      onPreview(next);
    },
    [calcDuration, onPreview],
  );

  const finishResize = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
      const r = ref.current;
      if (!r.active) return;

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* pointer may already be released */
      }

      if (commit) {
        onCommit(r.currentDuration);
      }

      r.active = false;
      r.edge = null;
      setIsResizing(false);
      setActiveEdge(null);
    },
    [onCommit],
  );

  const onHandlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => finishResize(event, true),
    [finishResize],
  );

  const onHandleLostCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => finishResize(event, true),
    [finishResize],
  );

  return {
    activeEdge,
    displayDuration,
    isResizing,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
    onHandleLostCapture,
  };
}
