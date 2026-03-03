import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const SCHEDULE_SOURCE_TYPE = {
  PLAYLIST: 'PLAYLIST',
  CAMPAIGN: 'CAMPAIGN',
} as const;

type ScheduleSourceType = (typeof SCHEDULE_SOURCE_TYPE)[keyof typeof SCHEDULE_SOURCE_TYPE];

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MinLength(2, { message: 'O nome deve ter no mínimo 2 caracteres.' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres.' })
  name!: string;

  @IsEnum(SCHEDULE_SOURCE_TYPE, { message: 'O tipo de fonte deve ser PLAYLIST ou CAMPAIGN.' })
  sourceType!: ScheduleSourceType;

  @IsOptional()
  @IsString()
  playlistId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsDateString({}, { message: 'Data de início inválida.' })
  startDate!: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de fim inválida.' })
  endDate?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Horário de início inválido (HH:mm).' })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Horário de fim inválido (HH:mm).' })
  endTime!: string;

  @IsArray({ message: 'Dias da semana é obrigatório.' })
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  frequencyPerHour?: number;

  @IsArray({ message: 'A lista de telas de destino é obrigatória.' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  deviceIds!: string[];
}
