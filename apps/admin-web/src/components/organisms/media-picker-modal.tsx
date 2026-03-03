'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle01Icon,
  ImageIcon,
  PlayIcon,
  RefreshIcon,
  Upload04Icon,
  FileVideoIcon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { mediaApi, uploadToPresignedUrl, type Media } from '@/lib/api/media';

// ─── Constants ─────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
];
const ACCEPT_STRING = ALLOWED_MIME_TYPES.join(',');
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

// ─── Helpers ───────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}

// ─── Types ─────────────────────────────────────────────────────────

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

type MediaPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: SelectedMedia[]) => void;
  multiple?: boolean;
  /** Filter by media type */
  mediaTypeFilter?: 'IMAGE' | 'VIDEO';
  /** Already selected media IDs (to show checkmarks) */
  selectedIds?: string[];
};

type TabView = 'library' | 'upload';

type UploadItem = {
  file: File;
  name: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  media?: Media;
  previewUrl?: string;
};

// ─── Component ─────────────────────────────────────────────────────

export function MediaPickerModal({
  open,
  onOpenChange,
  onSelect,
  multiple = true,
  mediaTypeFilter,
  selectedIds = [],
}: MediaPickerProps) {
  const [tab, setTab] = React.useState<TabView>('library');
  const [mediaList, setMediaList] = React.useState<Media[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set(selectedIds));
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Upload state
  const [uploadQueue, setUploadQueue] = React.useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  // Revogar object URLs ao fechar
  React.useEffect(() => {
    if (!open) {
      setUploadQueue((prev) => {
        prev.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        return [];
      });
      setIsDragging(false);
    }
  }, [open]);

  // Load library
  const loadLibrary = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await mediaApi.list();
      let items = res.data ?? [];

      if (mediaTypeFilter) {
        items = items.filter((m) => m.mediaType === mediaTypeFilter);
      }

      setMediaList(items);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [mediaTypeFilter]);

  React.useEffect(() => {
    if (open) {
      void loadLibrary();
      setSelected(new Set(selectedIds));
      setTab('library');
      setSearch('');
    }
  }, [open, loadLibrary, selectedIds]);

  // ─── Library tab ───────────────────────────────────────────────

  const filteredMedia = React.useMemo(() => {
    if (!search.trim()) return mediaList;
    const lower = search.toLowerCase();
    return mediaList.filter(
      (m) =>
        m.name.toLowerCase().includes(lower) ||
        m.originalName.toLowerCase().includes(lower),
    );
  }, [mediaList, search]);

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

  const handleConfirm = () => {
    const selectedMedia = mediaList
      .filter((m) => selected.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        originalName: m.originalName,
        mimeType: m.mimeType,
        mediaType: m.mediaType as 'IMAGE' | 'VIDEO',
        fileSize: m.fileSize,
        durationMs: m.durationMs,
        width: m.width,
        height: m.height,
        url: m.url,
      }));

    onSelect(selectedMedia);
    onOpenChange(false);
  };

  // ─── Upload tab ────────────────────────────────────────────────

  const buildUploadItems = (files: FileList | File[]): UploadItem[] => {
    const items: UploadItem[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) continue;
      const maxSize = file.type.startsWith('image/') ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
      if (file.size > maxSize) continue;
      items.push({
        file,
        name: file.name.replace(/\.[^/.]+$/, ''),
        status: 'uploading',
        progress: 0,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      });
    }
    return items;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newItems = buildUploadItems(e.target.files);
    if (newItems.length === 0) return;
    setUploadQueue((prev) => [...prev, ...newItems]);
    e.target.value = '';
    void processUploads(newItems);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length === 0) return;
    const newItems = buildUploadItems(e.dataTransfer.files);
    if (newItems.length === 0) return;
    setUploadQueue((prev) => [...prev, ...newItems]);
    void processUploads(newItems);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processUploads = async (items: UploadItem[]) => {
    setIsUploading(true);

    for (const item of items) {
      try {
        const uploadRes = await mediaApi.requestUploadUrl({
          name: item.name,
          originalName: item.file.name,
          mimeType: item.file.type,
          fileSize: item.file.size,
        });

        const { mediaId, uploadUrl } = uploadRes.data!;

        await uploadToPresignedUrl(uploadUrl, item.file, item.file.type, (percent) => {
          setUploadQueue((prev) =>
            prev.map((u) =>
              u.file === item.file ? { ...u, progress: percent } : u,
            ),
          );
        });

        const confirmRes = await mediaApi.confirmUpload(mediaId);

        setUploadQueue((prev) =>
          prev.map((u) =>
            u.file === item.file
              ? { ...u, status: 'done', progress: 100, media: confirmRes.data }
              : u,
          ),
        );

        // Auto-select uploaded media
        if (confirmRes.data) {
          setSelected((prev) => {
            const next = new Set(prev);
            next.add(confirmRes.data!.id);
            return next;
          });
        }
      } catch (err) {
        setUploadQueue((prev) =>
          prev.map((u) =>
            u.file === item.file
              ? { ...u, status: 'error', error: err instanceof Error ? err.message : 'Erro no upload.' }
              : u,
          ),
        );
      }
    }


    // Reload library after uploads
    await loadLibrary();
    setIsUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar conteúdo</DialogTitle>
          <DialogDescription>
            Escolha mídias da biblioteca ou envie novos arquivos.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          <button
            onClick={() => setTab('library')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'library'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Biblioteca
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'upload'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Enviar novo
          </button>
        </div>

        {/* Library Tab */}
        {tab === 'library' && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <HugeiconsIcon icon={RefreshIcon} size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <HugeiconsIcon icon={ImageIcon} size={32} className="mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {search ? 'Nenhum resultado encontrado.' : 'Nenhuma mídia disponível.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setTab('upload')}
                  >
                    Enviar conteúdo
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {filteredMedia.map((media) => {
                    const isSelected = selected.has(media.id);
                    const isImage = media.mediaType === 'IMAGE';

                    return (
                      <button
                        key={media.id}
                        type="button"
                        onClick={() => toggleSelect(media.id)}
                        className={`group relative aspect-video overflow-hidden rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-transparent hover:border-muted-foreground/30'
                        }`}
                      >
                        {/* Preview */}
                        {isImage && media.url ? (
                          <img
                            src={media.url}
                            alt={media.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted">
                            <HugeiconsIcon
                              icon={isImage ? ImageIcon : PlayIcon}
                              size={24}
                              className="text-muted-foreground"
                            />
                          </div>
                        )}

                        {/* Checkmark */}
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                            <HugeiconsIcon
                              icon={CheckmarkCircle01Icon}
                              size={28}
                              className="text-primary drop-shadow"
                            />
                          </div>
                        )}

                        {/* Badge */}
                        <div className="absolute left-1 top-1">
                          <Badge variant="secondary" className="text-[9px] px-1 uppercase">
                            {isImage ? 'IMG' : 'VID'}
                          </Badge>
                        </div>

                        {/* Name */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4">
                          <p className="truncate text-[11px] font-medium text-white">
                            {media.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {tab === 'upload' && (
          <div className="flex flex-col gap-3 flex-1 min-h-0">

            {/* Drop zone */}
            <div
              className={cn(
                'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-muted/30',
                isUploading && 'pointer-events-none opacity-60',
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                  isDragging ? 'bg-primary/15' : 'bg-muted',
                )}
              >
                <HugeiconsIcon
                  icon={Upload04Icon}
                  size={22}
                  className={cn(isDragging ? 'text-primary' : 'text-muted-foreground')}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDragging ? 'Solte os arquivos aqui' : 'Arraste ou clique para selecionar'}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  JPG · PNG · WebP · GIF · MP4 · WebM
                </p>
                <p className="text-[11px] text-muted-foreground/60">
                  Imagens até 50 MB · Vídeos até 500 MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Fila de arquivos */}
            {uploadQueue.length > 0 && (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {uploadQueue.map((item, idx) => (
                  <div
                    key={`${item.file.name}-${idx}`}
                    className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 transition-colors"
                  >
                    {/* Thumbnail / ícone */}
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <HugeiconsIcon
                            icon={FileVideoIcon}
                            size={16}
                            className="text-muted-foreground"
                          />
                        </div>
                      )}
                      {/* overlay de progresso na miniatura */}
                      {item.status === 'uploading' && (
                        <div
                          className="absolute inset-0 bg-black/50 transition-opacity"
                          style={{ opacity: item.progress < 100 ? 0.5 : 0 }}
                        />
                      )}
                    </div>

                    {/* Info + progress */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium leading-none">{item.file.name}</p>
                        {item.status === 'uploading' && (
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {item.progress}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </span>
                        {item.status === 'done' && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={11} />
                            Enviado
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="flex items-center gap-1 truncate text-[11px] text-destructive">
                            <HugeiconsIcon icon={AlertCircleIcon} size={11} />
                            {item.error}
                          </span>
                        )}
                      </div>
                      {item.status === 'uploading' && (
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Status icon */}
                    <div className="shrink-0">
                      {item.status === 'uploading' && (
                        <HugeiconsIcon
                          icon={RefreshIcon}
                          size={15}
                          className="animate-spin text-muted-foreground"
                        />
                      )}
                      {item.status === 'done' && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
                          <HugeiconsIcon
                            icon={CheckmarkCircle01Icon}
                            size={13}
                            className="text-emerald-500"
                          />
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                          <HugeiconsIcon
                            icon={AlertCircleIcon}
                            size={13}
                            className="text-destructive"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0}
          >
            Confirmar ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
