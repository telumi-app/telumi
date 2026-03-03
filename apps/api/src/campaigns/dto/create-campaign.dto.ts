import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignAssetDto {
  @IsString()
  @IsNotEmpty({ message: 'O ID da mídia é obrigatório.' })
  mediaId!: string;

  @IsInt({ message: 'A posição deve ser um número inteiro.' })
  @Min(0)
  position!: number;

  @IsOptional()
  @IsInt({ message: 'A duração deve ser um número inteiro em milissegundos.' })
  @Min(1000, { message: 'A duração mínima é 1 segundo (1000ms).' })
  durationMs?: number;
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MinLength(2, { message: 'O nome deve ter no mínimo 2 caracteres.' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres.' })
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'O objetivo deve ter no mínimo 2 caracteres.' })
  @MaxLength(120, { message: 'O objetivo deve ter no máximo 120 caracteres.' })
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A descrição deve ter no máximo 500 caracteres.' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de início inválida.' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de fim inválida.' })
  endDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignAssetDto)
  assets?: CampaignAssetDto[];
}
