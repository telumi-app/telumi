import { describe, expect, it } from 'vitest';

import {
  computeRate,
  computeTimelineDuration,
  computeTimelineHash,
  validateTimeline,
} from '../../src/scheduling/timeline';
import type { TimelineItem } from '../../src/scheduling/types';

describe('timeline', () => {
  const items: TimelineItem[] = [
    { creativeId: 'c1', durationSeconds: 10, orderIndex: 0 },
    { creativeId: 'c2', durationSeconds: 15, orderIndex: 1 },
    { creativeId: 'c3', durationSeconds: 5, orderIndex: 2 },
  ];

  describe('computeTimelineDuration', () => {
    it('soma corretamente as durações', () => {
      expect(computeTimelineDuration(items)).toBe(30);
    });

    it('retorna 0 para lista vazia', () => {
      expect(computeTimelineDuration([])).toBe(0);
    });

    it('funciona com 1 item', () => {
      expect(computeTimelineDuration([items[0]])).toBe(10);
    });
  });

  describe('computeTimelineHash', () => {
    it('gera hash estável (mesma entrada = mesmo hash)', () => {
      const hash1 = computeTimelineHash(items);
      const hash2 = computeTimelineHash(items);
      expect(hash1).toBe(hash2);
    });

    it('hash é independente da ordem dos itens no input (ordena por orderIndex)', () => {
      const shuffled = [items[2], items[0], items[1]];
      expect(computeTimelineHash(shuffled)).toBe(computeTimelineHash(items));
    });

    it('diferentes timelines geram hashes diferentes', () => {
      const otherItems: TimelineItem[] = [
        { creativeId: 'c1', durationSeconds: 20, orderIndex: 0 },
      ];
      expect(computeTimelineHash(items)).not.toBe(computeTimelineHash(otherItems));
    });
  });

  describe('computeRate', () => {
    it('calcula rate = (duration * pph) / 3600', () => {
      // 30s * 12 pph = 360 / 3600 = 0.1
      expect(computeRate(30, 12)).toBeCloseTo(0.1, 6);
    });

    it('rate=1.0 quando duration=60s e pph=60', () => {
      expect(computeRate(60, 60)).toBeCloseTo(1.0, 6);
    });

    it('rate=0.5 quando duration=30s e pph=60', () => {
      expect(computeRate(30, 60)).toBeCloseTo(0.5, 6);
    });
  });

  describe('validateTimeline', () => {
    it('retorna valid=true para timeline válida', () => {
      const result = validateTimeline(items);
      expect(result.valid).toBe(true);
      expect(result.durationSeconds).toBe(30);
      expect(result.hash).toBeTruthy();
      expect(result.errors).toEqual([]);
    });

    it('retorna valid=false para timeline vazia', () => {
      const result = validateTimeline([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('EMPTY_TIMELINE');
    });

    it('detecta creative muito curto (0s)', () => {
      const bad: TimelineItem[] = [
        { creativeId: 'bad', durationSeconds: 0, orderIndex: 0 },
      ];
      const result = validateTimeline(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.startsWith('CREATIVE_TOO_SHORT'))).toBe(true);
    });

    it('detecta creative muito longo (>300s)', () => {
      const bad: TimelineItem[] = [
        { creativeId: 'bad', durationSeconds: 301, orderIndex: 0 },
      ];
      const result = validateTimeline(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.startsWith('CREATIVE_TOO_LONG'))).toBe(true);
    });

    it('detecta timeline muito longa (>600s)', () => {
      const manyItems: TimelineItem[] = Array.from({ length: 7 }, (_, i) => ({
        creativeId: `c${i}`,
        durationSeconds: 100,
        orderIndex: i,
      }));
      const result = validateTimeline(manyItems);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TIMELINE_TOO_LONG');
    });

    it('detecta muitos criativos (>20)', () => {
      const manyItems: TimelineItem[] = Array.from({ length: 21 }, (_, i) => ({
        creativeId: `c${i}`,
        durationSeconds: 1,
        orderIndex: i,
      }));
      const result = validateTimeline(manyItems);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TOO_MANY_CREATIVES');
    });
  });
});
