import { describe, expect, it } from 'vitest';

import {
  expandDateRange,
  expandOccurrences,
  localToUtc,
  parseTimeToMinutes,
  splitMidnightWindow,
} from '../../src/scheduling/windows';
import type { TimeWindow } from '../../src/scheduling/types';

describe('windows', () => {
  describe('parseTimeToMinutes', () => {
    it('converte "00:00" para 0', () => {
      expect(parseTimeToMinutes('00:00')).toBe(0);
    });
    it('converte "12:30" para 750', () => {
      expect(parseTimeToMinutes('12:30')).toBe(750);
    });
    it('converte "23:59" para 1439', () => {
      expect(parseTimeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('splitMidnightWindow', () => {
    it('não divide janela normal', () => {
      const w: TimeWindow = { startTime: '09:00', endTime: '12:00' };
      const result = splitMidnightWindow(w);
      expect(result).toHaveLength(1);
      expect(result[0].nextDay).toBe(false);
      expect(result[0].window).toEqual(w);
    });

    it('divide janela que cruza meia-noite', () => {
      const w: TimeWindow = { startTime: '22:00', endTime: '02:00' };
      const result = splitMidnightWindow(w);
      expect(result).toHaveLength(2);
      expect(result[0].window).toEqual({ startTime: '22:00', endTime: '23:59' });
      expect(result[0].nextDay).toBe(false);
      expect(result[1].window).toEqual({ startTime: '00:00', endTime: '02:00' });
      expect(result[1].nextDay).toBe(true);
    });
  });

  describe('localToUtc', () => {
    it('converte hora local de São Paulo para UTC (UTC-3)', () => {
      const result = localToUtc('2026-03-10', '09:00', 'America/Sao_Paulo');
      // 09:00 SP (UTC-3) = 12:00 UTC
      expect(result.toISOString()).toBe('2026-03-10T12:00:00.000Z');
    });

    it('converte hora local de UTC para UTC (identidade)', () => {
      const result = localToUtc('2026-03-10', '09:00', 'UTC');
      expect(result.toISOString()).toBe('2026-03-10T09:00:00.000Z');
    });

    it('converte hora local de New York EDT para UTC (UTC-4)', () => {
      // Em março 2026, NYC está em EDT (UTC-4)
      const result = localToUtc('2026-03-10', '09:00', 'America/New_York');
      expect(result.toISOString()).toBe('2026-03-10T13:00:00.000Z');
    });
  });

  describe('expandDateRange', () => {
    it('retorna datas no intervalo que caem nos dias selecionados', () => {
      // 2026-03-02 é segunda (1), 2026-03-08 é domingo (0)
      const dates = expandDateRange('2026-03-02', '2026-03-08', [1, 3, 5]);
      // seg=02, qua=04, sex=06
      expect(dates).toEqual(['2026-03-02', '2026-03-04', '2026-03-06']);
    });

    it('retorna vazio se nenhum dia cai no intervalo', () => {
      // 2026-03-02 é segunda (1)
      const dates = expandDateRange('2026-03-02', '2026-03-02', [0]); // domingo
      expect(dates).toEqual([]);
    });

    it('retorna todas as datas se todos os dias selecionados', () => {
      const dates = expandDateRange('2026-03-02', '2026-03-04', [0, 1, 2, 3, 4, 5, 6]);
      expect(dates).toEqual(['2026-03-02', '2026-03-03', '2026-03-04']);
    });
  });

  describe('expandOccurrences', () => {
    it('gera occurrences por tela x data x janela', () => {
      const occs = expandOccurrences({
        dates: ['2026-03-02', '2026-03-03'],
        windows: [{ startTime: '09:00', endTime: '12:00' }],
        screenIds: ['s1', 's2'],
        timezone: 'America/Sao_Paulo',
        playsPerHour: 12,
        timelineDurationSeconds: 30,
        rate: 0.1,
      });

      // 2 datas × 1 janela × 2 telas = 4 occurrences
      expect(occs).toHaveLength(4);

      // Verificar que todas as telas estão representadas
      const screens = new Set(occs.map((o) => o.screenId));
      expect(screens).toEqual(new Set(['s1', 's2']));

      // Verificar que todos têm o rate correto
      for (const occ of occs) {
        expect(occ.rate).toBe(0.1);
        expect(occ.playsPerHour).toBe(12);
        expect(occ.timelineDurationSeconds).toBe(30);
        expect(occ.startAtUtc).toBeInstanceOf(Date);
        expect(occ.endAtUtc).toBeInstanceOf(Date);
        expect(occ.endAtUtc.getTime()).toBeGreaterThan(occ.startAtUtc.getTime());
      }
    });

    it('divide janela que cruza meia-noite em 2 occurrences por tela', () => {
      const occs = expandOccurrences({
        dates: ['2026-03-02'],
        windows: [{ startTime: '22:00', endTime: '02:00' }],
        screenIds: ['s1'],
        timezone: 'UTC',
        playsPerHour: 12,
        timelineDurationSeconds: 30,
        rate: 0.1,
      });

      // 1 data × 1 janela dividida em 2 × 1 tela = 2
      expect(occs).toHaveLength(2);
    });
  });
});
