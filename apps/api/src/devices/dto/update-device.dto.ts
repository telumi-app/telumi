import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const DEVICE_ORIENTATION = {
  HORIZONTAL: 'HORIZONTAL',
  VERTICAL: 'VERTICAL',
} as const;

const DEVICE_OPERATIONAL_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

type DeviceOrientation = (typeof DEVICE_ORIENTATION)[keyof typeof DEVICE_ORIENTATION];
type DeviceOperationalStatus = (typeof DEVICE_OPERATIONAL_STATUS)[keyof typeof DEVICE_OPERATIONAL_STATUS];

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'O nome deve ter no mínimo 3 caracteres.' })
  @MaxLength(40, { message: 'O nome deve ter no máximo 40 caracteres.' })
  name?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsEnum(DEVICE_ORIENTATION, { message: 'Orientação inválida.' })
  orientation?: DeviceOrientation;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'A resolução deve ter no máximo 30 caracteres.' })
  resolution?: string;

  @IsOptional()
  @IsEnum(DEVICE_OPERATIONAL_STATUS, { message: 'Status operacional inválido.' })
  operationalStatus?: DeviceOperationalStatus;

  @IsOptional()
  @IsBoolean({ message: 'O campo público deve ser verdadeiro ou falso.' })
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'O campo TV parceira deve ser verdadeiro ou falso.' })
  isPartnerTv?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'O nome do parceiro deve ter no máximo 80 caracteres.' })
  partnerName?: string;

  @IsOptional()
  @IsNumber({}, { message: 'O percentual de repasse deve ser numérico.' })
  @Min(0, { message: 'O percentual de repasse deve ser >= 0.' })
  @Max(100, { message: 'O percentual de repasse deve ser <= 100.' })
  partnerRevenueSharePct?: number;
}
