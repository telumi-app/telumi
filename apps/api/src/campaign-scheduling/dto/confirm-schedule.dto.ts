import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmScheduleDto {
  @IsString()
  @IsNotEmpty({ message: 'O hold_id é obrigatório.' })
  holdId!: string;

  @IsString()
  @IsNotEmpty({ message: 'O idempotency_key é obrigatório.' })
  idempotencyKey!: string;
}
