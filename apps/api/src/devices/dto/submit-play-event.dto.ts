import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitPlayEventDto {
  @IsString({ message: 'O token do dispositivo deve ser uma string.' })
  @IsNotEmpty({ message: 'O token do dispositivo é obrigatório.' })
  deviceToken!: string;

  @IsString()
  @IsNotEmpty({ message: 'playId é obrigatório (identificador único do play).' })
  @MaxLength(64, { message: 'playId pode ter no máximo 64 caracteres.' })
  playId!: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsISO8601({}, { message: 'startedAt deve estar no formato ISO 8601.' })
  startedAt!: string;

  @IsISO8601({}, { message: 'endedAt deve estar no formato ISO 8601.' })
  endedAt!: string;

  @IsInt({ message: 'durationMs deve ser um número inteiro.' })
  @Min(0, { message: 'durationMs deve ser >= 0.' })
  durationMs!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  manifestVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  assetHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256, { message: 'hmacSignature pode ter no máximo 256 caracteres.' })
  hmacSignature?: string;
}
