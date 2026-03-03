// ─── Motor de capacidade (funções puras) ────────────────────────────
import { EFFECTIVE_CAPACITY } from './constants';

/**
 * Representação de uma ocorrência ativa (existente ou candidata).
 * Usa timestamps numéricos (ms) para eficiência.
 */
export interface CapacityOccurrence {
  start: number; // timestamp ms
  end: number;   // timestamp ms
  rate: number;
}

/**
 * Resultado da checagem de capacidade para UMA ocorrência candidata em UMA tela.
 */
export interface CapacityCheckResult {
  fits: boolean;
  maxExistingRate: number;
  slack: number;
  maxPlaysPerHour: number; // máximo plays/h que caberia
}

/**
 * Verifica se uma ocorrência candidata cabe na tela, dado o conjunto de
 * ocorrências existentes (incluindo holds ativos).
 *
 * Algoritmo por segmentação de eventos (event-point sweep):
 * 1. Coletar todos os pontos de início/fim (existing + candidato)
 * 2. Ordenar
 * 3. Para cada segmento [p[i], p[i+1]), somar rates ativos
 * 4. Se soma + candidato.rate > EFFECTIVE_CAPACITY → falha
 *
 * @returns CapacityCheckResult com dados de slack e sugestão
 */
export function checkCapacity(
  candidate: CapacityOccurrence,
  existing: CapacityOccurrence[],
  capacityLimit: number = EFFECTIVE_CAPACITY,
): CapacityCheckResult {
  // Filtrar apenas ocorrências que sobrepõem o candidato
  const overlapping = existing.filter(
    (e) => e.start < candidate.end && e.end > candidate.start,
  );

  if (overlapping.length === 0) {
    // Nenhuma ocorrência existente: cabe sempre
    return {
      fits: candidate.rate <= capacityLimit,
      maxExistingRate: 0,
      slack: capacityLimit,
      maxPlaysPerHour: Infinity, // sem restrição prática
    };
  }

  // Coletar event points
  const points = new Set<number>();
  points.add(candidate.start);
  points.add(candidate.end);
  for (const e of overlapping) {
    if (e.start >= candidate.start && e.start < candidate.end) points.add(e.start);
    if (e.end > candidate.start && e.end <= candidate.end) points.add(e.end);
  }

  const sorted = [...points].sort((a, b) => a - b);

  let maxExistingRate = 0;
  let fits = true;

  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = sorted[i];
    const segEnd = sorted[i + 1];

    // Somar rates de todas as existentes que cobrem este segmento
    let segRate = 0;
    for (const e of overlapping) {
      if (e.start <= segStart && e.end >= segEnd) {
        segRate += e.rate;
      }
    }

    maxExistingRate = Math.max(maxExistingRate, segRate);

    if (segRate + candidate.rate > capacityLimit + 1e-9) {
      // epsilon para evitar floating point
      fits = false;
    }
  }

  const slack = Math.max(0, capacityLimit - maxExistingRate);

  return {
    fits,
    maxExistingRate,
    slack,
    maxPlaysPerHour: 0, // calculado externamente com timelineDuration
  };
}

/**
 * Calcula o máximo de plays_per_hour que caberia para uma tela/intervalo.
 * max_plays = floor((slack * 3600) / timelineDurationSeconds)
 * Clamp: >= 0
 */
export function computeMaxPlaysPerHour(
  slack: number,
  timelineDurationSeconds: number,
): number {
  if (timelineDurationSeconds <= 0) return 0;
  return Math.max(0, Math.floor((slack * 3600) / timelineDurationSeconds));
}

/**
 * Verifica capacidade para múltiplas ocorrências candidatas de uma campanha
 * em uma mesma tela.
 *
 * Retorna o mínimo de maxPlaysPerHour e se todas cabem.
 */
export function checkCapacityBatch(
  candidates: CapacityOccurrence[],
  existing: CapacityOccurrence[],
  timelineDurationSeconds: number,
  capacityLimit: number = EFFECTIVE_CAPACITY,
): {
  allFit: boolean;
  someFit: boolean;
  results: CapacityCheckResult[];
  minMaxPlaysPerHour: number;
} {
  const results: CapacityCheckResult[] = [];
  let allFit = true;
  let someFit = false;
  let minMaxPlaysPerHour = Infinity;

  for (const candidate of candidates) {
    const result = checkCapacity(candidate, existing, capacityLimit);
    const maxPph = computeMaxPlaysPerHour(result.slack, timelineDurationSeconds);
    result.maxPlaysPerHour = maxPph;
    results.push(result);

    if (!result.fits) allFit = false;
    if (result.fits) someFit = true;
    if (maxPph < minMaxPlaysPerHour) minMaxPlaysPerHour = maxPph;
  }

  return {
    allFit,
    someFit,
    results,
    minMaxPlaysPerHour: minMaxPlaysPerHour === Infinity ? 0 : minMaxPlaysPerHour,
  };
}
