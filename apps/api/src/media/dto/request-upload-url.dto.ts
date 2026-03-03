import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  MAX_VIDEO_SIZE,
} from '../constants';

export class RequestUploadUrlDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MinLength(1, { message: 'O nome deve ter no mínimo 1 caractere.' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres.' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'O nome original do arquivo é obrigatório.' })
  @MaxLength(255, { message: 'O nome do arquivo é muito longo.' })
  originalName!: string;

  @IsString()
  @IsNotEmpty({ message: 'O tipo MIME é obrigatório.' })
  mimeType!: string;

  @IsInt({ message: 'O tamanho do arquivo deve ser um número inteiro.' })
  @Min(1, { message: 'O arquivo deve ter pelo menos 1 byte.' })
  @Max(MAX_VIDEO_SIZE, { message: 'O arquivo excede o tamanho máximo permitido.' })
  fileSize!: number;

  @IsOptional()
  @IsString()
  hash?: string;

  @IsOptional()
  @IsInt({ message: 'A duração deve ser um número inteiro em milissegundos.' })
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}
