import { ItemType } from '@dataroom/types';
import type { ItemDto } from '@dataroom/types';

/**
 * The minimal shape the mapper needs — satisfied by both a Prisma `Item` entity
 * and a raw-query row (keyset listing). Kept structural so neither path needs a cast.
 */
export interface ItemSource {
  id: string;
  dataRoomId: string;
  parentId: string | null;
  type: 'FOLDER' | 'FILE';
  name: string;
  sizeBytes: bigint | null;
  mimeType: string | null;
  starred: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Present only for trash rows; absent on the keyset-listing rows (active items ⇒ null). */
  deletedAt?: Date | null;
  /** Computed by folder-listing queries only; absent (⇒ undefined) elsewhere. */
  hasSubfolders?: boolean;
}

/**
 * Maps an Item entity (or raw row) to the wire DTO. BigInt `sizeBytes` is converted
 * to `number` here at the boundary (PDF sizes are far under Number.MAX_SAFE_INTEGER);
 * `status`/`storageKey`/`uploadedAt` are server-only and never leave the service.
 */
export function toItemDto(item: ItemSource): ItemDto {
  return {
    id: item.id,
    dataRoomId: item.dataRoomId,
    parentId: item.parentId,
    type: ItemType[item.type],
    name: item.name,
    sizeBytes: item.sizeBytes === null ? null : Number(item.sizeBytes),
    mimeType: item.mimeType,
    starred: item.starred,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
    // Only folder-listing rows carry this; keep it off the wire when unknown (undefined).
    ...(item.hasSubfolders === undefined
      ? {}
      : { hasSubfolders: item.hasSubfolders }),
  };
}
