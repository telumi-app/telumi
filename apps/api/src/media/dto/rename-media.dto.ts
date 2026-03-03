import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RenameMediaDto {
  @IsString()
  @MinLength(1, { message: 'O nome deve ter no mínimo 1 caractere.' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres.' })
  @IsOptional()
  name?: string;
}
