'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AddCircleIcon, Save, PlayIcon, ImageIcon } from '@hugeicons/core-free-icons';
import {
  DndContext,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  UploadDialog,
  type SelectedMedia,
} from '@/components/organisms/midias/upload-dialog';

import { TimelineClip } from './timeline-clip';
import { useTimelineReorder } from './hooks/use-timeline-reorder';
import type { CampaignTimelineItem } from './timeline-types';

export type { CampaignTimelineItem } from './timeline-types';

export const PIXELS_PER_SECOND = 20;
const MIN_DURATION_SECONDS = 3;
const SNAP_SECONDS = 0.5;

type CampaignTimelineProps = {
  items: CampaignTimelineItem[];
  onChange: (items: CampaignTimelineItem[]) => void;
  onSavePlaylist: (playlistName?: string) => void | Promise<void>;
  isSavingPlaylist?: boolean;
  helperMessage?: string;
};

function normalizeOrder(items: CampaignTimelineItem[]): CampaignTimelineItem[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

function cloneTimeline(items: CampaignTimelineItem[]): CampaignTimelineItem[] {
  return items.map((item) => ({ ...item }));
}

function isSameTimeline(a: CampaignTimelineItem[], b: CampaignTimelineItem[]): boolean {
  if (a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;

    if (
      left.id !== right.id ||
      left.mediaId !== right.mediaId ||
      left.name !== right.name ||
      left.type !== right.type ||
      left.duration !== right.duration ||
      left.maxDuration !== right.maxDuration ||
      left.order !== right.order ||
      left.url !== right.url
    ) {
      return false;
    }
  }

  return true;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  );
}

