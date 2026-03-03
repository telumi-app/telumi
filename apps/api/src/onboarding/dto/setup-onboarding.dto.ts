import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { GoalProfileDto } from './update-mode.dto';

export enum ScreenCountDto {
  ONE_TO_TWO = 'ONE_TO_TWO',
  THREE_TO_FIVE = 'THREE_TO_FIVE',
  SIX_TO_TEN = 'SIX_TO_TEN',
  TEN_PLUS = 'TEN_PLUS',
}

export class SetupOnboardingDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome da empresa é obrigatório.' })
  @MinLength(2, { message: 'O nome da empresa deve ter no mínimo 2 caracteres.' })
  @MaxLength(120, { message: 'O nome da empresa deve ter no máximo 120 caracteres.' })
  companyName!: string;

  @IsString()
  @IsNotEmpty({ message: 'A cidade é obrigatória.' })
  @MinLength(2, { message: 'A cidade deve ter no mínimo 2 caracteres.' })
  @MaxLength(120, { message: 'A cidade deve ter no máximo 120 caracteres.' })
  city!: string;

  @IsString()
  @IsNotEmpty({ message: 'O estado é obrigatório.' })
  @Matches(/^[A-Z]{2}$/, { message: 'Selecione um estado válido.' })
  state!: string;

  @IsEnum(ScreenCountDto, { message: 'Selecione uma quantidade de telas válida.' })
  screenCount!: ScreenCountDto;

  @IsEnum(GoalProfileDto, { message: 'Objetivo inválido.' })
  goalProfile!: GoalProfileDto;

  @ValidateIf((dto: SetupOnboardingDto) => dto.goalProfile === GoalProfileDto.ADS_SALES)
  @IsBoolean({ message: 'Informe se pretende vender anúncios imediatamente.' })
  wantsToSellImmediately?: boolean;

  @ValidateIf((dto: SetupOnboardingDto) => dto.goalProfile === GoalProfileDto.ADS_SALES)
  @IsBoolean({ message: 'Informe se possui CNPJ.' })
  hasCnpj?: boolean;

  @ValidateIf((dto: SetupOnboardingDto) => dto.goalProfile === GoalProfileDto.ADS_SALES && dto.hasCnpj === true)
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o CNPJ.' })
  @Matches(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, {
    message: 'Informe um CNPJ válido.',
  })
  cnpj?: string;
}
