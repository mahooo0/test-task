import type { Share, ShareGrant } from '@prisma/client';
import { ShareMode, ShareResourceType, ShareRole } from '@dataroom/types';
import type { ShareDto, ShareGrantDto } from '@dataroom/types';

/** A Share row loaded with its grants — the shape the mapper needs. */
export type ShareWithGrants = Share & { grants: ShareGrant[] };

export function toShareGrantDto(grant: ShareGrant): ShareGrantDto {
  return {
    id: grant.id,
    invitedEmail: grant.invitedEmail,
    userId: grant.userId,
    // String enums key-equal-value, so this bridges the Prisma union to the shared enum.
    role: ShareRole[grant.role],
  };
}

/**
 * Maps a Share (+ its grants) to the wire DTO. `publicToken` is exposed only for PUBLIC
 * shares (it's null on RESTRICTED ones); `grants` is meaningful only for RESTRICTED shares.
 */
export function toShareDto(share: ShareWithGrants): ShareDto {
  return {
    id: share.id,
    resourceType: ShareResourceType[share.resourceType],
    resourceId: share.resourceId,
    mode: ShareMode[share.mode],
    role: ShareRole[share.role],
    publicToken: share.publicToken,
    grants: share.grants.map(toShareGrantDto),
    createdAt: share.createdAt.toISOString(),
    revokedAt: share.revokedAt ? share.revokedAt.toISOString() : null,
  };
}
