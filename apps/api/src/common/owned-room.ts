import type { PrismaService } from '../prisma/prisma.service';
import { AppException } from './exceptions/app.exception';

/** The caller owns exactly one room; resolve its id, failing closed (404) if somehow missing. */
export async function getOwnedRoomId(
  prisma: PrismaService,
  ownerId: string,
): Promise<string> {
  const room = await prisma.dataRoom.findUnique({
    where: { ownerId },
    select: { id: true },
  });
  if (!room) {
    throw new AppException('room.notFound');
  }
  return room.id;
}
