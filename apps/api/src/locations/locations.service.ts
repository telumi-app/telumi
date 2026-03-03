import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';

import { DatabaseService } from '@/modules/database';

import { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(workspaceId: string) {
    const locations = await this.db.location.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { devices: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        latitude: loc.latitude,
        longitude: loc.longitude,
        placeId: loc.placeId,
        deviceCount: loc._count.devices,
        createdAt: loc.createdAt,
      })),
    };
  }

  async create(workspaceId: string, dto: CreateLocationDto) {
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('Latitude e longitude devem ser informadas juntas.');
    }

    const exists = await this.db.location.findUnique({
      where: {
        workspaceId_name: { workspaceId, name: dto.name },
      },
    });

    if (exists) {
      throw new ConflictException('Já existe um local com esse nome neste ambiente.');
    }

    const location = await this.db.location.create({
      data: {
        workspaceId,
        name: dto.name,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        latitude: dto.latitude,
        longitude: dto.longitude,
        placeId: dto.placeId,
      },
    });

    return {
      success: true,
      data: {
        id: location.id,
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        latitude: location.latitude,
        longitude: location.longitude,
        placeId: location.placeId,
        createdAt: location.createdAt,
      },
    };
  }
}
