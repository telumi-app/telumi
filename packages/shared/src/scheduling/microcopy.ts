// ─── Microcopy pt-BR (mapeamento code → texto) ─────────────────────
import { ScheduleErrorCode, SuggestionType, ValidationStatus } from './enums';

/** Textos de status de validação */
export const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  [ValidationStatus.OK]: 'Agendamento válido',
  [ValidationStatus.PARCIAL]: 'Capacidade parcial',
  [ValidationStatus.SEM_CAPACIDADE]: 'Sem capacidade disponível',
  [ValidationStatus.INVALIDO]: 'Configuração inválida',
  [ValidationStatus.NEED_REVALIDATE]: 'Revalidação necessária',
  [ValidationStatus.ERRO]: 'Erro inesperado',
};

/** Textos de erro */
export const ERROR_CODE_LABELS: Record<ScheduleErrorCode, string> = {
  [ScheduleErrorCode.NO_ELIGIBLE_SCREENS]:
    'Nenhuma tela elegível encontrada para o agendamento.',
  [ScheduleErrorCode.INVALID_TIMELINE]:
    'A timeline da campanha é inválida. Verifique os criativos.',
  [ScheduleErrorCode.INVALID_WINDOW]:
    'A janela de horário é inválida.',
  [ScheduleErrorCode.INVALID_DATES]:
    'As datas selecionadas são inválidas.',
  [ScheduleErrorCode.CAPACITY_FULL]:
    'Todas as telas estão com capacidade esgotada nesse horário.',
  [ScheduleErrorCode.CAPACITY_PARTIAL]:
    'Algumas telas não têm capacidade suficiente nesse horário.',
  [ScheduleErrorCode.HOLD_EXPIRED]:
    'A reserva expirou. Valide novamente o agendamento.',
  [ScheduleErrorCode.HOLD_MISMATCH]:
    'O agendamento foi alterado desde a validação. Valide novamente.',
  [ScheduleErrorCode.CAMPAIGN_CHANGED_SINCE_VALIDATION]:
    'A campanha foi alterada desde a validação. Valide novamente.',
  [ScheduleErrorCode.HOLD_NOT_FOUND]:
    'Reserva não encontrada.',
  [ScheduleErrorCode.IDEMPOTENCY_CONFLICT]:
    'Este agendamento já foi confirmado.',
  [ScheduleErrorCode.INTERNAL_ERROR]:
    'Ocorreu um erro inesperado. Tente novamente.',
};

/** Textos de sugestão */
export const SUGGESTION_LABELS: Record<string, string> = {
  SUGGESTION_REDUCE_FREQUENCY: 'Reduzir frequência para {playsPerHour} plays/hora',
  SUGGESTION_SHIFT_WINDOW_LATER: 'Mover janela para {startTime} – {endTime}',
  SUGGESTION_SHIFT_WINDOW_EARLIER: 'Mover janela para {startTime} – {endTime}',
  SUGGESTION_REDUCE_SCREENS: 'Usar apenas {count} tela(s) disponível(is)',
};

/** Tipo do mapa de sugestões */
export const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  [SuggestionType.REDUCE_FREQUENCY]: 'Reduzir frequência',
  [SuggestionType.SHIFT_WINDOW]: 'Alterar horário',
  [SuggestionType.REDUCE_SCREENS]: 'Reduzir telas',
};
