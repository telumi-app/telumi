import { IsEnum } from 'class-validator';

export enum GoalProfileDto {
  INTERNAL = 'INTERNAL',
  ADS_SALES = 'ADS_SALES',
}

export class UpdateModeDto {
  @IsEnum(GoalProfileDto, { message: 'Objetivo inválido.' })
  goalProfile!: GoalProfileDto;
}
