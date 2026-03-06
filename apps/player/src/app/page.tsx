'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, ApiRequestError, isOfflineMode, type DeviceManifestSchemaVersion } from '@/lib/api';
import { precacheAssets, detectCacheMode, getCacheMode } from '@/lib/media-cache';
import { DualMediaPlayer } from '@/components/dual-media-player';
import { PlaybackOverlay } from '@/components/playback-overlay';
import { PlayerStartupScreen } from '@/components/player-startup-screen';
import { detectDeviceProfile, type DeviceProfile } from '@/lib/device-profile';
import {
  buildRuntimePlaybackItems,
  resolveStartingPlaybackIndex,
  type RuntimePlaybackItem,
} from '@/lib/manifest-executor';
import { signPlayPayload } from '@/lib/proof-of-play';
import { PlaybackWatchdog } from '@/lib/watchdog';
import { registerServiceWorker } from '@/lib/sw-register';
import { getUptimeMs, PLAYER_VERSION } from '@/lib/boot-time';

const HEARTBEAT_QUEUE_KEY = 'telumi:heartbeat-queue';
const TELEMETRY_QUEUE_KEY = 'telumi:telemetry-queue';
const PLAY_EVENT_QUEUE_KEY = 'telumi:play-event-queue';
const DEVICE_TOKEN_KEY = 'deviceToken';
const DEVICE_SECRET_KEY = 'deviceSecret';
const PAIRED_DEVICE_KEY = 'telumi:paired-device';
const PLAYBACK_STATE_KEY = 'telumi:playback-state';
const HEARTBEAT_INTERVAL_MS = 15000;
const MANIFEST_POLL_INTERVAL_MS = 15000;

type PairedDevice = {
  id: string;
  name: string;
  workspaceName: string;
  locationName: string;
  orientation: string;
};

type PersistedPlaybackState = {
  assetId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  startedAt: string;
  currentTimeSec?: number;
  manifestVersion?: string | null;
  updatedAt: string;
};

type QueuedTelemetryEvent = {
  deviceToken: string;
  eventType: string;
  severity?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};

type QueuedPlayEvent = {
  deviceToken: string;
  playId: string;
  campaignId?: string;
  assetId?: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  manifestVersion?: string;
  assetHash?: string;
  hmacSignature?: string;
};

function isTokenInvalidError(error: unknown): boolean {
  return error instanceof ApiRequestError && (
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.statusCode === 404
  );
}

