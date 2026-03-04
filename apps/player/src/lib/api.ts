function normalizeApiBaseUrl(rawUrl: string): string {
    const trimmedUrl = rawUrl.trim().replace(/\/$/, '');

    if (!trimmedUrl) {
        return 'http://localhost:3001';
    }

    if (trimmedUrl.includes('telumi-api-production.up.railway.app')) {
        return trimmedUrl.replace(
            'telumi-api-production.up.railway.app',
            'telumiapi-production.up.railway.app',
        );
    }

    if (trimmedUrl.endsWith('/v1')) {
        return trimmedUrl.slice(0, -3);
    }

    return trimmedUrl;
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
const API_URL_CANDIDATES = [`${API_BASE_URL}/v1`, API_BASE_URL];

async function fetchWithApiPrefixFallback(path: string, init: RequestInit): Promise<Response> {
    const [primaryUrl, fallbackUrl] = API_URL_CANDIDATES;
    const primaryResponse = await fetch(`${primaryUrl}${path}`, init);

    if (primaryResponse.status !== 404 || primaryUrl === fallbackUrl) {
        return primaryResponse;
    }

    return fetch(`${fallbackUrl}${path}`, init);
}

export class ApiRequestError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
    ) {
        super(message);
        this.name = 'ApiRequestError';
    }
}

export type PairDeviceData = {
    deviceToken: string;
    deviceSecret?: string;
    device: {
        id: string;
        name: string;
        workspaceName: string;
        locationName: string;
        orientation: string;
        resolution: string;
    };
};

export type PairDeviceResult =
    | { success: true; data: PairDeviceData }
    | { success: false; userMessage: string };

export type HeartbeatPayload = {
    deviceToken: string;
    occurredAt: string;
    playerStatus?: string;
    manifestVersion?: string;
};

export type ManifestItem = {
    assetId: string;
    campaignId?: string;
    mediaType: 'IMAGE' | 'VIDEO';
    durationMs: number;
    url: string;
};

export type PlaybackManifest = {
    manifestVersion: string | null;
    scheduleId: string | null;
    items: ManifestItem[];
};

function resolveErrorMessage(statusCode: number, serverMessage: string | string[]): string {
    const msg = Array.isArray(serverMessage) ? serverMessage.join(' ') : serverMessage;

    switch (statusCode) {
        case 400:
            if (msg.toLowerCase().includes('expirou')) {
                return 'Este código de pareamento expirou. Acesse o painel admin, vá em "Telas" e gere um novo código para esta tela.';
            }
            return 'O código informado é inválido. Verifique se digitou corretamente (6 caracteres) e tente novamente.';

        case 404:
            return 'Nenhuma tela encontrada com este código. Confirme o código exibido no painel admin e tente novamente.';

        case 422:
            return 'Formato de código inválido. O código de pareamento deve ter exatamente 6 caracteres.';

        case 429:
            return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';

        case 500:
        case 502:
        case 503:
            return 'O servidor está temporariamente indisponível. Aguarde alguns instantes e tente novamente.';

        default:
            return 'Ocorreu um erro inesperado ao realizar o pareamento. Tente novamente ou contate o suporte.';
    }
}

export const api = {
    async pairDevice(code: string): Promise<PairDeviceResult> {
        let response: Response;

        try {
            response = await fetchWithApiPrefixFallback('/devices/public/pair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
        } catch {
            return {
                success: false,
                userMessage:
                    'Não foi possível conectar ao servidor. Verifique se o dispositivo está conectado à rede e tente novamente.',
            };
        }

        if (response.ok) {
            const body = await response.json() as { success: boolean; data?: PairDeviceData };
            if (body.success && body.data) {
                return { success: true, data: body.data };
            }
        }

        let errorBody: { message?: string | string[]; statusCode?: number } = {};
        try {
            errorBody = await response.json() as typeof errorBody;
        } catch {
            // ignora falha de parse
        }

        const userMessage = resolveErrorMessage(
            errorBody.statusCode ?? response.status,
            errorBody.message ?? '',
        );

        return { success: false, userMessage };
    },

    async pairDeviceByToken(token: string): Promise<PairDeviceResult> {
        let response: Response;

        try {
            response = await fetchWithApiPrefixFallback('/devices/public/pair-by-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
        } catch {
            return {
                success: false,
                userMessage:
                    'Não foi possível conectar ao servidor. Verifique se o dispositivo está conectado à rede e tente novamente.',
            };
        }

        if (response.ok) {
            const body = await response.json() as { success: boolean; data?: PairDeviceData };
            if (body.success && body.data) {
                return { success: true, data: body.data };
            }
        }

        let errorBody: { message?: string | string[]; statusCode?: number } = {};
        try {
            errorBody = await response.json() as typeof errorBody;
        } catch {
            // ignora falha de parse
        }

        const statusCode = errorBody.statusCode ?? response.status;
        const rawMessage = Array.isArray(errorBody.message)
            ? errorBody.message.join(' ')
            : (errorBody.message ?? '');

        let userMessage = resolveErrorMessage(statusCode, rawMessage);

        if (statusCode === 404) {
            userMessage = 'Este link de recuperação é inválido ou já foi substituído. Gere um novo no painel admin.';
        }

        if (statusCode === 400 && rawMessage.toLowerCase().includes('token')) {
            userMessage = 'Token de recuperação inválido. Gere um novo link no painel admin e tente novamente.';
        }

        return { success: false, userMessage };
    },

    async sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
        const response = await fetchWithApiPrefixFallback('/devices/public/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new ApiRequestError('Falha ao enviar heartbeat.', response.status);
        }
    },

    async getManifest(deviceToken: string): Promise<PlaybackManifest> {
        const response = await fetchWithApiPrefixFallback('/devices/public/manifest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceToken }),
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new ApiRequestError('Falha ao obter manifesto de reprodução.', response.status);
        }

        const body = await response.json() as {
            success: boolean;
            data?: PlaybackManifest;
        };

        if (!body.success || !body.data) {
            throw new Error('Manifesto inválido.');
        }

        return body.data;
    },

    async sendTelemetryEvent(payload: {
        deviceToken: string;
        eventType: string;
        severity?: string;
        message?: string;
        metadata?: Record<string, unknown>;
        occurredAt: string;
    }): Promise<void> {
        try {
            await fetchWithApiPrefixFallback('/devices/public/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch {
            // Telemetry is best-effort — do not throw
        }
    },

    async sendPlayEvent(payload: {
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
    }): Promise<{ success: boolean; deduplicated?: boolean }> {
        try {
            const response = await fetchWithApiPrefixFallback('/devices/public/play-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                return { success: false };
            }

            const body = (await response.json()) as { success: boolean; data?: { deduplicated: boolean } };
            return { success: body.success, deduplicated: body.data?.deduplicated };
        } catch {
            return { success: false };
        }
    },
};
