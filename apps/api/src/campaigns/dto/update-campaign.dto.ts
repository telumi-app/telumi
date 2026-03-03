import {
  IsArray,
  IsDateString,
  IsEnum,
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
import { CampaignAssetDto } from './create-campaign.dto';

const CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
} as const;

type CampaignStatusType = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'O nome não pode ser vazio.' })
  @MinLength(2, { message: 'O nome deve ter no mínimo 2 caracteres.' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres.' })
  name?: string;

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
  @IsEnum(CAMPAIGN_STATUS, { message: 'Status inválido.' })
  status?: CampaignStatusType;

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
