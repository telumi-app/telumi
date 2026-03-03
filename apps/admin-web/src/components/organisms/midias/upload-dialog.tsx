'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Upload04Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  RefreshIcon,
  ImageIcon,
  FileVideoIcon,
  Delete02Icon,
  PlayListIcon,
  Clock01Icon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { mediaApi, uploadToPresignedUrl, type Media } from '@/lib/api/media';
import { playlistsApi, type Playlist } from '@/lib/api/playlists';
import { cn } from '@/lib/utils';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'wmv', 'flv', 'mpeg', 'mpg', '3gp',
];
const ACCEPT_STRING = `${ALLOWED_MIME_TYPES.join(',')},video/*,${ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')}`;

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

function formatPlaylistDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const h = Math.floor(min / 60);
  if (h > 0) return `${h}h ${min % 60}min`;
  if (min > 0) return `${min}min ${sec % 60}s`;
  return `${sec}s`;
}

function isImageType(mimeType: string) {
  return mimeType.startsWith('image/');
}

function isVideoType(mimeType: string) {
  return mimeType.startsWith('video/');
}

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function normalizeMimeType(file: File): string {
  if (file.type) return file.type.toLowerCase();

  const ext = getFileExtension(file.name);
  const byExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    '3gp': 'video/3gpp',
  };

  return byExtension[ext] ?? '';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type FileQueueItem = {
  id: string;
  file: File;
  mimeType: string;
  name: string;
  status: 'waiting' | 'uploading' | 'confirming' | 'done' | 'error';
  progress: number;
  error?: string;
};

export type SelectedMedia = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  mediaType: 'IMAGE' | 'VIDEO';
  fileSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  url?: string;
};

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: () => void;
  onSelect?: (media: SelectedMedia[]) => void;
  multiple?: boolean;
  selectedIds?: string[];
};

