import * as React from 'react';
import {
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

import type { CampaignTimelineItem } from '../timeline-types';

function normalizeOrder(items: CampaignTimelineItem[]): CampaignTimelineItem[] {
  return items.map((item, index) => ({
    ...item,
    order: index,
  }));
}

type UseTimelineReorderParams = {
  items: CampaignTimelineItem[];
  onChange: (items: CampaignTimelineItem[]) => void;
};

export function useTimelineReorder({ items, onChange }: UseTimelineReorderParams) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = React.useMemo(() => items.map((item) => item.id), [items]);

  const activeItem = React.useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [activeId, items],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    onChange(normalizeOrder(reordered));
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return {
    activeId,
    activeItem,
    collisionDetection: closestCenter,
    itemIds,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
