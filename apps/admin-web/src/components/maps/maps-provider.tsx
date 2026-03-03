'use client';

import * as React from 'react';
import { useJsApiLoader, type Libraries } from '@react-google-maps/api';
import { Skeleton } from '@/components/ui/skeleton';

const GOOGLE_MAPS_LIBRARIES: Libraries = ['places'];
const GOOGLE_MAPS_SCRIPT_ID = 'telumi-google-maps-script';

type MapsContextValue = {
  isLoaded: boolean;
};

const MapsContext = React.createContext<MapsContextValue | null>(null);

export type MapsProviderErrorKind =
  | 'missing-key'
  | 'api-not-activated'
  | 'quota-exceeded'
  | 'generic';

type MapsProviderProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (kind: MapsProviderErrorKind, message: string) => void;
};

function getErrorKind(message: string): MapsProviderErrorKind {
  const normalized = message.toLowerCase();

  if (normalized.includes('apinotactivatedmaperror')) {
    return 'api-not-activated';
  }

  if (normalized.includes('quota') || normalized.includes('over_query_limit')) {
    return 'quota-exceeded';
  }

  return 'generic';
}

export function MapsProvider({ children, fallback, onError }: MapsProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const hasApiKey = apiKey.length > 0;

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const hasNotifiedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasNotifiedRef.current) return;

    if (!hasApiKey) {
      hasNotifiedRef.current = true;
      onError?.('missing-key', 'Chave do Google Maps não configurada.');
      return;
    }

    if (loadError) {
      hasNotifiedRef.current = true;
      const kind = getErrorKind(loadError.message);
      onError?.(kind, loadError.message);
    }
  }, [hasApiKey, loadError, onError]);

  if (!hasApiKey || loadError) {
    return <>{fallback ?? null}</>;
  }

  if (!isLoaded) {
    return (
      <>
        {fallback ?? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[240px] w-full" />
          </div>
        )}
      </>
    );
  }

  return <MapsContext.Provider value={{ isLoaded }}>{children}</MapsContext.Provider>;
}

export function useMapsContext() {
  const context = React.useContext(MapsContext);

  if (!context) {
    throw new Error('useMapsContext deve ser usado dentro de MapsProvider.');
  }

  return context;
}
