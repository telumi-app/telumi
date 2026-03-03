'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { useMapsContext } from './maps-provider';

import { Autocomplete } from '@react-google-maps/api';

export type SelectedLocationPlace = {
  formattedAddress: string;
  placeId: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
};

type LocationAutocompleteProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (place: SelectedLocationPlace) => void;
  placeholder?: string;
  inputClassName?: string;
};

export function LocationAutocomplete({
  value,
  onValueChange,
  onSelect,
  placeholder = 'Digite o endereço para localizar no mapa',
  inputClassName,
}: LocationAutocompleteProps) {
  const { isLoaded } = useMapsContext();
  const [autocomplete, setAutocomplete] = React.useState<google.maps.places.Autocomplete | null>(null);

  const onLoad = React.useCallback((autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  }, []);

  const onPlaceChanged = React.useCallback(() => {
    if (!autocomplete) return;

    const place = autocomplete.getPlace();
    const location = place.geometry?.location;

    if (!location) {
      // Caso o usuário aperte enter sem selecionar um lugar válido na lista
      return;
    }

    let city = '';
    let state = '';

    for (const component of place.address_components ?? []) {
      if (component.types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }

      if (component.types.includes('administrative_area_level_1')) {
        state = component.short_name;
      }
    }

    const formattedAddress = place.formatted_address ?? '';
    onValueChange(formattedAddress);

    onSelect({
      formattedAddress,
      placeId: place.place_id ?? '',
      lat: location.lat(),
      lng: location.lng(),
      city,
      state,
    });
  }, [autocomplete, onSelect, onValueChange]);

  if (!isLoaded) {
    return (
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder="Carregando mapa..."
        className={inputClassName}
        disabled
      />
    );
  }

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'br' },
        fields: ['formatted_address', 'geometry', 'place_id', 'address_components'],
      }}
    >
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className={inputClassName}
      />
    </Autocomplete>
  );
}
