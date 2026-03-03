import {
  Controller,
  MessageEvent,
  Query,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiExcludeController } from '@nestjs/swagger';
import { Observable } from 'rxjs';

import { AuthUser } from '@/auth/types/auth-user.type';

import { DevicesService } from './devices.service';

@ApiExcludeController()
@Controller('devices')
export class DevicesStreamController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Sse('stream')
  stream(@Query('token') token?: string): Observable<MessageEvent> {
    if (!token) {
      throw new UnauthorizedException('Token não informado.');
    }

    let payload: AuthUser;

    try {
      payload = this.jwtService.verify<AuthUser>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    return this.devicesService.streamWorkspaceEvents(payload.workspaceId);
  }
}