export default function PlayerHome() {
  const [code, setCode] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [paired, setPaired] = React.useState<PairedDevice | null>(null);
  const [deviceProfile, setDeviceProfile] = React.useState<DeviceProfile | null>(null);
  const [manifestSchemaVersion, setManifestSchemaVersion] = React.useState<DeviceManifestSchemaVersion>('v1');
  const [manifestVersion, setManifestVersion] = React.useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = React.useState<RuntimePlaybackItem[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [currentStartedAt, setCurrentStartedAt] = React.useState<string | null>(null);
  const [pendingAdvance, setPendingAdvance] = React.useState(false);
  const [nextReadyPlaybackKey, setNextReadyPlaybackKey] = React.useState<string | null>(null);
  const [hasResolvedManifestOnce, setHasResolvedManifestOnce] = React.useState(false);
  const [hasInitialPlaybackStarted, setHasInitialPlaybackStarted] = React.useState(false);
  const videoFallbackTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoCompletedKeyRef = React.useRef<string | null>(null);
  const restoreCurrentTimeRef = React.useRef<number | null>(null);
  const lastProgressPersistAtRef = React.useRef<number>(0);
  const videoElRef = React.useRef<HTMLVideoElement | null>(null);
  const previousOfflineModeRef = React.useRef<boolean>(false);

  // ── Service Worker + Adaptive Cache (boot-time init) ─────────────
  React.useEffect(() => {
    void registerServiceWorker();
    void detectCacheMode();
    setDeviceProfile(detectDeviceProfile());
  }, []);

  // ── Watchdog ─────────────────────────────────────────────────────
  const watchdogRef = React.useRef<PlaybackWatchdog | null>(null);

  const readPlaybackState = React.useCallback((): PersistedPlaybackState | null => {
    try {
      const raw = localStorage.getItem(PLAYBACK_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedPlaybackState;
      if (!parsed?.assetId || !parsed?.mediaType || !parsed?.startedAt) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const writePlaybackState = React.useCallback((state: PersistedPlaybackState | null) => {
    if (!state) {
      localStorage.removeItem(PLAYBACK_STATE_KEY);
      return;
    }
    localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
  }, []);
  const readJsonQueue = React.useCallback(<T,>(storageKey: string): T[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as T[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const writeJsonQueue = React.useCallback(<T,>(storageKey: string, items: T[], maxItems = 150) => {
    localStorage.setItem(storageKey, JSON.stringify(items.slice(-maxItems)));
  }, []);

  const readHeartbeatQueue = React.useCallback(
    () => readJsonQueue<{ occurredAt: string }>(HEARTBEAT_QUEUE_KEY),
    [readJsonQueue],
  );

  const writeHeartbeatQueue = React.useCallback((items: Array<{ occurredAt: string }>) => {
    writeJsonQueue(HEARTBEAT_QUEUE_KEY, items, 100);
  }, [writeJsonQueue]);

  const readTelemetryQueue = React.useCallback(
    () => readJsonQueue<QueuedTelemetryEvent>(TELEMETRY_QUEUE_KEY),
    [readJsonQueue],
  );

  const writeTelemetryQueue = React.useCallback((items: QueuedTelemetryEvent[]) => {
    writeJsonQueue(TELEMETRY_QUEUE_KEY, items, 200);
  }, [writeJsonQueue]);

  const readPlayEventQueue = React.useCallback(
    () => readJsonQueue<QueuedPlayEvent>(PLAY_EVENT_QUEUE_KEY),
    [readJsonQueue],
  );

  const writePlayEventQueue = React.useCallback((items: QueuedPlayEvent[]) => {
    writeJsonQueue(PLAY_EVENT_QUEUE_KEY, items, 200);
  }, [writeJsonQueue]);

  const enqueueHeartbeat = React.useCallback((occurredAt: string) => {
    const queue = readHeartbeatQueue();
    queue.push({ occurredAt });
    writeHeartbeatQueue(queue);
  }, [readHeartbeatQueue, writeHeartbeatQueue]);

  const flushHeartbeatQueue = React.useCallback(async (deviceToken: string) => {
    const queue = readHeartbeatQueue();
    if (queue.length === 0) return;

    const pending = [...queue];
    while (pending.length > 0) {
      const item = pending[0]!;
      await api.sendHeartbeat({
        deviceToken,
        occurredAt: item.occurredAt,
        playerStatus: 'PLAYING',
      });
      pending.shift();
      writeHeartbeatQueue(pending);
    }
  }, [readHeartbeatQueue, writeHeartbeatQueue]);

  const enqueueTelemetryEvent = React.useCallback((payload: QueuedTelemetryEvent) => {
    const queue = readTelemetryQueue();
    queue.push(payload);
    writeTelemetryQueue(queue);
  }, [readTelemetryQueue, writeTelemetryQueue]);

  const flushTelemetryQueue = React.useCallback(async () => {
    const queue = readTelemetryQueue();
    if (queue.length === 0) return;

    const pending = [...queue];
    while (pending.length > 0) {
      const item = pending[0]!;
      const result = await api.sendTelemetryEvent(item);
      if (!result.success) break;
      pending.shift();
      writeTelemetryQueue(pending);
    }
  }, [readTelemetryQueue, writeTelemetryQueue]);

  const enqueuePlayEvent = React.useCallback((payload: QueuedPlayEvent) => {
    const queue = readPlayEventQueue();
    queue.push(payload);
    writePlayEventQueue(queue);
  }, [readPlayEventQueue, writePlayEventQueue]);

  const flushPlayEventQueue = React.useCallback(async () => {
    const queue = readPlayEventQueue();
    if (queue.length === 0) return;

    const pending = [...queue];
    while (pending.length > 0) {
      const item = pending[0]!;
      const result = await api.sendPlayEvent(item);
      if (!result.success) break;
      pending.shift();
      writePlayEventQueue(pending);
    }
  }, [readPlayEventQueue, writePlayEventQueue]);

  const submitTelemetryEvent = React.useCallback(async (payload: QueuedTelemetryEvent) => {
    const result = await api.sendTelemetryEvent(payload);
    if (!result.success) {
      enqueueTelemetryEvent(payload);
    }
    return result;
  }, [enqueueTelemetryEvent]);

  const [isAutoPairing, setIsAutoPairing] = React.useState(true);

  const persistPairing = React.useCallback((data: {
    deviceToken: string;
    deviceSecret?: string;
    device: PairedDevice;
  }) => {
    localStorage.setItem(DEVICE_TOKEN_KEY, data.deviceToken);
    if (data.deviceSecret) {
      localStorage.setItem(DEVICE_SECRET_KEY, data.deviceSecret);
    }
    localStorage.setItem(PAIRED_DEVICE_KEY, JSON.stringify(data.device));
  }, []);

  const clearPairing = React.useCallback((message?: string) => {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem(DEVICE_SECRET_KEY);
    localStorage.removeItem(PAIRED_DEVICE_KEY);
    setPaired(null);
    setPlaylistItems([]);
    setManifestSchemaVersion('v1');
    setManifestVersion(null);
    setPendingAdvance(false);
    setNextReadyPlaybackKey(null);
    setHasResolvedManifestOnce(false);
    setHasInitialPlaybackStarted(false);
    if (message) {
      setErrorMsg(message);
    }
  }, []);

  // URL do painel admin — o QR Code aponta para cá
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://telumi.com.br/telas';

  const handlePair = React.useCallback(async () => {
    setErrorMsg('');
    setIsLoading(true);

    try {
      const result = await api.pairDevice(code);

      if (result.success) {
        persistPairing({
          deviceToken: result.data.deviceToken,
          deviceSecret: result.data.deviceSecret,
          device: result.data.device,
        });
        setPaired(result.data.device);
        void submitTelemetryEvent({
          deviceToken: result.data.deviceToken,
          eventType: 'PLAYER_STARTED',
          severity: 'INFO',
          occurredAt: new Date().toISOString(),
        });
      } else {
        setErrorMsg('userMessage' in result ? result.userMessage : 'Falha ao parear dispositivo.');
        setCode('');
      }
    } finally {
      setIsLoading(false);
    }
  }, [code, persistPairing, submitTelemetryEvent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length >= 6) {
      void handlePair();
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pairToken = params.get('pairToken');
    const pairCode = params.get('pairCode');

    if (!pairToken && !pairCode) {
      setIsAutoPairing(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setErrorMsg('');
      setIsLoading(true);

      try {
        // Auto-pair via código (QR Code do admin) ou via token (recovery link)
        const result = pairCode
          ? await api.pairDevice(pairCode)
          : await api.pairDeviceByToken(pairToken!);

        if (cancelled) return;

        if (result.success) {
          persistPairing({
            deviceToken: result.data.deviceToken,
            deviceSecret: result.data.deviceSecret,
            device: result.data.device,
          });
          setPaired(result.data.device);
          window.history.replaceState({}, '', '/');
          void submitTelemetryEvent({
            deviceToken: result.data.deviceToken,
            eventType: 'PLAYER_STARTED',
            severity: 'INFO',
            occurredAt: new Date().toISOString(),
          });
          return;
        }

        setErrorMsg('userMessage' in result ? result.userMessage : 'Falha ao parear dispositivo.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsAutoPairing(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [persistPairing, submitTelemetryEvent]);

  React.useEffect(() => {
    if (paired) return;

    const storedToken = localStorage.getItem(DEVICE_TOKEN_KEY);
    const storedDeviceRaw = localStorage.getItem(PAIRED_DEVICE_KEY);
    if (!storedToken || !storedDeviceRaw) {
      setIsAutoPairing(false);
      return;
    }

    try {
      const storedDevice = JSON.parse(storedDeviceRaw) as PairedDevice;
      if (storedDevice?.id && storedDevice?.name) {
        setPaired(storedDevice);
      }
    } catch {
      localStorage.removeItem(PAIRED_DEVICE_KEY);
    } finally {
      setIsAutoPairing(false);
      setIsLoading(false);
    }
  }, [paired]);

  React.useEffect(() => {
    if (!paired) return;

    let cancelled = false;

    const tick = async () => {
      const deviceToken = localStorage.getItem('deviceToken');
      if (!deviceToken || cancelled) return;

      const occurredAt = new Date().toISOString();

      try {
        await flushTelemetryQueue();
        await flushPlayEventQueue();
        await flushHeartbeatQueue(deviceToken);
        await api.sendHeartbeat({
          deviceToken,
          occurredAt,
          playerStatus: playlistItems.length > 0 ? 'PLAYING' : 'WAITING_CONTENT',
          manifestVersion: manifestVersion ?? undefined,
          // Enriched telemetry (Phase 8)
          playerVersion: PLAYER_VERSION,
          uptimeMs: getUptimeMs(),
          memoryUsageMB: (performance as unknown as { memory?: { usedJSHeapSize?: number } })
            .memory?.usedJSHeapSize
            ? Math.round(((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1024 / 1024) * 10) / 10
            : undefined,
          cacheMode: getCacheMode(),
          isOffline: isOfflineMode(),
        });
      } catch (error) {
        if (isTokenInvalidError(error)) {
          clearPairing('A conexão desta tela expirou. Faça o pareamento novamente no painel.');
          return;
        }
        enqueueHeartbeat(occurredAt);
      }
    };

    void tick();
    const intervalId = setInterval(() => {
      void tick();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [paired, playlistItems.length, manifestVersion, clearPairing, enqueueHeartbeat, flushHeartbeatQueue, flushPlayEventQueue, flushTelemetryQueue]);

  React.useEffect(() => {
    if (!paired || !deviceProfile) return;

    let cancelled = false;

    const fetchManifest = async () => {
      const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
      if (!deviceToken || cancelled) return;

      try {
        const manifest = await api.getManifest(deviceToken);
        if (cancelled) return;

        const runtimeItems = await buildRuntimePlaybackItems(manifest, deviceProfile);

        setManifestSchemaVersion(manifest.manifestSchemaVersion);
        setManifestVersion(manifest.manifestVersion);
        setPlaylistItems(runtimeItems);

        const urlsToCache = runtimeItems.flatMap((item) => {
          const urls = [item.url];
          if (item.fallbackUrl) {
            urls.push(item.fallbackUrl);
          }
          return urls;
        });

        void precacheAssets(urlsToCache, {
          limit: deviceProfile.maxPreloadItems + 1,
        });

        const persisted = readPlaybackState();
        const nextStart = resolveStartingPlaybackIndex({
          manifest,
          items: runtimeItems,
          persisted,
        });

        restoreCurrentTimeRef.current = nextStart.restoreCurrentTimeSec;
        setCurrentStartedAt(
          persisted && runtimeItems[nextStart.index]?.assetId === persisted.assetId
            ? persisted.startedAt
            : null,
        );
        setCurrentIndex(nextStart.index);
        setPendingAdvance(false);

        const offlineNow = isOfflineMode();
        if (offlineNow !== previousOfflineModeRef.current) {
          previousOfflineModeRef.current = offlineNow;
          void submitTelemetryEvent({
            deviceToken,
            eventType: offlineNow ? 'NETWORK_DOWN' : 'NETWORK_RESTORED',
            severity: offlineNow ? 'WARNING' : 'INFO',
            occurredAt: new Date().toISOString(),
            metadata: {
              manifestSchemaVersion: manifest.manifestSchemaVersion,
              manifestVersion: manifest.manifestVersion,
              deviceTier: deviceProfile.tier,
            },
          });
        }

        if (runtimeItems.length === 0) {
          void submitTelemetryEvent({
            deviceToken,
            eventType: 'NO_CONTENT_UPDATE',
            severity: 'WARNING',
            occurredAt: new Date().toISOString(),
            metadata: {
              manifestSchemaVersion: manifest.manifestSchemaVersion,
              manifestVersion: manifest.manifestVersion,
            },
          });
        }
      } catch (error) {
        if (isTokenInvalidError(error)) {
          clearPairing('A conexão desta tela expirou. Faça o pareamento novamente no painel.');
        }
        // best-effort polling
      } finally {
        if (!cancelled) {
          setHasResolvedManifestOnce(true);
        }
      }
    };

    void fetchManifest();
    const intervalId = setInterval(() => {
      void fetchManifest();
    }, MANIFEST_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [paired, deviceProfile, clearPairing, readPlaybackState, submitTelemetryEvent]);

  const currentItem = playlistItems.length > 0 ? playlistItems[currentIndex] : null;
  const nextItem = playlistItems.length > 1
    ? playlistItems[(currentIndex + 1) % playlistItems.length]
    : null;

  React.useEffect(() => {
    if (!currentItem || hasInitialPlaybackStarted) return;
    if (currentItem.mediaType !== 'IMAGE') return;

    const timeoutId = setTimeout(() => {
      setHasInitialPlaybackStarted(true);
    }, 320);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentItem, hasInitialPlaybackStarted]);

  const advanceToNextItem = React.useCallback(() => {
    if (playlistItems.length === 0) return;
    restoreCurrentTimeRef.current = null;
    writePlaybackState(null);
    setPendingAdvance(false);
    setNextReadyPlaybackKey(null);
    setCurrentIndex((prev) => (prev + 1) % playlistItems.length);
  }, [playlistItems.length, writePlaybackState]);

  const goToNextItem = React.useCallback(() => {
    if (playlistItems.length === 0) return;

    if (!nextItem || nextReadyPlaybackKey === nextItem.playbackKey) {
      advanceToNextItem();
      return;
    }

    setPendingAdvance(true);
  }, [advanceToNextItem, nextItem, nextReadyPlaybackKey, playlistItems.length]);

  React.useEffect(() => {
    if (!pendingAdvance || !nextItem) return;
    if (nextReadyPlaybackKey !== nextItem.playbackKey) return;

    advanceToNextItem();
  }, [advanceToNextItem, nextItem, nextReadyPlaybackKey, pendingAdvance]);

  const submitPlayEvent = React.useCallback(async (item: RuntimePlaybackItem, startedAt: string, endedAt: string, durationMs: number) => {
    const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!deviceToken) return;

    const playId = `${item.assetId}:${Date.now()}`;
    const deviceSecret = localStorage.getItem(DEVICE_SECRET_KEY) ?? '';
    const signature = await signPlayPayload(
      deviceSecret,
      `${playId}:${startedAt}:${endedAt}:${durationMs}`,
    );

    const payload: QueuedPlayEvent = {
      deviceToken,
      playId,
      campaignId: item.campaignId,
      assetId: item.assetId,
      startedAt,
      endedAt,
      durationMs,
      manifestVersion: manifestVersion ?? undefined,
      assetHash: item.assetHash ?? undefined,
      hmacSignature: signature,
    };

    const result = await api.sendPlayEvent(payload);
    if (!result.success) {
      enqueuePlayEvent(payload);
    }
  }, [enqueuePlayEvent, manifestVersion]);

  const switchCurrentItemToFallback = React.useCallback(() => {
    if (!currentItem?.fallbackUrl || currentItem.fallbackUrl === currentItem.url) {
      return false;
    }

    setPlaylistItems((prev) => prev.map((item, index) => {
      if (index !== currentIndex) return item;

      return {
        ...item,
        url: currentItem.fallbackUrl!,
        playbackKey: `${item.assetId}:${currentItem.fallbackVariantId ?? item.selectedVariantId}:fallback`,
        selectedVariantId: currentItem.fallbackVariantId ?? item.selectedVariantId,
        selectedVariantDelivery: currentItem.fallbackUrl?.includes('.m3u8') ? 'HLS' : item.selectedVariantDelivery,
        queueState: 'FALLBACK_READY',
      };
    }));

    const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (deviceToken) {
      void submitTelemetryEvent({
        deviceToken,
        eventType: 'DOWNLOAD_FAILED',
        severity: 'WARNING',
        occurredAt: new Date().toISOString(),
        metadata: {
          assetId: currentItem.assetId,
          fallbackVariantId: currentItem.fallbackVariantId,
          manifestVersion,
          manifestSchemaVersion,
        },
      });
    }

    return true;
  }, [currentIndex, currentItem, manifestSchemaVersion, manifestVersion, submitTelemetryEvent]);

  const completeCurrentVideo = React.useCallback(() => {
    if (!currentItem || currentItem.mediaType !== 'VIDEO') return;

    const completionKey = `${currentItem.playbackKey}:${currentIndex}`;
    if (videoCompletedKeyRef.current === completionKey) {
      return;
    }
    videoCompletedKeyRef.current = completionKey;

    if (videoFallbackTimeoutRef.current) {
      clearTimeout(videoFallbackTimeoutRef.current);
      videoFallbackTimeoutRef.current = null;
    }

    const endedAt = new Date().toISOString();
    const startedAt = currentStartedAt ?? new Date(Date.now() - currentItem.durationMs).toISOString();
    const durationMs = Math.max(1000, new Date(endedAt).getTime() - new Date(startedAt).getTime());

    void submitPlayEvent(currentItem, startedAt, endedAt, durationMs);

    goToNextItem();
  }, [currentItem, currentIndex, currentStartedAt, goToNextItem, submitPlayEvent]);

  React.useEffect(() => {
    if (!paired || !currentItem || currentItem.mediaType !== 'IMAGE') return;

    const persisted = readPlaybackState();
    const now = Date.now();
    const startedAt =
      persisted?.assetId === currentItem.assetId && persisted.mediaType === 'IMAGE'
        ? persisted.startedAt
        : new Date(now).toISOString();

    const elapsedMs = Math.max(0, now - new Date(startedAt).getTime());
    const remainingMs = Math.max(0, currentItem.durationMs - elapsedMs);

    setCurrentStartedAt(startedAt);
    writePlaybackState({
      assetId: currentItem.assetId,
      mediaType: 'IMAGE',
      startedAt,
      manifestVersion,
      updatedAt: new Date().toISOString(),
    });

    const timeoutId = setTimeout(() => {
      const endedAt = new Date().toISOString();
      void submitPlayEvent(currentItem, startedAt, endedAt, currentItem.durationMs);

      goToNextItem();
    }, remainingMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [paired, currentItem, goToNextItem, readPlaybackState, submitPlayEvent, writePlaybackState]);

  const handleVideoStart = React.useCallback(() => {
    const startedAt = new Date().toISOString();
    setCurrentStartedAt(startedAt);
    setHasInitialPlaybackStarted(true);

    if (!currentItem || currentItem.mediaType !== 'VIDEO') return;

    writePlaybackState({
      assetId: currentItem.assetId,
      mediaType: 'VIDEO',
      startedAt,
      currentTimeSec: 0,
      manifestVersion,
      updatedAt: startedAt,
    });
  }, [currentItem, manifestVersion, writePlaybackState]);

  const handleVideoTimeUpdate = React.useCallback(() => {
    if (!currentItem || currentItem.mediaType !== 'VIDEO') return;

    const now = Date.now();
    if (now - lastProgressPersistAtRef.current < 1000) return;
    lastProgressPersistAtRef.current = now;

    const elapsedSec = currentStartedAt
      ? Math.max(0, (now - new Date(currentStartedAt).getTime()) / 1000)
      : 0;

    writePlaybackState({
      assetId: currentItem.assetId,
      mediaType: 'VIDEO',
      startedAt: currentStartedAt ?? new Date(now).toISOString(),
      currentTimeSec: elapsedSec,
      manifestVersion,
      updatedAt: new Date(now).toISOString(),
    });
  }, [currentItem, currentStartedAt, manifestVersion, writePlaybackState]);

  const handleVideoEnd = React.useCallback(() => {
    completeCurrentVideo();
  }, [completeCurrentVideo]);

  const handlePlaybackError = React.useCallback(() => {
    if (switchCurrentItemToFallback()) {
      return;
    }

    goToNextItem();
  }, [goToNextItem, switchCurrentItemToFallback]);

  React.useEffect(() => {
    if (!paired || !currentItem || currentItem.mediaType !== 'VIDEO') {
      if (videoFallbackTimeoutRef.current) {
        clearTimeout(videoFallbackTimeoutRef.current);
        videoFallbackTimeoutRef.current = null;
      }
      return;
    }

    videoCompletedKeyRef.current = null;

    const fallbackMs = Math.max(2000, currentItem.durationMs + 1500);
    videoFallbackTimeoutRef.current = setTimeout(() => {
      handlePlaybackError();
    }, fallbackMs);

    return () => {
      if (videoFallbackTimeoutRef.current) {
        clearTimeout(videoFallbackTimeoutRef.current);
        videoFallbackTimeoutRef.current = null;
      }
    };
  }, [paired, currentItem, handlePlaybackError]);

  // ── Watchdog: monitor playback health ────────────────────────────
  React.useEffect(() => {
    if (!paired || !currentItem) {
      watchdogRef.current?.stop();
      return;
    }

    if (!watchdogRef.current) {
      watchdogRef.current = new PlaybackWatchdog({
        onSkip: () => goToNextItem(),
        onReload: () => window.location.reload(),
      });
    }

    if (currentItem.mediaType === 'VIDEO') {
      watchdogRef.current.watch(videoElRef.current, currentItem.durationMs);
    } else {
      watchdogRef.current.watchImage(currentItem.durationMs);
    }

    return () => {
      watchdogRef.current?.stop();
    };
  }, [paired, currentItem, goToNextItem]);

  // ── Tela pós-pareamento ─────────────────────────────────────────────
  if (paired) {
    const startupStage: 'runtime' | 'manifest' | 'render' | null = !deviceProfile
      ? 'runtime'
      : !hasResolvedManifestOnce
        ? 'manifest'
        : currentItem && !hasInitialPlaybackStarted
          ? 'render'
          : null;

    if (currentItem) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-black">
          <DualMediaPlayer
            currentItem={currentItem}
            nextItem={nextItem}
            currentIndex={currentIndex}
            startAt={restoreCurrentTimeRef.current}
            onPlay={handleVideoStart}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnd}
            onError={handlePlaybackError}
            onNextReadyChange={({ playbackKey, ready }) => {
              setNextReadyPlaybackKey(ready ? playbackKey : null);
            }}
            videoElRef={videoElRef as React.MutableRefObject<HTMLVideoElement | null>}
          />

          <PlaybackOverlay
            currentIndex={currentIndex}
            totalItems={playlistItems.length}
            mediaType={currentItem.mediaType}
            isOffline={isOfflineMode()}
          />

          {startupStage ? (
            <PlayerStartupScreen
              stage={startupStage}
              deviceName={paired.name}
              workspaceName={paired.workspaceName}
              locationName={paired.locationName}
              isOffline={isOfflineMode()}
            />
          ) : null}
        </main>
      );
    }

    if (startupStage === 'runtime' || startupStage === 'manifest') {
      return (
        <main className="relative min-h-screen overflow-hidden bg-black">
          <PlayerStartupScreen
            stage={startupStage}
            deviceName={paired.name}
            workspaceName={paired.workspaceName}
            locationName={paired.locationName}
            isOffline={isOfflineMode()}
          />
        </main>
      );
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black p-8 text-white">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 ring-2 ring-green-500/30">
            <svg className="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-green-400">Pareado com sucesso!</h1>
            <p className="mt-2 text-gray-400">Este dispositivo está conectado e aguardando conteúdo.</p>
          </div>

          <div className="w-full rounded-2xl border border-gray-800 bg-gray-900/60 p-6 text-left space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Tela</p>
              <p className="font-semibold text-white">{paired.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Local</p>
              <p className="font-semibold text-white">{paired.locationName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Workspace</p>
              <p className="font-semibold text-white">{paired.workspaceName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Orientação</p>
              <p className="font-semibold text-white">{paired.orientation === 'HORIZONTAL' ? 'Horizontal' : 'Vertical'}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600">Aguardando programação publicada para esta tela...</p>
        </div>
      </main>
    );
  }

  // ── Tela de Pareamento ──────────────────────────────────────────────
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black p-8 text-white">
      <div className="flex w-full max-w-4xl flex-col items-center gap-12 text-center md:flex-row md:items-stretch md:justify-center md:text-left">

        {/* Painel Esquerdo: Instruções e preenchimento */}
        <div className="flex flex-1 flex-col justify-center max-w-md">
          <h1 className="text-4xl font-bold tracking-tight">Telumi Player</h1>
          <p className="mt-2 text-xl text-gray-400">
            {isAutoPairing ? 'Reconectando tela...' : 'Aguardando pareamento.'}
          </p>

          <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-900/50 p-6 shadow-2xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
              Digite o código gerado no painel
            </p>

            <div className="flex justify-center md:justify-start">
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setErrorMsg('');
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                }}
                onKeyDown={handleKeyDown}
                placeholder="XXXXXX"
                className="w-full max-w-[280px] rounded-lg border border-gray-700 bg-black px-6 py-4 text-center font-mono text-3xl font-bold tracking-[0.3em] text-white placeholder:text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                disabled={isLoading}
              />
            </div>

            {errorMsg && (
              <p className="mt-3 text-sm text-red-400 text-center">{errorMsg}</p>
            )}

            <div className="flex justify-center md:justify-start">
              <button
                disabled={code.length < 6 || isLoading}
                onClick={() => void handlePair()}
                className="mt-6 w-full max-w-[280px] flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-4 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Pareando...
                  </>
                ) : (
                  'Parear Tela'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Linha Divisória */}
        <div className="hidden w-px bg-gray-800 md:block" />

        {/* Painel Direito: QR Code */}
        <div className="flex flex-1 flex-col items-center justify-center max-w-sm rounded-2xl border border-gray-800 bg-gray-900/50 p-8 shadow-2xl">
          <p className="mb-6 text-center text-sm text-gray-400">
            Prefere usar o celular?<br />
            Escaneie o código para acessar o painel e gerar o código de conexão.
          </p>
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={adminUrl} size={200} />
          </div>
          <p className="mt-4 text-xs text-gray-600 font-mono text-center break-all">
            {adminUrl}
          </p>
        </div>

      </div>
    </main>
  );
}
