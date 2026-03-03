import { randomBytes } from 'crypto';

const PAIRING_CODE_LENGTH = 6;
const PAIRING_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0, O, I, 1

/**
 * Gera um código de pareamento alfanumérico de 6 caracteres.
 * Evita caracteres ambíguos (0/O, 1/I).
 */
export function generatePairingCode(): string {
  const bytes = randomBytes(PAIRING_CODE_LENGTH);
  let code = '';

  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_CODE_CHARS[bytes[i]! % PAIRING_CODE_CHARS.length];
  }

  return code;
}

/**
 * Retorna a data de expiração do pairing code (10 minutos a partir de agora).
 */
export function getPairingExpiration(): Date {
  return new Date(Date.now() + 10 * 60 * 1000);
}
