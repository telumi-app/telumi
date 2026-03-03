// ─── Funções puras para timeline ────────────────────────────────────
import {
  POLICY_MAX_CREATIVE_SECONDS,
  POLICY_MAX_CREATIVES,
  POLICY_MAX_TIMELINE_SECONDS,
  POLICY_MIN_CREATIVE_SECONDS,
  POLICY_MIN_TIMELINE_SECONDS,
} from './constants';
import type { TimelineItem } from './types';

/**
 * Hash estável simples (FNV-1a de 64 bits em hex).
 * Usa apenas JS puro — sem dependência de `crypto`.
 * Para ambientes Node, o backend pode usar SHA-256 se preferir.
 */
function stableHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return hash.toString(16).padStart(16, '0');
}

/**
 * Calcula a duração total da timeline em segundos.
 * Função pura, determinística.
 */
export function computeTimelineDuration(items: TimelineItem[]): number {
  return items.reduce((sum, item) => sum + item.durationSeconds, 0);
}

/**
 * Calcula um hash estável da timeline.
 * Ordena pelo orderIndex e gera SHA-256 hex do array serializado.
 */
export function computeTimelineHash(items: TimelineItem[]): string {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  const payload = sorted.map((item) => ({
    c: item.creativeId,
    d: item.durationSeconds,
    i: item.orderIndex,
  }));
  return stableHash(JSON.stringify(payload));
}

/**
 * Calcula a taxa de ocupação (rate) da campanha.
 * rate = (timelineDurationSeconds * playsPerHour) / 3600
 * Invariante: 0 < rate <= CAPACITY_LIMIT
 */
export function computeRate(
  timelineDurationSeconds: number,
  playsPerHour: number,
): number {
  return (timelineDurationSeconds * playsPerHour) / 3600;
}

/** Resultado de validação da timeline */
export interface TimelineValidation {
  valid: boolean;
  durationSeconds: number;
  hash: string;
  errors: string[];
}

/**
 * Valida a timeline e retorna duração, hash e erros.
 * Função pura — usada no FE (preview) e no BE (autoridade).
 */
export function validateTimeline(items: TimelineItem[]): TimelineValidation {
  const errors: string[] = [];

  if (items.length === 0) {
    errors.push('EMPTY_TIMELINE');
  }

  if (items.length > POLICY_MAX_CREATIVES) {
    errors.push('TOO_MANY_CREATIVES');
  }

  for (const item of items) {
    if (item.durationSeconds < POLICY_MIN_CREATIVE_SECONDS) {
      errors.push(`CREATIVE_TOO_SHORT:${item.creativeId}`);
    }
    if (item.durationSeconds > POLICY_MAX_CREATIVE_SECONDS) {
      errors.push(`CREATIVE_TOO_LONG:${item.creativeId}`);
    }
  }

  const duration = computeTimelineDuration(items);

  if (items.length > 0 && duration < POLICY_MIN_TIMELINE_SECONDS) {
    errors.push('TIMELINE_TOO_SHORT');
  }
  if (duration > POLICY_MAX_TIMELINE_SECONDS) {
    errors.push('TIMELINE_TOO_LONG');
  }

  const hash = items.length > 0 ? computeTimelineHash(items) : '';

  return {
    valid: errors.length === 0,
    durationSeconds: duration,
    hash,
    errors,
  };
}
