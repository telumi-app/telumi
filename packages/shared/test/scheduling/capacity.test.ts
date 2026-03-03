import { describe, expect, it } from 'vitest';

import {
  checkCapacity,
  checkCapacityBatch,
  computeMaxPlaysPerHour,
  type CapacityOccurrence,
} from '../../src/scheduling/capacity';
import { EFFECTIVE_CAPACITY } from '../../src/scheduling/constants';

describe('capacity', () => {
  describe('checkCapacity', () => {
    const hour = (h: number) => new Date(`2026-03-02T${String(h).padStart(2, '0')}:00:00Z`).getTime();

    it('retorna fits=true quando não há ocorrências existentes', () => {
      const candidate: CapacityOccurrence = {
        start: hour(9),
        end: hour(12),
        rate: 0.1,
      };
      const result = checkCapacity(candidate, []);
      expect(result.fits).toBe(true);
      expect(result.maxExistingRate).toBe(0);
      expect(result.slack).toBe(EFFECTIVE_CAPACITY);
    });

    it('retorna fits=true quando cabe junto com existente', () => {
      const candidate: CapacityOccurrence = {
        start: hour(9),
        end: hour(12),
        rate: 0.3,
      };
      const existing: CapacityOccurrence[] = [
        { start: hour(9), end: hour(12), rate: 0.3 },
      ];
      const result = checkCapacity(candidate, existing);
      expect(result.fits).toBe(true);
      expect(result.maxExistingRate).toBeCloseTo(0.3, 6);
    });

    it('retorna fits=false quando excede capacidade', () => {
      const candidate: CapacityOccurrence = {
        start: hour(9),
        end: hour(12),
        rate: 0.5,
      };
      const existing: CapacityOccurrence[] = [
        { start: hour(9), end: hour(12), rate: 0.5 },
      ];
      const result = checkCapacity(candidate, existing);
      expect(result.fits).toBe(false);
    });

    it('detecta overlap parcial por segmentação de eventos', () => {
      // Existente cobre 09-11, candidato 10-12
      // Intervalo 10-11 teria 0.7+0.3=1.0 > 0.95
      const candidate: CapacityOccurrence = {
        start: hour(10),
        end: hour(12),
        rate: 0.3,
      };
      const existing: CapacityOccurrence[] = [
        { start: hour(9), end: hour(11), rate: 0.7 },
      ];
      const result = checkCapacity(candidate, existing);
      expect(result.fits).toBe(false);
    });

    it('cabe quando existentes não sobrepõem com candidato', () => {
      const candidate: CapacityOccurrence = {
        start: hour(14),
        end: hour(16),
        rate: 0.5,
      };
      const existing: CapacityOccurrence[] = [
        { start: hour(9), end: hour(12), rate: 0.9 },
      ];
      const result = checkCapacity(candidate, existing);
      expect(result.fits).toBe(true);
    });

    it('cenário com 3 campanhas sobrepostas parcialmente', () => {
      // E1: 08-10 rate=0.3
      // E2: 09-11 rate=0.3
      // Candidato: 09-12 rate=0.35
      // Segmento 09-10: 0.3+0.3+0.35=0.95 ≤ 0.95 (cabe)
      const candidate: CapacityOccurrence = {
        start: hour(9),
        end: hour(12),
        rate: 0.35,
      };
      const existing: CapacityOccurrence[] = [
        { start: hour(8), end: hour(10), rate: 0.3 },
        { start: hour(9), end: hour(11), rate: 0.3 },
      ];
      const result = checkCapacity(candidate, existing);
      expect(result.fits).toBe(true);
    });

    it('cenário com 5 campanhas onde soma excede em um subintervalo', () => {
      // E1: 08-12 rate=0.2
      // E2: 09-11 rate=0.2
      // E3: 10-12 rate=0.2
      // E4: 10-11 rate=0.2
      // Candidato: 10-11 rate=0.2
      // No seg 10-11: 0.2+0.2+0.2+0.2+0.2 = 1.0 > 0.95
      const candidate: CapacityOccurrence = {
        start: hour(10),
        end: hour(11),
        rate: 0.2,
      };
      const existing: CapacityOccurrence[] = [
        { start: hour(8), end: hour(12), rate: 0.2 },
        { start: hour(9), end: hour(11), rate: 0.2 },
        { start: hour(10), end: hour(12), rate: 0.2 },
        { start: hour(10), end: hour(11), rate: 0.2 },
      ];
      const result = checkCapacity(candidate, existing);
      expect(result.fits).toBe(false);
      expect(result.maxExistingRate).toBeCloseTo(0.8, 6);
    });
  });

  describe('computeMaxPlaysPerHour', () => {
    it('calcula corretamente max plays', () => {
      // slack=0.5, duration=30s → floor(0.5*3600/30) = floor(60) = 60
      expect(computeMaxPlaysPerHour(0.5, 30)).toBe(60);
    });

    it('retorna 0 quando não há slack', () => {
      expect(computeMaxPlaysPerHour(0, 30)).toBe(0);
    });

    it('retorna 0 quando duration é 0', () => {
      expect(computeMaxPlaysPerHour(0.5, 0)).toBe(0);
    });

    it('calcula com slack pequeno', () => {
      // slack=0.1, duration=30s → floor(0.1*3600/30) = floor(12) = 12
      expect(computeMaxPlaysPerHour(0.1, 30)).toBe(12);
    });
  });

  describe('checkCapacityBatch', () => {
    const hour = (h: number) => new Date(`2026-03-02T${String(h).padStart(2, '0')}:00:00Z`).getTime();

    it('retorna allFit=true quando tudo cabe', () => {
      const candidates: CapacityOccurrence[] = [
        { start: hour(9), end: hour(12), rate: 0.1 },
        { start: hour(14), end: hour(16), rate: 0.1 },
      ];
      const result = checkCapacityBatch(candidates, [], 30);
      expect(result.allFit).toBe(true);
      expect(result.someFit).toBe(true);
    });

    it('retorna allFit=false quando uma não cabe', () => {
      const candidates: CapacityOccurrence[] = [
        { start: hour(9), end: hour(12), rate: 0.1 },
        { start: hour(14), end: hour(16), rate: 0.1 },
      ];
      const existing: CapacityOccurrence[] = [
        { start: hour(14), end: hour(16), rate: 0.9 },
      ];
      const result = checkCapacityBatch(candidates, existing, 30);
      expect(result.allFit).toBe(false);
      expect(result.someFit).toBe(true);
    });

    it('retorna someFit=false quando nenhuma cabe', () => {
      const candidates: CapacityOccurrence[] = [
        { start: hour(9), end: hour(12), rate: 0.5 },
      ];
      const existing: CapacityOccurrence[] = [
        { start: hour(9), end: hour(12), rate: 0.9 },
      ];
      const result = checkCapacityBatch(candidates, existing, 30);
      expect(result.allFit).toBe(false);
      expect(result.someFit).toBe(false);
    });
  });
});
