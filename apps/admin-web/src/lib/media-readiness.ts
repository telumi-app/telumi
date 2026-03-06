import type { Media } from '@/lib/api/media';

export function isMediaReadyForSelection(media: Pick<Media, 'mediaType' | 'playbackReadiness'>): boolean {
  if (media.mediaType === 'IMAGE') return true;
  return media.playbackReadiness !== 'BLOCKED';
}

export function getMediaReadinessLabel(media: Pick<Media, 'mediaType' | 'publicationState' | 'playbackReadiness'>): string {
  if (media.mediaType === 'IMAGE') return 'Pronta';
  if (media.publicationState === 'FAILED') return 'Falha ao preparar';
  if (media.playbackReadiness === 'BLOCKED') return 'Convertendo para o padrão do player';
  if (media.playbackReadiness === 'READY_WITH_FALLBACK') return 'Pronta enquanto finaliza adaptação';
  return 'Pronta para reprodução';
}