function formatTimelineTimecode(secondsTotal: number): string {
  const totalCentiseconds = Math.max(0, Math.round(secondsTotal * 100));
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(centiseconds)}`;
}

function makeItem(media: SelectedMedia, order: number): CampaignTimelineItem {
  const baseDuration = Math.max(MIN_DURATION_SECONDS, (media.durationMs ?? 15000) / 1000);
  const isVideo = media.mediaType === 'VIDEO';

  return {
    id: `${media.id}-${Math.random().toString(36).slice(2, 9)}`,
    mediaId: media.id,
    name: media.name,
    type: isVideo ? 'video' : 'image',
    duration: baseDuration,
    maxDuration: isVideo ? baseDuration : undefined,
    order,
    url: media.url,
  };
}

export function CampaignTimeline({
  items,
  onChange,
  onSavePlaylist,
  isSavingPlaylist = false,
  helperMessage,
}: CampaignTimelineProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saveModalOpen, setSaveModalOpen] = React.useState(false);
  const [draftPlaylistName, setDraftPlaylistName] = React.useState('');
  const [previewDurations, setPreviewDurations] = React.useState<Record<string, number>>({});

  const undoStackRef = React.useRef<CampaignTimelineItem[][]>([]);
  const redoStackRef = React.useRef<CampaignTimelineItem[][]>([]);
  const isInternalTimelineChangeRef = React.useRef(false);
  const previousOrderedItemsRef = React.useRef<CampaignTimelineItem[]>(cloneTimeline(items));

  const orderedItems = React.useMemo(
    () => [...items].sort((a, b) => a.order - b.order),
    [items],
  );

  const effectiveItems = React.useMemo(
    () => orderedItems.map((item) => ({
      ...item,
      duration: previewDurations[item.id] ?? item.duration,
    })),
    [orderedItems, previewDurations],
  );

  const totalDurationSeconds = React.useMemo(
    () => effectiveItems.reduce((sum, item) => sum + item.duration, 0),
    [effectiveItems],
  );

  const selectedIds = React.useMemo(
    () => [...new Set(orderedItems.map((item) => item.mediaId))],
    [orderedItems],
  );

  React.useEffect(() => {
    if (isInternalTimelineChangeRef.current) {
      isInternalTimelineChangeRef.current = false;
      previousOrderedItemsRef.current = cloneTimeline(orderedItems);
      return;
    }

    if (!isSameTimeline(previousOrderedItemsRef.current, orderedItems)) {
      undoStackRef.current = [];
      redoStackRef.current = [];
      setPreviewDurations({});
      previousOrderedItemsRef.current = cloneTimeline(orderedItems);
    }
  }, [orderedItems]);

  const commitTimeline = React.useCallback(
    (nextItems: CampaignTimelineItem[]) => {
      const normalized = normalizeOrder(nextItems);
      if (isSameTimeline(orderedItems, normalized)) return;

      undoStackRef.current.push(cloneTimeline(orderedItems));
      if (undoStackRef.current.length > 100) {
        undoStackRef.current.shift();
      }

      redoStackRef.current = [];
      isInternalTimelineChangeRef.current = true;
      setPreviewDurations({});
      onChange(normalized);
    },
    [onChange, orderedItems],
  );

  const handleUndo = React.useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;

    redoStackRef.current.push(cloneTimeline(orderedItems));
    isInternalTimelineChangeRef.current = true;
    setPreviewDurations({});
    onChange(normalizeOrder(previous));
  }, [onChange, orderedItems]);

  const handleRedo = React.useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;

    undoStackRef.current.push(cloneTimeline(orderedItems));
    isInternalTimelineChangeRef.current = true;
    setPreviewDurations({});
    onChange(normalizeOrder(next));
  }, [onChange, orderedItems]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (pickerOpen || saveModalOpen) return;
      if (isTextInputTarget(event.target)) return;

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) return;

      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y';

      if (isUndo) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (isRedo) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRedo, handleUndo, pickerOpen, saveModalOpen]);

  const handleAddMedia = (selected: SelectedMedia[]) => {
    if (selected.length === 0) return;

    const next = [
      ...orderedItems,
      ...selected.map((media, index) => makeItem(media, orderedItems.length + index)),
    ];

    commitTimeline(next);
  };

  const handleRemoveItem = (itemId: string) => {
    commitTimeline(orderedItems.filter((item) => item.id !== itemId));
  };

  const handlePreviewDuration = (id: string, duration: number) => {
    setPreviewDurations((prev) => ({ ...prev, [id]: duration }));
  };

  const handleReplaceItem = (itemId: string, media: SelectedMedia) => {
    const nextVideoDuration = Math.max(MIN_DURATION_SECONDS, (media.durationMs ?? 15000) / 1000);
    const isVideo = media.mediaType === 'VIDEO';

    commitTimeline(
      normalizeOrder(
        orderedItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                mediaId: media.id,
                name: media.name,
                type: isVideo ? 'video' : 'image',
                duration: isVideo ? nextVideoDuration : item.duration,
                maxDuration: isVideo ? nextVideoDuration : undefined,
                url: media.url,
              }
            : item,
        ),
      ),
    );
  };

  const handleCommitDuration = (id: string, duration: number) => {
    commitTimeline(
      normalizeOrder(
        orderedItems.map((item) =>
          item.id === id
            ? { ...item, duration: Number(duration.toFixed(1)) }
            : item,
        ),
      ),
    );
  };

  const handleReorderChange = React.useCallback(
    (next: CampaignTimelineItem[]) => {
      commitTimeline(next);
    },
    [commitTimeline],
  );

  const reorder = useTimelineReorder({
    items: orderedItems,
    onChange: handleReorderChange,
  });

  const handleOpenSaveModal = () => {
    void onSavePlaylist();
  };

  const handleConfirmSave = async () => {
    const trimmedName = draftPlaylistName.trim();
    await onSavePlaylist(trimmedName);
    if (trimmedName.length >= 2) {
      setSaveModalOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Timeline da campanha</h3>
            <p className="text-xs text-muted-foreground">
              Organize a sequência de exibição como uma timeline.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenSaveModal}
              disabled={isSavingPlaylist || orderedItems.length === 0}
              aria-label={isSavingPlaylist ? 'Salvando playlist' : 'Salvar playlist'}
              className="h-8 gap-2 px-3"
            >
              <HugeiconsIcon icon={Save} size={14} />
              <span>{isSavingPlaylist ? 'Salvando...' : 'Salvar playlist'}</span>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          {orderedItems.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium">Nenhum conteúdo na timeline</p>
              <p className="text-xs text-muted-foreground">
                Adicione imagens e vídeos para montar a playlist da campanha.
              </p>
              <Button type="button" variant="outline" onClick={() => setPickerOpen(true)} className="mt-2 gap-2">
                <HugeiconsIcon icon={AddCircleIcon} size={16} />
                Adicionar conteúdos
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                {/* Track background subtle lines */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px)] bg-[size:40px_100%]" />

                <div className="relative overflow-x-auto overflow-y-hidden px-4 pt-10 pb-5 [scrollbar-width:thin]">
                  <DndContext
                    sensors={reorder.sensors}
                    collisionDetection={reorder.collisionDetection}
                    onDragStart={reorder.handleDragStart}
                    onDragEnd={reorder.handleDragEnd}
                    onDragCancel={reorder.handleDragCancel}
                  >
                    <SortableContext items={reorder.itemIds} strategy={horizontalListSortingStrategy}>
                      <div className="flex w-max min-w-full items-center gap-1.5">
                        {effectiveItems.map((item) => (
                          <TimelineClip
                            key={item.id}
                            item={item}
                            pixelsPerSecond={PIXELS_PER_SECOND}
                            minDuration={MIN_DURATION_SECONDS}
                            snapSeconds={SNAP_SECONDS}
                            onPreviewDuration={handlePreviewDuration}
                            onCommitDuration={handleCommitDuration}
                            onRemove={handleRemoveItem}
                            onReplace={handleReplaceItem}
                          />
                        ))}
                      </div>
                    </SortableContext>

                    <DragOverlay>
                      {reorder.activeItem ? (
                        <div
                          className="h-16 overflow-hidden rounded-xl border-2 border-primary/50 bg-zinc-950 text-zinc-50"
                          style={{
                            width: Math.max(reorder.activeItem.duration * PIXELS_PER_SECOND, 140),
                          }}
                        >
                          <div className="flex h-full w-full items-center">
                            <div className="relative h-full w-16 shrink-0 border-r border-zinc-800 bg-zinc-900">
                              {reorder.activeItem.type === 'image' && reorder.activeItem.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={reorder.activeItem.url} alt="" className="h-full w-full object-cover opacity-80" />
                              ) : reorder.activeItem.type === 'video' && reorder.activeItem.url ? (
                                <video
                                  src={reorder.activeItem.url}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="h-full w-full object-cover opacity-80"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <HugeiconsIcon icon={reorder.activeItem.type === 'video' ? PlayIcon : ImageIcon} size={16} className="text-zinc-500" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 px-3">
                              <p className="truncate text-[11px] font-medium text-zinc-400 opacity-80">{reorder.activeItem.name}</p>
                              <p className="mt-0.5 text-[10px] text-zinc-500">{reorder.activeItem.duration.toFixed(1)}s</p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-2">
                <Button type="button" variant="outline" onClick={() => setPickerOpen(true)} className="gap-2 bg-background">
                  <HugeiconsIcon icon={AddCircleIcon} size={16} />
                  Adicionar conteúdos
                </Button>

                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-foreground">{orderedItems.length} clipes</span>
                  <span className="h-4 w-px bg-border" aria-hidden="true" />
                  <span className="font-bold text-primary tracking-wide tabular-nums">
                    {formatTimelineTimecode(totalDurationSeconds)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {helperMessage && <p className="text-xs text-muted-foreground">{helperMessage}</p>}
      </div>

      <UploadDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAddMedia}
        multiple
        selectedIds={selectedIds}
      />

      <Dialog open={saveModalOpen} onOpenChange={isSavingPlaylist ? undefined : setSaveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar playlist</DialogTitle>
            <DialogDescription>
              Defina um nome para salvar e reutilizar esta playlist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="playlist-name-modal" className="text-sm font-medium">
              Nome da playlist
            </label>
            <Input
              id="playlist-name-modal"
              placeholder="Ex.: Recepção manhã"
              value={draftPlaylistName}
              onChange={(event) => setDraftPlaylistName(event.target.value)}
              disabled={isSavingPlaylist}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveModalOpen(false)}
              disabled={isSavingPlaylist}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmSave()}
              disabled={isSavingPlaylist || draftPlaylistName.trim().length < 2}
            >
              {isSavingPlaylist ? 'Salvando...' : 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
