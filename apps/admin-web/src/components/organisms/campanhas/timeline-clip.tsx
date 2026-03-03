import * as React from 'react';
import Image from 'next/image';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DragDropVerticalIcon,
  ImageIcon,
  PlayIcon,
  EyeIcon,
  RefreshIcon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  UploadDialog,
  type SelectedMedia,
} from '@/components/organisms/midias/upload-dialog';

import type { CampaignTimelineItem } from './timeline-types';
import { useTimelineResize, type ResizeEdge } from './hooks/use-timeline-resize';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TimelineClipProps = {
  item: CampaignTimelineItem;
  pixelsPerSecond: number;
  minDuration: number;
  snapSeconds: number;
  onPreviewDuration: (id: string, duration: number) => void;
  onCommitDuration: (id: string, duration: number) => void;
  onRemove: (id: string) => void;
  onReplace: (id: string, media: SelectedMedia) => void;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatSeconds(seconds: number) {
  if (seconds >= 60) {
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return `${min}m ${sec}s`;
  }
  return `${seconds.toFixed(1)}s`;
}

/* ------------------------------------------------------------------ */
/*  ResizeHandle – subcomponent for each edge                          */
/* ------------------------------------------------------------------ */

type ResizeHandleProps = {
  edge: ResizeEdge;
  isActive: boolean;
  isResizing: boolean;
  onPointerDown: (edge: ResizeEdge, e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => void;
};

function ResizeHandle({
  edge,
  isActive,
  isResizing,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onLostPointerCapture,
}: ResizeHandleProps) {
  return (
    <div
      className={cn(
        'absolute inset-y-0 z-20 flex w-3 cursor-ew-resize items-center justify-center select-none touch-none',
        edge === 'left' ? 'left-0' : 'right-0',
      )}
      onPointerDown={(e) => onPointerDown(edge, e)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onLostPointerCapture={onLostPointerCapture}
      role="separator"
      aria-orientation="vertical"
      aria-label={edge === 'left' ? 'Ajustar início' : 'Ajustar fim'}
    >
      <div
        className={cn(
          'h-5 w-1 rounded-full transition-colors duration-150',
          isActive
            ? 'bg-zinc-100'
            : 'bg-zinc-100/50 opacity-0 group-hover:opacity-100',
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TimelineClip                                                       */
/* ------------------------------------------------------------------ */

export function TimelineClip({
  item,
  pixelsPerSecond,
  minDuration,
  snapSeconds,
  onPreviewDuration,
  onCommitDuration,
  onRemove,
  onReplace,
}: TimelineClipProps) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const [mediaRatio, setMediaRatio] = React.useState<number | null>(null);

  const maxAllowedDuration = item.type === 'video'
    ? Math.max(minDuration, item.maxDuration ?? item.duration)
    : undefined;

  React.useEffect(() => {
    if (previewOpen) {
      setMediaRatio(null);
    }
  }, [previewOpen, item.id]);

  /* ---- Sortable (drag-to-reorder) ---- */
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  /* ---- Resize ---- */
  const resize = useTimelineResize({
    duration: item.duration,
    minDuration,
    maxDuration: maxAllowedDuration,
    pixelsPerSecond,
    snapSeconds,
    onPreview: (next) => onPreviewDuration(item.id, next),
    onCommit: (next) => onCommitDuration(item.id, next),
  });

  const clipWidth = Math.max(resize.displayDuration * pixelsPerSecond, 140);

  const style: React.CSSProperties = {
    width: clipWidth,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  /* ---- Keyboard resize (Shift + Arrow) ---- */
  const handleKeyboardResize = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!event.shiftKey) return;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const candidate = Number((item.duration + direction * snapSeconds).toFixed(1));
    const boundedByMin = Math.max(minDuration, candidate);
    const next = maxAllowedDuration !== undefined
      ? Math.min(boundedByMin, maxAllowedDuration)
      : boundedByMin;

    onPreviewDuration(item.id, next);
    onCommitDuration(item.id, next);
  };

  /* ---- Shared handle props ---- */
  const handleProps = {
    isResizing: resize.isResizing,
    onPointerDown: resize.onHandlePointerDown,
    onPointerMove: resize.onHandlePointerMove,
    onPointerUp: resize.onHandlePointerUp,
    onLostPointerCapture: resize.onHandleLostCapture,
  };

  const previewDialogSizeClass =
    mediaRatio !== null && mediaRatio < 0.9
      ? 'sm:max-w-2xl'
      : mediaRatio !== null && mediaRatio > 1.6
        ? 'sm:max-w-5xl'
        : 'sm:max-w-4xl';

  const previewViewportHeightClass =
    mediaRatio !== null && mediaRatio > 1.6 ? 'h-[52vh]' : 'h-[68vh]';

  return (
    <div
      ref={setNodeRef}
      style={style}
      tabIndex={0}
      onKeyDown={handleKeyboardResize}
      aria-label={`Clip ${item.name}. Duração ${formatSeconds(resize.displayDuration)}. Shift + setas para ajustar.`}
      className={cn(
        'group relative h-16 shrink-0 overflow-visible rounded-xl outline-none transition-all',
        'focus-visible:ring-2 focus-visible:ring-primary/60',
        isDragging && 'z-40 scale-[1.02] cursor-grabbing opacity-90 ring-2 ring-primary/50',
        resize.isResizing && 'z-30 ring-2 ring-primary',
      )}
      title={`Duração: ${formatSeconds(resize.displayDuration)}`}
    >
      {/* ---- Content ---- */}
      <div 
        className="flex h-full w-full items-center overflow-hidden rounded-xl bg-zinc-950 text-zinc-50 group-hover/handle:cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {/* Thumbnail (Left) */}
        <div className="relative h-full w-16 shrink-0 border-r border-zinc-800 bg-zinc-900 pointer-events-none">
          {item.type === 'image' && item.url ? (
            <Image
              src={item.url}
              alt={item.name}
              fill
              unoptimized
              sizes="64px"
              className="object-cover"
            />
          ) : item.type === 'video' && item.url ? (
            <video
              src={item.url}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <HugeiconsIcon icon={item.type === 'video' ? PlayIcon : ImageIcon} size={16} className="text-zinc-500" />
            </div>
          )}
        </div>

        {/* Flexible space for track content/color if needed */}
        <div className="flex-1 overflow-hidden px-3">
          <p className="truncate text-[11px] font-medium text-zinc-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {item.name}
          </p>
        </div>

        {/* Controls (Right) */}
        <div className="absolute right-0 top-0 bottom-0 flex shrink-0 items-center justify-end gap-1.5 rounded-r-xl bg-gradient-to-l from-zinc-950 via-zinc-950/90 to-transparent py-1 pl-8 pr-2">
          <input
            type="number"
            min={minDuration}
            max={maxAllowedDuration}
            step={snapSeconds}
            className="w-10 rounded-md bg-zinc-800 px-1 py-0.5 text-center text-[10px] font-medium text-zinc-200 border border-zinc-700/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={resize.displayDuration}
            onClick={(e) => {
              // Previne drag quando clica no input
              e.stopPropagation();
            }}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (Number.isNaN(raw)) return;
              const boundedByMin = Math.max(minDuration, raw);
              const val = maxAllowedDuration !== undefined
                ? Math.min(boundedByMin, maxAllowedDuration)
                : boundedByMin;
              // Atualiza visualmente na hora
              onPreviewDuration(item.id, val);
            }}
            onBlur={(e) => {
              let val = Number(e.target.value);
              if (isNaN(val) || val < minDuration) val = minDuration;
              if (maxAllowedDuration !== undefined) {
                val = Math.min(val, maxAllowedDuration);
              }
              onCommitDuration(item.id, val);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
              // Não propaga para não conflitar com atalhos de resize via seta (se focado no input, seta arrasta cursor)
              e.stopPropagation();
            }}
            title="Duração em segundos"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-zinc-400 transition-colors hover:bg-zinc-700/30 hover:text-zinc-100 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
            aria-label="Visualizar criativo"
          >
            <HugeiconsIcon icon={EyeIcon} size={14} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-zinc-400 transition-colors hover:bg-red-500/20 hover:text-red-400 z-10"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            aria-label="Remover clip"
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
          </Button>
        </div>
      </div>

      {/* ---- Resize handles ---- */}
      <ResizeHandle edge="left" isActive={resize.activeEdge === 'left'} {...handleProps} />
      <ResizeHandle edge="right" isActive={resize.activeEdge === 'right'} {...handleProps} />

      {/* ---- Duration tooltip (visible during resize) ---- */}
      {resize.isResizing && (
        <div className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-medium text-zinc-100 border border-zinc-800">
          {resize.activeEdge === 'left' ? 'Início' : 'Fim'} · {resize.displayDuration.toFixed(1)}s
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className={cn('w-[calc(100vw-2rem)]', previewDialogSizeClass)}>
          <DialogHeader>
            <DialogTitle>Visualizar criativo</DialogTitle>
            <DialogDescription>
              Confira o arquivo atual e escolha uma ação.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <div className={cn('relative overflow-hidden rounded-xl border bg-muted/20', previewViewportHeightClass)}>
              {item.type === 'video' && item.url ? (
                <video
                  src={item.url}
                  controls
                  playsInline
                  onLoadedMetadata={(event) => {
                    const { videoWidth, videoHeight } = event.currentTarget;
                    if (videoWidth > 0 && videoHeight > 0) {
                      setMediaRatio(videoWidth / videoHeight);
                    }
                  }}
                  className="h-full w-full object-cover"
                />
              ) : item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.name}
                  onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (naturalWidth > 0 && naturalHeight > 0) {
                      setMediaRatio(naturalWidth / naturalHeight);
                    }
                  }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <HugeiconsIcon icon={item.type === 'video' ? PlayIcon : ImageIcon} size={26} className="text-zinc-500" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2"
                onClick={() => setReplaceOpen(true)}
              >
                <HugeiconsIcon icon={RefreshIcon} size={16} />
                Substituir
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="justify-start gap-2"
                onClick={() => {
                  onRemove(item.id);
                  setPreviewOpen(false);
                }}
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UploadDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        onSelect={(mediaList) => {
          const media = mediaList[0];
          if (!media) return;
          onReplace(item.id, media);
          setReplaceOpen(false);
          setPreviewOpen(false);
        }}
        multiple={false}
        selectedIds={item.mediaId ? [item.mediaId] : []}
      />
    </div>
  );
}
