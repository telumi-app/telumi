// ─── Funções puras para expansão de janelas ────────────────────────
import type { TimeWindow } from './types';

/**
 * Divide uma janela que cruza meia-noite em duas.
 * Ex.: {startTime: "22:00", endTime: "02:00"} →
 *   [{startTime: "22:00", endTime: "24:00"}, {startTime: "00:00", endTime: "02:00"}]
 *
 * Se a janela NÃO cruza meia-noite, retorna como está.
 */
export function splitMidnightWindow(
  window: TimeWindow,
): { window: TimeWindow; nextDay: boolean }[] {
  const startMinutes = parseTimeToMinutes(window.startTime);
  const endMinutes = parseTimeToMinutes(window.endTime);

  if (endMinutes > startMinutes) {
    // Janela normal (não cruza meia-noite)
    return [{ window, nextDay: false }];
  }

  // Cruza meia-noite: dividir em 2
  return [
    { window: { startTime: window.startTime, endTime: '23:59' }, nextDay: false },
    { window: { startTime: '00:00', endTime: window.endTime }, nextDay: true },
  ];
}

/**
 * Converte "HH:mm" para minutos desde meia-noite.
 */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converte minutos desde meia-noite para "HH:mm".
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Valida formato "HH:mm" (00:00 – 23:59).
 */
export function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/**
 * Gera uma data UTC a partir de uma data local + hora local + timezone.
 * Usa Intl/DateTimeFormat para resolver a conversão.
 *
 * Algoritmo:
 * 1. Interpreta "YYYY-MM-DDTHH:mm:00Z" como UTC (ponto de referência)
 * 2. Calcula o offset do timezone naquele instante usando toLocaleString
 * 3. Aplica o offset para obter o instante UTC correto
 *
 * @param dateIso "YYYY-MM-DD"
 * @param time "HH:mm"
 * @param timezone IANA timezone (ex.: "America/Sao_Paulo")
 */
export function localToUtc(dateIso: string, time: string, timezone: string): Date {
  // Ponto de referência: tratar hora local como se fosse UTC
  const asUtc = new Date(`${dateIso}T${time}:00Z`);

  // Descobrir o offset do timezone no instante de referência.
  // toLocaleString formata o mesmo instante em dois timezones diferentes.
  // Ao re-parsear ambos no MESMO timezone do sistema, a diferença é o offset real.
  const utcStr = asUtc.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = asUtc.toLocaleString('en-US', { timeZone: timezone });

  const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime();

  // Se hora local é HH:mm em timezone T, o instante UTC é HH:mm + offset
  return new Date(asUtc.getTime() + offsetMs);
}

/**
 * Gera todas as datas entre dateStart e dateEnd (inclusive) que caem nos daysOfWeek.
 * @param dateStart "YYYY-MM-DD"
 * @param dateEnd "YYYY-MM-DD"
 * @param daysOfWeek Array de 0-6 (0=domingo)
 * @returns Array de "YYYY-MM-DD"
 */
export function expandDateRange(
  dateStart: string,
  dateEnd: string,
  daysOfWeek: number[],
): string[] {
  const result: string[] = [];
  const daysSet = new Set(daysOfWeek);
  const start = new Date(dateStart + 'T00:00:00Z');
  const end = new Date(dateEnd + 'T00:00:00Z');

  const current = new Date(start);
  while (current <= end) {
    if (daysSet.has(current.getUTCDay())) {
      result.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

/**
 * Expande ScheduleRuleDraft em PlannedOccurrences (UTC).
 * Para cada data x tela x janela, retorna uma occurrence com start/end em UTC.
 */
export function expandOccurrences(params: {
  dates: string[];
  windows: TimeWindow[];
  screenIds: string[];
  timezone: string;
  playsPerHour: number;
  timelineDurationSeconds: number;
  rate: number;
}): Array<{
  screenId: string;
  startAtUtc: Date;
  endAtUtc: Date;
  playsPerHour: number;
  rate: number;
  timelineDurationSeconds: number;
}> {
  const result: Array<{
    screenId: string;
    startAtUtc: Date;
    endAtUtc: Date;
    playsPerHour: number;
    rate: number;
    timelineDurationSeconds: number;
  }> = [];

  for (const date of params.dates) {
    for (const window of params.windows) {
      const splitWindows = splitMidnightWindow(window);

      for (const { window: w, nextDay } of splitWindows) {
        // Se nextDay, avançar a data em 1
        let dateForWindow = date;
        if (nextDay) {
          const d = new Date(date + 'T00:00:00Z');
          d.setUTCDate(d.getUTCDate() + 1);
          dateForWindow = d.toISOString().slice(0, 10);
        }

        const startUtc = localToUtc(dateForWindow, w.startTime, params.timezone);
        // endTime "23:59" precisa virar 23:59:59
        const endTimeForCalc = w.endTime === '23:59' ? '23:59' : w.endTime;
        let endUtc = localToUtc(dateForWindow, endTimeForCalc, params.timezone);

        // Se endTime é "23:59", somar 59 segundos para fechar no fim do minuto
        if (w.endTime === '23:59') {
          endUtc = new Date(endUtc.getTime() + 59 * 1000);
        }

        for (const screenId of params.screenIds) {
          result.push({
            screenId,
            startAtUtc: startUtc,
            endAtUtc: endUtc,
            playsPerHour: params.playsPerHour,
            rate: params.rate,
            timelineDurationSeconds: params.timelineDurationSeconds,
          });
        }
      }
    }
  }

  return result;
}
