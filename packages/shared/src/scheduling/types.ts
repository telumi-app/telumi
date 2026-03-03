// ─── Tipos compartilhados do sistema de agendamento ─────────────────

import { HoldStatus, ScheduleErrorCode, SuggestionType, ValidationStatus } from './enums';

/** Janela de horário (tempo local, HH:mm) */
export interface TimeWindow {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

/** Criativo na timeline (para cálculo de hash / duração) */
export interface TimelineItem {
  creativeId: string;
  durationSeconds: number;
  orderIndex: number;
}

/** Ocorrência planejada (candidata ou materializada) */
export interface PlannedOccurrence {
  screenId: string;
  startAtUtc: string; // ISO 8601
  endAtUtc: string;   // ISO 8601
  playsPerHour: number;
  rate: number;
  timelineDurationSeconds: number;
}

/** Resumo por tela na validação */
export interface ScreenValidationSummary {
  screenId: string;
  screenName: string;
  status: ValidationStatus;
  reason: ScheduleErrorCode | null;
  maxPlaysPerHourAllowed: number;
}

/** Sugestão de ajuste */
export interface ScheduleSuggestion {
  type: SuggestionType;
  label: string; // code para microcopy
  payload: Record<string, unknown>;
}

/** Response da validação */
export interface ScheduleValidationResponse {
  status: ValidationStatus;
  code: ScheduleErrorCode | null;
  eligibleScreensCount: number;
  requestedScreensCount: number;
  timelineDurationSeconds: number;
  playsPerHour: number;
  rate: number;
  screenSummaries: ScreenValidationSummary[];
  suggestions: ScheduleSuggestion[];
  holdId: string | null;
  holdExpiresAt: string | null; // ISO 8601
}

/** Request de validação (draft do ScheduleRule) */
export interface ScheduleRuleDraft {
  timezone: string;
  dateStart: string; // ISO date
  dateEnd: string;   // ISO date
  daysOfWeek: number[]; // 0=domingo, 6=sábado
  windows: TimeWindow[];
  playsPerHour: number;
  screenIds: string[];
}

/** Request de confirmação */
export interface ScheduleConfirmRequest {
  holdId: string;
  idempotencyKey: string;
}

/** Ocorrência existente (consulta do banco) */
export interface ExistingOccurrence {
  id: string;
  campaignId: string;
  screenId: string;
  startAtUtc: Date;
  endAtUtc: Date;
  rate: number;
  playsPerHour: number;
  status: string;
}

/** Hold existente (consulta do banco) */
export interface ExistingHold {
  id: string;
  campaignId: string;
  status: HoldStatus;
  expiresAt: Date;
  occurrences: PlannedOccurrence[];
}
