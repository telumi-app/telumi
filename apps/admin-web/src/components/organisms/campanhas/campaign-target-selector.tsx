'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

import type { Device } from '@/lib/api/devices';

type CampaignTargetSelectorProps = {
  devices: Device[];
  selectedDeviceIds: string[];
  onChange: (deviceIds: string[]) => void;
};

export function CampaignTargetSelector({
  devices,
  selectedDeviceIds,
  onChange,
}: CampaignTargetSelectorProps) {
  const selectedSet = React.useMemo(() => new Set(selectedDeviceIds), [selectedDeviceIds]);

  const groupedByLocation = React.useMemo(() => {
    const map = new Map<string, Device[]>();
    for (const device of devices) {
      const key = `${device.locationId}::${device.locationName}`;
      map.set(key, [...(map.get(key) ?? []), device]);
    }
    return Array.from(map.entries()).map(([key, value]) => {
      const [locationId, locationName] = key.split('::');
      return { locationId, locationName, devices: value };
    });
  }, [devices]);

  const toggleDevice = (deviceId: string) => {
    const next = new Set(selectedSet);
    if (next.has(deviceId)) next.delete(deviceId);
    else next.add(deviceId);
    onChange(Array.from(next));
  };

  const toggleLocation = (deviceIds: string[]) => {
    const next = new Set(selectedSet);
    const allSelected = deviceIds.every((id) => next.has(id));

    if (allSelected) {
      for (const deviceId of deviceIds) next.delete(deviceId);
    } else {
      for (const deviceId of deviceIds) next.add(deviceId);
    }

    onChange(Array.from(next));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Telas alvo</p>
        <Badge variant="secondary">
          {selectedDeviceIds.length} selecionada{selectedDeviceIds.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {groupedByLocation.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          Nenhuma tela elegível encontrada (ACTIVE + ONLINE/UNSTABLE).
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedByLocation.map((group) => {
            const ids = group.devices.map((d) => d.id);
            const allSelected = ids.every((id) => selectedSet.has(id));

            return (
              <Card key={group.locationId} className="space-y-3 p-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => toggleLocation(ids)}
                    />
                    {group.locationName}
                  </label>
                  <Badge variant="outline">{group.devices.length} telas</Badge>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {group.devices.map((device) => {
                    const checked = selectedSet.has(device.id);
                    return (
                      <label
                        key={device.id}
                        className="flex cursor-pointer items-start gap-2 rounded-md border p-2"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleDevice(device.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{device.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {device.status} · {device.resolution}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
