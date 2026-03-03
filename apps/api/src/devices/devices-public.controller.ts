import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { DevicesService } from './devices.service';
import { DeviceTelemetryEventDto } from './dto/device-telemetry-event.dto';
import { SubmitPlayEventDto } from './dto/submit-play-event.dto';
import { FastifyThrottlerGuard } from './guards/fastify-throttler.guard';

class PairDeviceDto {
    @IsString({ message: 'O código de pareamento deve ser uma string.' })
    @IsNotEmpty({ message: 'O código de pareamento é obrigatório.' })
    @Length(6, 6, { message: 'O código de pareamento deve ter exatamente 6 caracteres.' })
    code!: string;
}

class PairByTokenDto {
    @IsString({ message: 'O token de recuperação deve ser uma string.' })
    @IsNotEmpty({ message: 'O token de recuperação é obrigatório.' })
    token!: string;
}

class DeviceHeartbeatDto {
    @IsString({ message: 'O token do dispositivo deve ser uma string.' })
    @IsNotEmpty({ message: 'O token do dispositivo é obrigatório.' })
    deviceToken!: string;

    @IsOptional()
    @IsISO8601({}, { message: 'occurredAt deve estar no formato ISO 8601.' })
    occurredAt?: string;

    @IsOptional()
    @IsString({ message: 'playerStatus deve ser uma string.' })
    @MaxLength(40, { message: 'playerStatus pode ter no máximo 40 caracteres.' })
    playerStatus?: string;

    @IsOptional()
    @IsString({ message: 'manifestVersion deve ser uma string.' })
    @MaxLength(80, { message: 'manifestVersion pode ter no máximo 80 caracteres.' })
    manifestVersion?: string;
}

class DeviceManifestDto {
    @IsString({ message: 'O token do dispositivo deve ser uma string.' })
    @IsNotEmpty({ message: 'O token do dispositivo é obrigatório.' })
    deviceToken!: string;
}

@ApiTags('Devices Public')
@Controller('devices/public')
@UseGuards(FastifyThrottlerGuard)
export class DevicesPublicController {
    constructor(private readonly devicesService: DevicesService) { }

    @Post('pair')
    @Throttle({ short: { ttl: 60, limit: 5 }, long: { ttl: 600, limit: 15 } })
    @ApiOperation({ summary: 'Realiza o pareamento de um dispositivo via código' })
    pairDevice(@Body() dto: PairDeviceDto) {
        return this.devicesService.pairDevice(dto.code);
    }

    @Post('pair-by-token')
    @Throttle({ short: { ttl: 60, limit: 5 }, long: { ttl: 600, limit: 15 } })
    @ApiOperation({ summary: 'Realiza o pareamento/reconexão de um dispositivo via token de recuperação' })
    pairDeviceByToken(@Body() dto: PairByTokenDto) {
        return this.devicesService.pairDeviceByToken(dto.token);
    }

    @Post('heartbeat')
    @Throttle({ short: { ttl: 60, limit: 10 }, long: { ttl: 600, limit: 80 } })
    @ApiOperation({ summary: 'Recebe heartbeat do player para status em tempo quase real' })
    heartbeat(@Body() dto: DeviceHeartbeatDto) {
        return this.devicesService.heartbeatByToken(
            dto.deviceToken,
            dto.occurredAt,
            dto.playerStatus,
            dto.manifestVersion,
        );
    }

    @Post('manifest')
    @Throttle({ short: { ttl: 60, limit: 20 }, long: { ttl: 600, limit: 200 } })
    @ApiOperation({ summary: 'Obtém manifesto de reprodução para o player' })
    getManifest(@Body() dto: DeviceManifestDto) {
        return this.devicesService.getPlaybackManifestByToken(dto.deviceToken);
    }

    @Post('telemetry')
    @Throttle({ short: { ttl: 60, limit: 10 }, long: { ttl: 600, limit: 60 } })
    @ApiOperation({ summary: 'Recebe eventos de telemetria operacional do player' })
    telemetryEvent(@Body() dto: DeviceTelemetryEventDto) {
        return this.devicesService.ingestTelemetryEvent({
            deviceToken: dto.deviceToken,
            eventType: dto.eventType,
            severity: dto.severity,
            message: dto.message,
            metadata: dto.metadata,
            occurredAt: dto.occurredAt,
        });
    }

    @Post('play-event')
    @Throttle({ short: { ttl: 60, limit: 20 }, long: { ttl: 600, limit: 200 } })
    @ApiOperation({ summary: 'Recebe evento de Proof-of-Play do player' })
    submitPlayEvent(@Body() dto: SubmitPlayEventDto) {
        return this.devicesService.ingestPlayEvent({
            deviceToken: dto.deviceToken,
            playId: dto.playId,
            campaignId: dto.campaignId,
            assetId: dto.assetId,
            startedAt: dto.startedAt,
            endedAt: dto.endedAt,
            durationMs: dto.durationMs,
            manifestVersion: dto.manifestVersion,
            assetHash: dto.assetHash,
            hmacSignature: dto.hmacSignature,
        });
    }
}
