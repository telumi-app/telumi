'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, ApiRequestError } from '@/lib/api';

const HEARTBEAT_QUEUE_KEY = 'telumi:heartbeat-queue';
const DEVICE_TOKEN_KEY = 'deviceToken';
const DEVICE_SECRET_KEY = 'deviceSecret';
const PAIRED_DEVICE_KEY = 'telumi:paired-device';
const HEARTBEAT_INTERVAL_MS = 15000;
const MANIFEST_POLL_INTERVAL_MS = 15000;

type PairedDevice = {
  id: string;
  name: string;
  workspaceName: string;
  locationName: string;
  orientation: string;
};

function isTokenInvalidError(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.statusCode === 400 || error.statusCode === 404);
}

export default function PlayerHome() {
  const [code, setCode] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [paired, setPaired] = React.useState<PairedDevice | null>(null);
  const [manifestVersion, setManifestVersion] = React.useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = React.useState<Array<{
    assetId: string;
    campaignId?: string;
    mediaType: 'IMAGE' | 'VIDEO';
    durationMs: number;
    url: string;
  }>>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [currentStartedAt, setCurrentStartedAt] = React.useState<string | null>(null);
  const videoFallbackTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoCompletedKeyRef = React.useRef<string | null>(null);
    const readHeartbeatQueue = () => {
      try {
        const raw = localStorage.getItem(HEARTBEAT_QUEUE_KEY);
        if (!raw) return [] as Array<{ occurredAt: string }>;
        const parsed = JSON.parse(raw) as Array<{ occurredAt: string }>;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [] as Array<{ occurredAt: string }>;
      }
    };

    const writeHeartbeatQueue = (items: Array<{ occurredAt: string }>) => {
      localStorage.setItem(HEARTBEAT_QUEUE_KEY, JSON.stringify(items.slice(-100)));
    };

    const enqueueHeartbeat = (occurredAt: string) => {
      const queue = readHeartbeatQueue();
      queue.push({ occurredAt });
      writeHeartbeatQueue(queue);
    };

    const flushHeartbeatQueue = async (deviceToken: string) => {
      const queue = readHeartbeatQueue();
      if (queue.length === 0) return;

      const pending = [...queue];
      while (pending.length > 0) {
        const item = pending[0];
        await api.sendHeartbeat({
          deviceToken,
          occurredAt: item.occurredAt,
          playerStatus: 'PLAYING',
        });
        pending.shift();
        writeHeartbeatQueue(pending);
      }
    };

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
    setManifestVersion(null);
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
        void api.sendTelemetryEvent({
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
  }, [code, persistPairing]);

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
          void api.sendTelemetryEvent({
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
  }, [persistPairing]);

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
        await flushHeartbeatQueue(deviceToken);
        await api.sendHeartbeat({
          deviceToken,
          occurredAt,
          playerStatus: playlistItems.length > 0 ? 'PLAYING' : 'WAITING_CONTENT',
          manifestVersion: manifestVersion ?? undefined,
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
  }, [paired, playlistItems.length, manifestVersion]);

  React.useEffect(() => {
    if (!paired) return;

    let cancelled = false;

    const fetchManifest = async () => {
      const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
      if (!deviceToken || cancelled) return;

      try {
        const manifest = await api.getManifest(deviceToken);
        if (cancelled) return;

        setManifestVersion(manifest.manifestVersion);
        setPlaylistItems(manifest.items);
        setCurrentIndex((prev) => {
          if (manifest.items.length === 0) return 0;
          return prev >= manifest.items.length ? 0 : prev;
        });
      } catch (error) {
        if (isTokenInvalidError(error)) {
          clearPairing('A conexão desta tela expirou. Faça o pareamento novamente no painel.');
        }
        // best-effort polling
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
  }, [paired, clearPairing]);

  const currentItem = playlistItems.length > 0 ? playlistItems[currentIndex] : null;

  const goToNextItem = React.useCallback(() => {
    if (playlistItems.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % playlistItems.length);
  }, [playlistItems.length]);

  const completeCurrentVideo = React.useCallback(() => {
    if (!currentItem || currentItem.mediaType !== 'VIDEO') return;

    const completionKey = `${currentItem.assetId}:${currentIndex}`;
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
    const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);

    if (deviceToken) {
      void api.sendPlayEvent({
        deviceToken,
        playId: `${currentItem.assetId}:${Date.now()}`,
        campaignId: currentItem.campaignId,
        assetId: currentItem.assetId,
        startedAt,
        endedAt,
        durationMs: Math.max(1000, new Date(endedAt).getTime() - new Date(startedAt).getTime()),
        manifestVersion: manifestVersion ?? undefined,
      });
    }

    goToNextItem();
  }, [currentItem, currentIndex, currentStartedAt, goToNextItem, manifestVersion]);

  React.useEffect(() => {
    if (!paired || !currentItem || currentItem.mediaType !== 'IMAGE') return;

    const startedAt = new Date().toISOString();
    setCurrentStartedAt(startedAt);

    const timeoutId = setTimeout(() => {
      const endedAt = new Date().toISOString();
      const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);

      if (deviceToken) {
        void api.sendPlayEvent({
          deviceToken,
          playId: `${currentItem.assetId}:${Date.now()}`,
          campaignId: currentItem.campaignId,
          assetId: currentItem.assetId,
          startedAt,
          endedAt,
          durationMs: currentItem.durationMs,
          manifestVersion: manifestVersion ?? undefined,
        });
      }

      goToNextItem();
    }, currentItem.durationMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [paired, currentItem, goToNextItem, manifestVersion]);

  const handleVideoStart = React.useCallback(() => {
    setCurrentStartedAt(new Date().toISOString());
  }, []);

  const handleVideoEnd = React.useCallback(() => {
    completeCurrentVideo();
  }, [completeCurrentVideo]);

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
      completeCurrentVideo();
    }, fallbackMs);

    return () => {
      if (videoFallbackTimeoutRef.current) {
        clearTimeout(videoFallbackTimeoutRef.current);
        videoFallbackTimeoutRef.current = null;
      }
    };
  }, [paired, currentItem, completeCurrentVideo]);

  // ── Tela pós-pareamento ─────────────────────────────────────────────
  if (paired) {
    if (currentItem) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-black">
          {currentItem.mediaType === 'IMAGE' ? (
            <img
              src={currentItem.url}
              alt="Mídia da campanha"
              className="h-screen w-screen object-contain"
            />
          ) : (
            <video
              key={`${currentItem.assetId}-${currentIndex}`}
              src={currentItem.url}
              className="h-screen w-screen object-contain"
              autoPlay
              muted
              playsInline
              loop={false}
              onPlay={handleVideoStart}
              onEnded={handleVideoEnd}
              onError={handleVideoEnd}
            />
          )}

          <div className="pointer-events-none absolute bottom-4 right-4 rounded-md bg-black/55 px-3 py-2 text-xs text-white/80">
            {currentIndex + 1}/{playlistItems.length} · {currentItem.mediaType === 'VIDEO' ? 'vídeo' : 'imagem'}
          </div>
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
