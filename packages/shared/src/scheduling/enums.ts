// ─── Enums do sistema de agendamento ────────────────────────────────

/** Status da validação de agendamento */
export enum ValidationStatus {
  OK = 'OK',
  PARCIAL = 'PARCIAL',
  SEM_CAPACIDADE = 'SEM_CAPACIDADE',
  INVALIDO = 'INVALIDO',
  NEED_REVALIDATE = 'NEED_REVALIDATE',
  ERRO = 'ERRO',
}

/** Códigos de erro/motivo estruturados (FE mapeia para microcopy) */
export enum ScheduleErrorCode {
  NO_ELIGIBLE_SCREENS = 'NO_ELIGIBLE_SCREENS',
  INVALID_TIMELINE = 'INVALID_TIMELINE',
  INVALID_WINDOW = 'INVALID_WINDOW',
  INVALID_DATES = 'INVALID_DATES',
  CAPACITY_FULL = 'CAPACITY_FULL',
  CAPACITY_PARTIAL = 'CAPACITY_PARTIAL',
  HOLD_EXPIRED = 'HOLD_EXPIRED',
  HOLD_MISMATCH = 'HOLD_MISMATCH',
  CAMPAIGN_CHANGED_SINCE_VALIDATION = 'CAMPAIGN_CHANGED_SINCE_VALIDATION',
  HOLD_NOT_FOUND = 'HOLD_NOT_FOUND',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/** Tipo de sugestão */
export enum SuggestionType {
  REDUCE_FREQUENCY = 'REDUCE_FREQUENCY',
  SHIFT_WINDOW = 'SHIFT_WINDOW',
  REDUCE_SCREENS = 'REDUCE_SCREENS',
}

/** Status de campaign */
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

/** Status de occurrence (instância materializada) */
export enum OccurrenceStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
}

/** Status de capacity hold */
export enum HoldStatus {
  ACTIVE = 'ACTIVE',
  CONSUMED = 'CONSUMED',
  EXPIRED = 'EXPIRED',
}