export function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
  onSelect,
  multiple = true,
  selectedIds = [],
}: UploadDialogProps) {
  const [queue, setQueue] = React.useState<FileQueueItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [history, setHistory] = React.useState<Media[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set(selectedIds));
  const [activeTab, setActiveTab] = React.useState<'history' | 'playlists'>('history');
  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = React.useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = React.useState<string | null>(null);
  const [loadingPlaylistId, setLoadingPlaylistId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const hasFinished = queue.length > 0 && queue.every((f) => f.status === 'done' || f.status === 'error');
  const hasUploaded = queue.some((f) => f.status === 'done');
  const allHistorySelected = history.length > 0 && selected.size === history.length;

  React.useEffect(() => {
    if (!open) {
      setQueue([]);
      setIsDragging(false);
      setIsProcessing(false);
      setHistory([]);
      setSelected(new Set());
      setActiveTab('history');
      setPlaylists([]);
      setSelectedPlaylistId(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || activeTab !== 'playlists') return;
    const load = async () => {
      setPlaylistsLoading(true);
      try {
        const res = await playlistsApi.list();
        setPlaylists(res.data ?? []);
      } catch {
        setPlaylists([]);
      } finally {
        setPlaylistsLoading(false);
      }
    };
    void load();
  }, [open, activeTab]);

  React.useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSelectedPlaylistId(null);
    }
  }, [open, selectedIds]);

  const deleteMediaByIds = async (ids: string[]) => {
    if (ids.length === 0) return;

    const results = await Promise.allSettled(ids.map((id) => mediaApi.remove(id)));
    const deletedIds = ids.filter((_, index) => results[index]?.status === 'fulfilled');

    if (deletedIds.length === 0) {
      return;
    }

    setHistory((prev) => prev.filter((item) => !deletedIds.includes(item.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of deletedIds) next.delete(id);
      return next;
    });
    onUploaded?.();
  };

  const handleDeleteSingle = async (id: string) => {
    const confirmed = window.confirm('Excluir este arquivo da biblioteca?');
    if (!confirmed) return;
    await deleteMediaByIds([id]);
  };

  const handleDeleteSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    const confirmed = window.confirm(`Excluir ${ids.length} ${ids.length === 1 ? 'arquivo' : 'arquivos'} selecionados?`);
    if (!confirmed) return;

    await deleteMediaByIds(ids);
  };

  React.useEffect(() => {
    if (!open) return;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await mediaApi.list();
        setHistory((res.data ?? []).slice(0, 12));
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    void loadHistory();
  }, [open]);

  const validateFile = (file: File, mimeType: string): string | null => {
    const ext = getFileExtension(file.name);
    const isSupportedImage = ALLOWED_MIME_TYPES.includes(mimeType);
    const isSupportedVideo = isVideoType(mimeType);
    const isSupportedByExt = ALLOWED_EXTENSIONS.includes(ext);

    if (!isSupportedImage && !isSupportedVideo && !isSupportedByExt) {
      return `Tipo "${mimeType || file.type || 'desconhecido'}" não suportado.`;
    }

    const maxSize = isImageType(mimeType) ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      return `Arquivo excede ${maxMb} MB.`;
    }

    return null;
  };

  const addFiles = (files: FileList | File[]) => {
    const newItems: FileQueueItem[] = [];

    for (const file of Array.from(files)) {
      const mimeType = normalizeMimeType(file);
      const error = validateFile(file, mimeType);
      newItems.push({
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        mimeType,
        name: file.name.replace(/\.[^/.]+$/, ''),
        status: error ? 'error' : 'waiting',
        progress: 0,
        error: error ?? undefined,
      });
    }

    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const processQueue = async () => {
    if (isProcessing) return;

    const pending = queue.filter((item) => item.status === 'waiting');
    if (pending.length === 0) return;

    setIsProcessing(true);
    const uploadedFromBatch: SelectedMedia[] = [];

    for (const item of pending) {
      try {
        setQueue((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading', progress: 0 } : f)),
        );

        const uploadRes = await mediaApi.requestUploadUrl({
          name: item.name,
          originalName: item.file.name,
          mimeType: item.mimeType,
          fileSize: item.file.size,
        });

        const { mediaId, uploadUrl } = uploadRes.data!;

        await uploadToPresignedUrl(uploadUrl, item.file, item.mimeType, (percent) => {
          setQueue((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progress: percent } : f)),
          );
        });

        setQueue((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'confirming', progress: 100 } : f)),
        );

        const confirmRes = await mediaApi.confirmUpload(mediaId);
        const confirmed = confirmRes.data;

        if (confirmed) {
          uploadedFromBatch.push({
            id: confirmed.id,
            name: confirmed.name,
            originalName: confirmed.originalName,
            mimeType: confirmed.mimeType,
            mediaType: confirmed.mediaType as 'IMAGE' | 'VIDEO',
            fileSize: confirmed.fileSize,
            durationMs: confirmed.durationMs,
            width: confirmed.width,
            height: confirmed.height,
            url: confirmed.url,
          });
        }

        setQueue((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'done', progress: 100 } : f)),
        );
      } catch (err) {
        setQueue((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Erro no upload.',
                }
              : f,
          ),
        );
      }
    }

    setIsProcessing(false);

    try {
      const res = await mediaApi.list();
      setHistory((res.data ?? []).slice(0, 12));
    } catch {
      setHistory([]);
    }

    if (uploadedFromBatch.length > 0) {
      // Auto-seleciona os itens enviados para o usuário confirmar sem fechar o modal
      setSelected((prev) => {
        const next = multiple ? new Set(prev) : new Set<string>();
        uploadedFromBatch.forEach((m) => next.add(m.id));
        return next;
      });
    }
  };

  React.useEffect(() => {
    if (!open || isProcessing) return;
    const hasWaiting = queue.some((item) => item.status === 'waiting');
    if (!hasWaiting) return;
    void processQueue();
  }, [open, isProcessing, queue]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!multiple) next.clear();
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmSelection = async () => {
    if (!onSelect) return;

    if (activeTab === 'playlists') {
      if (!selectedPlaylistId) return;

      setLoadingPlaylistId(selectedPlaylistId);
      try {
        const res = await playlistsApi.get(selectedPlaylistId);
        const full = res.data;
        const items = (full?.items ?? [])
          .sort((a, b) => a.position - b.position)
          .filter((item) => item.media);

        if (items.length === 0) return;

        const media = items.map((item) => ({
          id: item.media!.id,
          name: item.media!.name,
          originalName: item.media!.originalName,
          mimeType: item.media!.mimeType,
          mediaType: item.media!.mediaType,
          fileSize: item.media!.fileSize,
          durationMs: item.durationMs,
          width: item.media!.width,
          height: item.media!.height,
          url: item.media!.url,
        }));

        onSelect(media);
        onOpenChange(false);
      } catch {
        return;
      } finally {
        setLoadingPlaylistId(null);
      }

      return;
    }

    const selectedMedia = history
      .filter((item) => selected.has(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        originalName: item.originalName,
        mimeType: item.mimeType,
        mediaType: item.mediaType as 'IMAGE' | 'VIDEO',
        fileSize: item.fileSize,
        durationMs: item.durationMs,
        width: item.width,
        height: item.height,
        url: item.url,
      }));

    onSelect(selectedMedia);
    onOpenChange(false);
  };

  const handleClose = () => {
    if (hasUploaded) {
      onUploaded?.();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : handleClose}>
      <DialogContent className="max-w-[1120px] overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-background px-6 py-5">
          <DialogTitle className="text-xl leading-none">Selecionar conteúdo</DialogTitle>
          <DialogDescription className="pt-1">
            Escolha mídias da biblioteca ou envie novos arquivos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-[520px] grid-cols-12 bg-background">
          <aside className="col-span-12 border-b bg-muted/15 px-4 py-5 md:col-span-3 md:border-b-0 md:border-r md:px-5 md:py-6">
            <div className="space-y-3">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Navegação</p>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  activeTab === 'history'
                    ? 'border bg-background font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <HugeiconsIcon icon={ImageIcon} size={16} className="text-muted-foreground" />
                Histórico
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('playlists')}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  activeTab === 'playlists'
                    ? 'border bg-background font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <HugeiconsIcon icon={PlayListIcon} size={16} className="text-muted-foreground" />
                Playlists
              </button>
            </div>
          </aside>

          <section className="col-span-12 flex min-h-0 flex-col border-b px-5 py-5 md:col-span-6 md:border-b-0 md:border-r md:px-6 md:py-6">

            {/* ── PLAYLISTS TAB ────────────────────────────────── */}
            {activeTab === 'playlists' && (
              <div className="flex flex-1 flex-col">
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="text-lg font-semibold">Playlists</h3>
                  <span className="text-xs text-muted-foreground">{playlists.length} itens</span>
                </div>

                <div className="max-h-[380px] min-h-0 flex-1 overflow-y-auto pb-1 [scrollbar-width:thin] [scrollbar-color:rgba(161,161,170,0.7)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400/70">
                  {playlistsLoading ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center">
                      <HugeiconsIcon icon={RefreshIcon} size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : playlists.length === 0 ? (
                    <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 text-center">
                      <HugeiconsIcon icon={PlayListIcon} size={28} className="mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Nenhuma playlist salva ainda.</p>
                    </div>
                  ) : (
                    <div className="grid content-start grid-cols-1 gap-3 sm:grid-cols-2">
                      {playlists.map((pl) => {
                        const isSelectedPlaylist = selectedPlaylistId === pl.id;
                        return (
                        <button
                          key={pl.id}
                          type="button"
                          disabled={!!loadingPlaylistId || isProcessing}
                          onClick={() => setSelectedPlaylistId((prev) => (prev === pl.id ? null : pl.id))}
                          className={cn(
                            'group relative flex flex-col gap-2 rounded-xl border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-60',
                            isSelectedPlaylist && 'border-black bg-black/[0.03] ring-1 ring-black/40',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                              {loadingPlaylistId === pl.id ? (
                                <HugeiconsIcon icon={RefreshIcon} size={16} className="animate-spin text-primary" />
                              ) : (
                                <HugeiconsIcon icon={PlayListIcon} size={16} className="text-primary" />
                              )}
                            </div>
                            <span className={cn(
                              'mt-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide transition-opacity',
                              isSelectedPlaylist
                                ? 'opacity-100 text-emerald-600'
                                : 'text-primary opacity-0 group-hover:opacity-100',
                            )}>
                              {isSelectedPlaylist && (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-black bg-black text-emerald-400">
                                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={10} />
                                </span>
                              )}
                              {isSelectedPlaylist ? 'Selecionada' : 'Selecionar'}
                            </span>
                          </div>
                          <p className="truncate text-sm font-medium leading-snug">{pl.name}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <HugeiconsIcon icon={ImageIcon} size={11} />
                              {pl.itemCount} {pl.itemCount === 1 ? 'item' : 'itens'}
                            </span>
                            {pl.totalDurationMs > 0 && (
                              <span className="flex items-center gap-1">
                                <HugeiconsIcon icon={Clock01Icon} size={11} />
                                {formatPlaylistDuration(pl.totalDurationMs)}
                              </span>
                            )}
                          </div>
                        </button>
                      );})}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── HISTÓRICO TAB ────────────────────────────────── */}
            {activeTab === 'history' && (<>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">Histórico</h3>
                <span className="text-xs text-muted-foreground">{history.length} itens</span>
              </div>

              {onSelect && (
                <div className="flex flex-wrap items-center gap-2">
                  {!allHistorySelected && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(new Set(history.map((item) => item.id)))}
                      disabled={history.length === 0 || isProcessing}
                    >
                      Selecionar tudo
                    </Button>
                  )}
                  {selected.size > 0 && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(new Set())}
                        disabled={isProcessing}
                        className="bg-background"
                      >
                        Limpar seleção
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleDeleteSelected()}
                        disabled={isProcessing}
                        className="gap-1"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={14} />
                        Excluir selecionados ({selected.size})
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="max-h-[338px] min-h-0 flex-1 overflow-y-auto pb-1 [scrollbar-width:thin] [scrollbar-color:rgba(161,161,170,0.7)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:shadow-none [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400/70 [&::-webkit-scrollbar-thumb]:border-0">
              {historyLoading ? (
                <div className="flex h-full items-center justify-center py-10">
                  <HugeiconsIcon icon={RefreshIcon} size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 text-center">
                  <HugeiconsIcon icon={ImageIcon} size={28} className="mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhum conteúdo enviado ainda.</p>
                </div>
              ) : (
                <div className="grid content-start grid-cols-2 gap-3 sm:grid-cols-3">
                  {history.map((item) => {
                    const isSelected = selected.has(item.id);
                    const cardClassName = cn(
                      'group relative overflow-hidden rounded-xl border bg-background text-left transition',
                      onSelect && 'hover:border-primary/50',
                      isSelected && 'border-primary ring-1 ring-primary/40',
                    );

                    const content = (
                      <>
                        {onSelect && (
                          <button
                            type="button"
                            aria-label={isSelected ? 'Desmarcar arquivo' : 'Selecionar arquivo'}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSelect(item.id);
                            }}
                            className={cn(
                              "absolute left-2 top-2 z-20 transition-opacity",
                              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                          >
                            <span className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full border bg-background/90',
                              isSelected
                                ? 'border-black bg-black text-emerald-400 shadow-sm shadow-emerald-500/20'
                                : 'border-border text-transparent',
                            )}>
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          aria-label="Excluir arquivo"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteSingle(item.id);
                          }}
                          className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-md border bg-background/90 text-muted-foreground transition opacity-0 group-hover:opacity-100 hover:text-destructive"
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={13} />
                        </button>

                        <div className="relative aspect-video bg-muted/60">
                          {item.mediaType === 'IMAGE' && item.url ? (
                            <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                          ) : item.mediaType === 'VIDEO' && item.url ? (
                            <video
                              src={item.url}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <HugeiconsIcon icon={FileVideoIcon} size={18} className="text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex h-10 items-start px-2.5 py-2">
                          <p title={item.name} className="truncate text-[11px] font-medium leading-tight text-foreground/90">{item.name}</p>
                        </div>
                      </>
                    );

                    return (
                      <div
                        key={item.id}
                        onClick={onSelect ? () => toggleSelect(item.id) : undefined}
                        onKeyDown={onSelect ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleSelect(item.id);
                          }
                        } : undefined}
                        role={onSelect ? 'button' : undefined}
                        tabIndex={onSelect ? 0 : -1}
                        className={cn(cardClassName, onSelect && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60')}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            </> )}

            {activeTab === 'history' && queue.length > 0 && (
              <div className="mt-4 rounded-xl border bg-background p-3.5">
                <p className="mb-2 text-sm font-medium">Fila de upload</p>
                <div className="max-h-[180px] space-y-2 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(161,161,170,0.7)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:shadow-none [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400/70 [&::-webkit-scrollbar-thumb]:border-0">
                  {queue.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-md border p-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <HugeiconsIcon
                          icon={isImageType(item.mimeType) ? ImageIcon : FileVideoIcon}
                          size={16}
                          className="text-muted-foreground"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium">{item.file.name}</p>
                          <span className="text-[11px] text-muted-foreground">{formatFileSize(item.file.size)}</span>
                        </div>

                        {(item.status === 'uploading' || item.status === 'confirming') && (
                          <Progress value={item.progress} className="h-1" />
                        )}

                        <div className="text-[11px] text-muted-foreground">
                          {item.status === 'waiting' && 'Aguardando envio'}
                          {item.status === 'uploading' && `${item.progress}% enviado`}
                          {item.status === 'confirming' && 'Confirmando upload...'}
                          {item.status === 'done' && (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={11} /> Enviado
                            </span>
                          )}
                          {item.status === 'error' && <span className="text-destructive">{item.error}</span>}
                        </div>
                      </div>

                      {(item.status === 'waiting' || item.status === 'error') && !isProcessing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removeFromQueue(index)}
                        >
                          <HugeiconsIcon icon={Cancel01Icon} size={14} />
                        </Button>
                      )}

                      {(item.status === 'uploading' || item.status === 'confirming') && (
                        <HugeiconsIcon icon={RefreshIcon} size={14} className="shrink-0 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="col-span-12 flex flex-col px-5 py-5 md:col-span-3 md:px-6 md:py-6">
            <h3 className="mb-4 text-sm font-semibold">Enviar novo</h3>

            <div
              className={cn(
                'flex min-h-[240px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-5 text-center transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/40',
                isProcessing && 'pointer-events-none opacity-70',
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <HugeiconsIcon icon={Upload04Icon} size={30} className="text-muted-foreground" />
              <p className="max-w-[180px] text-sm text-muted-foreground">
                Solte um arquivo aqui ou clique para selecionar
              </p>
              <Button variant="outline" size="sm" className="gap-2">
                <HugeiconsIcon icon={Upload04Icon} size={14} />
                Selecionar arquivos
              </Button>
              <p className="text-[11px] text-muted-foreground/70">JPG, PNG, WebP, GIF, MP4, WebM</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <DialogFooter className="mt-4 flex flex-col items-stretch gap-2 border-t pt-4">
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                {hasFinished ? 'Fechar' : 'Cancelar'}
              </Button>

              {onSelect && (
                <Button
                  onClick={() => void handleConfirmSelection()}
                  disabled={
                    isProcessing ||
                    !!loadingPlaylistId ||
                    (activeTab === 'history' ? selected.size === 0 : !selectedPlaylistId)
                  }
                >
                  {activeTab === 'history' ? `Confirmar (${selected.size})` : 'Confirmar playlist'}
                </Button>
              )}

              {isProcessing && (
                <Button disabled>
                  <HugeiconsIcon icon={RefreshIcon} size={14} className="mr-2 animate-spin" />
                  Enviando...
                </Button>
              )}
            </DialogFooter>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
