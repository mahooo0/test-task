import type { DataRoom } from '@prisma/client';
import type { DataRoomDto } from '@dataroom/types';

export function toDataRoomDto(room: DataRoom): DataRoomDto {
  return {
    id: room.id,
    name: room.name,
    ownerId: room.ownerId,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}
