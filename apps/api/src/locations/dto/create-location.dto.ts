import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome do local é obrigatório.' })
  @MinLength(3, { message: 'O nome deve ter no mínimo 3 caracteres.' })
  @MaxLength(40, { message: 'O nome deve ter no máximo 40 caracteres.' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Latitude deve ser um número.' })
  @ValidateIf((o) => o.longitude !== undefined)
  latitude?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Longitude deve ser um número.' })
  @ValidateIf((o) => o.latitude !== undefined)
  longitude?: number;

  @IsOptional()
  @IsString()
  placeId?: string;
}
