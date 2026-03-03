/**
 * Códigos de erro padronizados para o domínio de dispositivos.
 * Cada código é utilizado na resposta { success: false, code, message }.
 */
export const DeviceErrorCode = {
  /** Código de pareamento não encontrado */
  PAIRING_CODE_NOT_FOUND: 'DEVICE_PAIRING_CODE_NOT_FOUND',
  /** Código de pareamento expirado */
  PAIRING_CODE_EXPIRED: 'DEVICE_PAIRING_CODE_EXPIRED',
  /** Token de dispositivo inválido ou não encontrado */
  DEVICE_TOKEN_INVALID: 'DEVICE_TOKEN_INVALID',
  /** Tela não encontrada */
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  /** Nome duplicado no workspace */
  DEVICE_NAME_DUPLICATE: 'DEVICE_NAME_DUPLICATE',
  /** Limite de telas do plano atingido */
  DEVICE_LIMIT_REACHED: 'DEVICE_LIMIT_REACHED',
  /** Local não pertence ao workspace */
  LOCATION_NOT_IN_WORKSPACE: 'LOCATION_NOT_IN_WORKSPACE',
  /** Tela não foi pareada (sem deviceToken) */
  DEVICE_NOT_PAIRED: 'DEVICE_NOT_PAIRED',
  /** occurredAt inválido */
  HEARTBEAT_INVALID_DATE: 'HEARTBEAT_INVALID_DATE',
  /** Colisão persistente ao gerar código de pareamento */
  PAIRING_CODE_COLLISION: 'PAIRING_CODE_COLLISION',
  /** Muitas tentativas — rate limit atingido */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  /** Tipo de evento de telemetria desconhecido */
  TELEMETRY_UNKNOWN_EVENT: 'TELEMETRY_UNKNOWN_EVENT',
  /** Parceiro não encontrado */
  PARTNER_NOT_FOUND: 'PARTNER_NOT_FOUND',
  /** Percentual de repasse fora do intervalo válido */
  PARTNER_SHARE_INVALID: 'PARTNER_SHARE_INVALID',
} as const;

export type DeviceErrorCode = (typeof DeviceErrorCode)[keyof typeof DeviceErrorCode];
