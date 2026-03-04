import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'O nome do workspace deve ter pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O nome do workspace deve ter no máximo 120 caracteres.' })
  workspaceName?: string;
}
