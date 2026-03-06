'use client';

export type DeviceTier = 'LOW' | 'MEDIUM' | 'HIGH';

export type DeviceProfile = {
  tier: DeviceTier;
  supportsNativeHls: boolean;
  prefersHlsPlayback: boolean;
  maxPreloadItems: number;
  maxResolution: '720p' | '1080p' | '4k';
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  userAgent: string;
};

function detectNativeHlsSupport(): boolean {
  if (typeof document === 'undefined') return false;

  const video = document.createElement('video');
  return [
    'application/vnd.apple.mpegurl',
    'application/x-mpegURL',
  ].some((mime) => video.canPlayType(mime) !== '');
}

function resolveTier(params: {
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  maxDimension: number;
}): DeviceTier {
  const { deviceMemoryGb, hardwareConcurrency, maxDimension } = params;

  if ((deviceMemoryGb != null && deviceMemoryGb <= 2) || (hardwareConcurrency != null && hardwareConcurrency <= 2) || maxDimension <= 1280) {
    return 'LOW';
  }

  if ((deviceMemoryGb != null && deviceMemoryGb >= 8) || (hardwareConcurrency != null && hardwareConcurrency >= 8) || maxDimension >= 2560) {
    return 'HIGH';
  }

  return 'MEDIUM';
}

export function detectDeviceProfile(): DeviceProfile {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      tier: 'MEDIUM',
      supportsNativeHls: false,
      prefersHlsPlayback: false,
      maxPreloadItems: 2,
      maxResolution: '1080p',
      deviceMemoryGb: null,
      hardwareConcurrency: null,
      userAgent: 'unknown',
    };
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
  };

  const maxDimension = Math.max(window.screen.width || 0, window.screen.height || 0);
  const deviceMemoryGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  const hardwareConcurrency = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null;
  const tier = resolveTier({ deviceMemoryGb, hardwareConcurrency, maxDimension });
  const supportsNativeHls = detectNativeHlsSupport();

  return {
    tier,
    supportsNativeHls,
    prefersHlsPlayback: supportsNativeHls && tier === 'LOW',
    maxPreloadItems: tier === 'HIGH' ? 3 : tier === 'MEDIUM' ? 2 : 1,
    maxResolution: maxDimension >= 2560 ? '4k' : maxDimension >= 1920 ? '1080p' : '720p',
    deviceMemoryGb,
    hardwareConcurrency,
    userAgent: navigator.userAgent,
  };
}
