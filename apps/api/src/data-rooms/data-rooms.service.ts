import { Injectable } from '@nestjs/common';
import type { DataRoom } from '@prisma/client';
import type { SubtreeStatsDto } from '@dataroom/types';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { ItemsService } from '../items/items.service';

/**
 * The user's single Data Room. There is no create/delete surface (one room is
 * auto-provisioned with the account); only read, rename, and whole-room stats.
 */
@Injectable()
export class DataRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemsService,
  ) {}

  async getRoomForUser(ownerId: string): Promise<DataRoom> {
    const room = await this.prisma.dataRoom.findUnique({ where: { ownerId } });
    if (!room) {
      throw new AppException('room.notFound');
    }
    return room;
  }

  async renameRoom(ownerId: string, name: string): Promise<DataRoom> {
    await this.getRoomForUser(ownerId);
    return this.prisma.dataRoom.update({
      where: { ownerId },
      data: { name: name.trim() },
    });
  }

  async getRoomStats(ownerId: string): Promise<SubtreeStatsDto> {
    const room = await this.getRoomForUser(ownerId);
    return this.items.computeSubtreeStats(room.id, null);
  }
}
