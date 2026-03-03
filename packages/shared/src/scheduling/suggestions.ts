// ─── Gerador de sugestões (funções puras) ───────────────────────────
import { SuggestionType } from './enums';
import type { ScheduleSuggestion, TimeWindow } from './types';
import { minutesToTime, parseTimeToMinutes } from './windows';

/**
 * Gera sugestão de redução de frequência.
 * @param maxPlaysPerHour Máximo que cabe
 */
export function suggestReduceFrequency(
  maxPlaysPerHour: number,
): ScheduleSuggestion | null {
  if (maxPlaysPerHour < 1) return null;

  return {
    type: SuggestionType.REDUCE_FREQUENCY,
    label: 'SUGGESTION_REDUCE_FREQUENCY',
    payload: { playsPerHour: maxPlaysPerHour },
  };
}

/**
 * Gera sugestão de trocar janela (shift ±30 min).
 */
export function suggestShiftWindow(
  window: TimeWindow,
  shiftMinutes = 30,
): ScheduleSuggestion[] {
  const startMin = parseTimeToMinutes(window.startTime);
  const endMin = parseTimeToMinutes(window.endTime);

  const suggestions: ScheduleSuggestion[] = [];

  // Tentar shift para frente
  const newStart = startMin + shiftMinutes;
  const newEnd = endMin + shiftMinutes;
  if (newEnd <= 23 * 60 + 59) {
    suggestions.push({
      type: SuggestionType.SHIFT_WINDOW,
      label: 'SUGGESTION_SHIFT_WINDOW_LATER',
      payload: {
        window: {
          startTime: minutesToTime(newStart),
          endTime: minutesToTime(newEnd),
        },
      },
    });
  }

  // Tentar shift para trás
  const newStartBack = startMin - shiftMinutes;
  const newEndBack = endMin - shiftMinutes;
  if (newStartBack >= 0) {
    suggestions.push({
      type: SuggestionType.SHIFT_WINDOW,
      label: 'SUGGESTION_SHIFT_WINDOW_EARLIER',
      payload: {
        window: {
          startTime: minutesToTime(newStartBack),
          endTime: minutesToTime(newEndBack),
        },
      },
    });
  }

  return suggestions;
}

/**
 * Gera sugestão de reduzir telas para subset OK.
 * @param okScreenIds IDs de telas que cabem
 */
export function suggestReduceScreens(
  okScreenIds: string[],
): ScheduleSuggestion | null {
  if (okScreenIds.length === 0) return null;

  return {
    type: SuggestionType.REDUCE_SCREENS,
    label: 'SUGGESTION_REDUCE_SCREENS',
    payload: { screenIds: okScreenIds },
  };
}
