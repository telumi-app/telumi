import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const DEVICE_EVENT_TYPE = {
  CRASH_LOOP: 'CRASH_LOOP',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  ASSET_CORRUPTED: 'ASSET_CORRUPTED',
  LOW_STORAGE: 'LOW_STORAGE',
  NO_CONTENT_UPDATE: 'NO_CONTENT_UPDATE',
  PLAYER_STARTED: 'PLAYER_STARTED',
  PLAYER_STOPPED: 'PLAYER_STOPPED',
  NETWORK_DOWN: 'NETWORK_DOWN',
  NETWORK_RESTORED: 'NETWORK_RESTORED',
} as const;

const DEVICE_EVENT_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;

type DeviceEventType = (typeof DEVICE_EVENT_TYPE)[keyof typeof DEVICE_EVENT_TYPE];
type DeviceEventSeverity = (typeof DEVICE_EVENT_SEVERITY)[keyof typeof DEVICE_EVENT_SEVERITY];

export class DeviceTelemetryEventDto {
  @IsString({ message: 'O token do dispositivo deve ser uma string.' })
  @IsNotEmpty({ message: 'O token do dispositivo é obrigatório.' })
  deviceToken!: string;

  @IsEnum(DEVICE_EVENT_TYPE, {
    message: `eventType deve ser um dos valores: ${Object.keys(DEVICE_EVENT_TYPE).join(', ')}`,
  })
  eventType!: DeviceEventType;

  @IsOptional()
  @IsEnum(DEVICE_EVENT_SEVERITY, {
    message: `severity deve ser INFO, WARNING ou CRITICAL.`,
  })
  severity?: DeviceEventSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'message pode ter no máximo 500 caracteres.' })
  message?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsISO8601({}, { message: 'occurredAt deve estar no formato ISO 8601.' })
  occurredAt!: string;
}
