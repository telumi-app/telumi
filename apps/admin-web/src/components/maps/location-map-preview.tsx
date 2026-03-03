'use client';

import * as React from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useMapsContext } from './maps-provider';

type LocationMapPreviewProps = {
  lat: number;
  lng: number;
  className?: string;
};

export function LocationMapPreview({ lat, lng, className }: LocationMapPreviewProps) {
  const { isLoaded } = useMapsContext();

  const center = React.useMemo(
    () => ({ lat, lng }),
    [lat, lng],
  );

  if (!isLoaded) {
    return null;
  }

  return (
    <div className={className}>
      <div className="h-[240px] w-full overflow-hidden rounded-md border border-border/60">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={15}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
          }}
        >
          <Marker position={center} />
        </GoogleMap>
      </div>
    </div>
  );
}
