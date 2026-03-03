import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome do workspace é obrigatório.' })
  @MinLength(3, { message: 'O nome deve ter no mínimo 3 caracteres.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'O slug é obrigatório.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug inválido. Use apenas letras minúsculas, números e hífen.',
  })
  slug!: string;
}
