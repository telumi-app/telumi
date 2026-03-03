import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  MAX_PLAYS_PER_HOUR,
  MIN_PLAYS_PER_HOUR,
} from '@telumi/shared';

export class TimeWindowDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Horário de início inválido (HH:mm).' })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Horário de fim inválido (HH:mm).' })
  endTime!: string;
}

export class ValidateScheduleDto {
  @IsString()
  @IsNotEmpty({ message: 'O timezone é obrigatório.' })
  timezone!: string;

  @IsDateString({}, { message: 'Data de início inválida.' })
  dateStart!: string;

  @IsDateString({}, { message: 'Data de fim inválida.' })
  dateEnd!: string;

  @IsArray({ message: 'Dias da semana é obrigatório.' })
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @IsArray({ message: 'Pelo menos uma janela de horário é obrigatória.' })
  @ValidateNested({ each: true })
  @Type(() => TimeWindowDto)
  windows!: TimeWindowDto[];

  @IsInt({ message: 'A frequência deve ser um número inteiro.' })
  @Min(MIN_PLAYS_PER_HOUR, { message: `Mínimo ${MIN_PLAYS_PER_HOUR} play(s)/hora.` })
  @Max(MAX_PLAYS_PER_HOUR, { message: `Máximo ${MAX_PLAYS_PER_HOUR} plays/hora.` })
  playsPerHour!: number;

  @IsArray({ message: 'Pelo menos uma tela deve ser selecionada.' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  screenIds!: string[];
}
