'use client';

import { getCachedResponse } from '@/lib/media-cache';
import { getSchedulePosition } from '@/lib/scheduler';
import type {
  DeviceManifestSchemaVersion,
  ManifestTimelineItem,
  PlaybackManifest,
  PlaybackVariant,
} from '@/lib/api';
import type { DeviceProfile } from '@/lib/device-profile';

export type AssetQueueState =
  | 'REMOTE_AVAILABLE'
  | 'DOWNLOADING'
  | 'READY_LOCAL'
  | 'FAILED'
  | 'STALE'
  | 'FALLBACK_READY';

export type RuntimePlaybackItem = {
  assetId: string;
  playbackKey: string;
  campaignId?: string;
  mediaType: 'IMAGE' | 'VIDEO';
  durationMs: number;
  url: string;
  selectedVariantId: string;
  selectedVariantDelivery: PlaybackVariant['delivery'];
  fallbackVariantId?: string;
  fallbackUrl?: string;
  assetHash?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  queueState: AssetQueueState;
  manifestSchemaVersion: DeviceManifestSchemaVersion;
};

export type PersistedPlaybackStateLike = {
  assetId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  startedAt: string;
  currentTimeSec?: number;
  manifestVersion?: string | null;
  updatedAt: string;
};

function isWindowActive(validFrom?: string | null, validUntil?: string | null, now = Date.now()): boolean {
  const fromTime = validFrom ? new Date(validFrom).getTime() : null;
  const untilTime = validUntil ? new Date(validUntil).getTime() : null;

  if (fromTime != null && Number.isFinite(fromTime) && now < fromTime) return false;
  if (untilTime != null && Number.isFinite(untilTime) && now > untilTime) return false;
  return true;
}

function scoreVariant(variant: PlaybackVariant, profile: DeviceProfile, preferFallback = false): number {
  let score = 0;

  if (variant.delivery === 'MP4') score += preferFallback ? 20 : 100;
  if (variant.delivery === 'HLS') score += profile.prefersHlsPlayback || preferFallback ? 90 : 45;
  if (variant.delivery === 'IMAGE') score += 100;
  if (variant.isDefault) score += 10;

  if (profile.tier === 'LOW' && variant.delivery === 'HLS') score += 10;
  if (profile.tier === 'HIGH' && variant.delivery === 'MP4') score += 5;

  return score;
}

export function selectPlaybackVariant(
  item: ManifestTimelineItem,
  profile: DeviceProfile,
  preferFallback = false,
): { primary: PlaybackVariant | null; fallback: PlaybackVariant | null } {
  const variants = item.variants ?? [];
  if (variants.length === 0) return { primary: null, fallback: null };

  const ordered = [...variants].sort((a, b) => scoreVariant(b, profile, preferFallback) - scoreVariant(a, profile, preferFallback));
  const primary = ordered[0] ?? null;
  const fallback = ordered.find((variant) => variant.id !== primary?.id) ?? null;
  return { primary, fallback };
}

async function resolveQueueState(url: string, fallbackUrl?: string): Promise<AssetQueueState> {
  const cached = await getCachedResponse(url);
  if (cached) return 'READY_LOCAL';

  if (fallbackUrl) {
    const fallbackCached = await getCachedResponse(fallbackUrl);
    if (fallbackCached) return 'FALLBACK_READY';
  }

  return 'REMOTE_AVAILABLE';
}

export async function buildRuntimePlaybackItems(
  manifest: PlaybackManifest,
  profile: DeviceProfile,
): Promise<RuntimePlaybackItem[]> {
  const timeline = manifest.timeline ?? [];
  const now = Date.now();

  const playable = timeline.filter((item) => {
    const assetState = item.assetState ?? 'READY';
    return (assetState === 'READY' || assetState === 'READY_WITH_WARNINGS') && isWindowActive(item.validFrom, item.validUntil, now);
  });

  const resolved = await Promise.all(
    playable.map(async (item) => {
      const { primary, fallback } = selectPlaybackVariant(item, profile);
      if (!primary) return null;

      return {
        assetId: item.assetId,
        playbackKey: `${item.assetId}:${primary.id}`,
        campaignId: item.campaignId,
        mediaType: item.mediaType,
        durationMs: item.durationMs,
        url: primary.url,
        selectedVariantId: primary.id,
        selectedVariantDelivery: primary.delivery,
        fallbackVariantId: fallback?.id,
        fallbackUrl: fallback?.url,
        assetHash: primary.hash ?? item.hash ?? null,
        validFrom: item.validFrom ?? manifest.validFrom,
        validUntil: item.validUntil ?? manifest.validUntil,
        queueState: await resolveQueueState(primary.url, fallback?.url),
        manifestSchemaVersion: manifest.manifestSchemaVersion,
      } satisfies RuntimePlaybackItem;
    }),
  );

  const playbackItems: RuntimePlaybackItem[] = [];

  for (const item of resolved) {
    if (item) {
      playbackItems.push(item);
    }
  }

  return playbackItems;
}

export function resolveStartingPlaybackIndex(params: {
  manifest: PlaybackManifest;
  items: RuntimePlaybackItem[];
  persisted: PersistedPlaybackStateLike | null;
}): { index: number; restoreCurrentTimeSec: number | null } {
  const { manifest, items, persisted } = params;

  if (items.length === 0) {
    return { index: 0, restoreCurrentTimeSec: null };
  }

  if (persisted) {
    const persistedIndex = items.findIndex((item) => item.assetId === persisted.assetId);
    if (persistedIndex >= 0 && isWindowActive(items[persistedIndex].validFrom, items[persistedIndex].validUntil)) {
      return {
        index: persistedIndex,
        restoreCurrentTimeSec: persisted.mediaType === 'VIDEO' && typeof persisted.currentTimeSec === 'number'
          ? Math.max(0, persisted.currentTimeSec)
          : null,
      };
    }
  }

  const epoch = manifest.validFrom
    ? new Date(manifest.validFrom).getTime()
    : manifest.resolvedAt
      ? new Date(manifest.resolvedAt).getTime()
      : 0;
  const pos = getSchedulePosition(items, Number.isFinite(epoch) ? epoch : 0);

  return {
    index: pos.index,
    restoreCurrentTimeSec: null,
  };
}
