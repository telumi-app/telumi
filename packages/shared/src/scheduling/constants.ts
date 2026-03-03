// ─── Constantes canônicas do sistema de agendamento ──────────────────

/** Limite de capacidade: soma(rate) por tela em qualquer subintervalo */
export const CAPACITY_LIMIT = 1.0;

/** Buffer de segurança para fallback (5%) – pode ser 0 se não quiser */
export const CAPACITY_BUFFER = 0.05;

/** Capacidade efetiva por tela (descontado o buffer) */
export const EFFECTIVE_CAPACITY = CAPACITY_LIMIT - CAPACITY_BUFFER;

/** Frequência padrão (plays/hora) se o usuário não informar */
export const DEFAULT_PLAYS_PER_HOUR = 12;

/** Duração máxima da timeline (10 min) */
export const POLICY_MAX_TIMELINE_SECONDS = 600;

/** Duração mínima da timeline */
export const POLICY_MIN_TIMELINE_SECONDS = 1;

/** Duração mínima de um criativo (1s) */
export const POLICY_MIN_CREATIVE_SECONDS = 1;

/** Duração máxima de um criativo (5 min) */
export const POLICY_MAX_CREATIVE_SECONDS = 300;

/** Máximo de criativos por campanha */
export const POLICY_MAX_CREATIVES = 20;

/** TTL do hold de capacidade (5 minutos) */
export const HOLD_TTL_MS = 5 * 60 * 1000;

/** TTL do hold em segundos */
export const HOLD_TTL_SECONDS = 5 * 60;

/** Máximo de sugestões retornadas */
export const MAX_SUGGESTIONS = 3;

/** Máximo de plays_per_hour permitido */
export const MAX_PLAYS_PER_HOUR = 120;

/** Mínimo de plays_per_hour permitido */
export const MIN_PLAYS_PER_HOUR = 1;
