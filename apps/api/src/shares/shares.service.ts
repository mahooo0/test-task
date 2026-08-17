import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Share } from '@prisma/client';
import type {
  BreadcrumbDto,
  ContentUrlDto,
  ItemDto,
  ItemSortField,
  Paginated,
  ShareDto,
  SharedResourceView,
  ShareMode as ShareModeType,
  ShareResourceType as ShareResourceTypeType,
  ShareRole as ShareRoleType,
  SortDirection,
} from '@dataroom/types';
import { ShareMode, ShareResourceType, ShareRole } from '@dataroom/types';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { ItemsService } from '../items/items.service';
import type { CreateShareDto } from './dto/create-share.dto';
import type { ListSharesDto } from './dto/list-shares.dto';
import { type ShareWithGrants, toShareDto } from './shares.mapper';

/** Bytes of entropy behind a public-link token (base64url ⇒ ~32 chars). */
const PUBLIC_TOKEN_BYTES = 24;

/**
 * A resolved, authorized shared scope — the room + optional root item a non-owner may read within.
 * `rootItemId === null` ⇒ a ROOM share (the whole room is in scope); otherwise reads are confined to
 * that item and its subtree. Produced by resolving a public token or a grant; never trusts client ids.
 */
interface SharedAccess {
  shareId: string;
  dataRoomId: string;
  rootItemId: string | null;
  resourceType: ShareResourceTypeType;
  mode: ShareModeType;
  role: ShareRoleType;
}

// SharedResourceView lives in @dataroom/types (shared with the web client); re-exported here so the
// shared-read controllers can keep importing it from this module.
export type { SharedResourceView };

/**
 * Owner-side share management: create/reuse a share of the caller's room or an item, list the
 * caller's shares, manage RESTRICTED invitees, and revoke. Access *enforcement* for non-owners
 * (public link + grantee reads) lives in the shared-read surface (B3.2) — this file only lets an
 * owner set up and tear down shares.
 */
@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemsService,
  ) {}

  /**
   * Create a share, or reuse the resource's existing non-revoked share of the same mode so a
   * resource keeps one stable public link and one restricted invite list. RESTRICTED creates
   * merge in any new invited emails.
   */
  async createShare(ownerId: string, dto: CreateShareDto): Promise<ShareDto> {
    const roomId = await this.getRoomId(ownerId);
    const resourceId = await this.resolveOwnedResource(ownerId, roomId, dto);

    const existing = await this.prisma.share.findFirst({
      where: {
        ownerId,
        resourceType: dto.resourceType,
        resourceId,
        mode: dto.mode,
        revokedAt: null,
      },
      include: { grants: true },
    });

    if (dto.mode === ShareMode.PUBLIC) {
      if (existing) return toShareDto(existing);
      const created = await this.prisma.share.create({
        data: {
          ownerId,
          resourceType: dto.resourceType,
          resourceId,
          mode: ShareMode.PUBLIC,
          publicToken: generatePublicToken(),
        },
        include: { grants: true },
      });
      return toShareDto(created);
    }

    // RESTRICTED — reuse or create the share, then merge invitees.
    const share =
      existing ??
      (await this.prisma.share.create({
        data: {
          ownerId,
          resourceType: dto.resourceType,
          resourceId,
          mode: ShareMode.RESTRICTED,
        },
        include: { grants: true },
      }));
    const emails = normalizeEmails(dto.invitedEmails ?? []);
    if (emails.length > 0) {
      await this.upsertGrants(share.id, emails);
    }
    return toShareDto(await this.getShareWithGrants(share.id));
  }

  /** Every non-revoked share the caller owns, newest first, optionally filtered by resource. */
  async listShares(
    ownerId: string,
    filter: ListSharesDto,
  ): Promise<ShareDto[]> {
    const shares = await this.prisma.share.findMany({
      where: {
        ownerId,
        revokedAt: null,
        ...(filter.resourceType ? { resourceType: filter.resourceType } : {}),
        ...(filter.resourceId ? { resourceId: filter.resourceId } : {}),
      },
      include: { grants: true },
      orderBy: { createdAt: 'desc' },
    });
    return shares.map(toShareDto);
  }

  /** Add invited emails to a RESTRICTED share the caller owns. */
  async addGrants(
    ownerId: string,
    shareId: string,
    emails: string[],
  ): Promise<ShareDto> {
    const share = await this.getOwnedShareOrThrow(ownerId, shareId);
    // `share.mode` is the Prisma enum; compare to the string literal (as elsewhere in this
    // codebase) to avoid a cross-declaration enum comparison against `@dataroom/types`.
    if (share.mode !== 'RESTRICTED') {
      throw new AppException('share.onlyRestrictedInvitees');
    }
    if (share.revokedAt) {
      throw new AppException('share.revoked');
    }
    await this.upsertGrants(share.id, normalizeEmails(emails));
    return toShareDto(await this.getShareWithGrants(share.id));
  }

  /** Remove one invitee from a share the caller owns (no-op if the grant is already gone). */
  async removeGrant(
    ownerId: string,
    shareId: string,
    grantId: string,
  ): Promise<ShareDto> {
    const share = await this.getOwnedShareOrThrow(ownerId, shareId);
    await this.prisma.shareGrant.deleteMany({
      where: { id: grantId, shareId: share.id },
    });
    return toShareDto(await this.getShareWithGrants(share.id));
  }

  /** Revoke a share (idempotent) — access checks treat a revoked share as gone. */
  async revokeShare(ownerId: string, shareId: string): Promise<void> {
    const share = await this.getOwnedShareOrThrow(ownerId, shareId);
    if (share.revokedAt) return;
    await this.prisma.share.update({
      where: { id: share.id },
      data: { revokedAt: new Date() },
    });
  }

  // ── shared reads (non-owner: public link + invited grantee) ──────────────────

  /** Everything shared with the caller (invited by grant or by email), newest first. */
  async listSharedWithMe(
    userId: string,
    email: string,
  ): Promise<SharedResourceView[]> {
    const shares = await this.prisma.share.findMany({
      where: {
        revokedAt: null,
        grants: {
          some: {
            OR: [{ userId }, { invitedEmail: email.trim().toLowerCase() }],
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const views: SharedResourceView[] = [];
    for (const share of shares) {
      // A share whose resource was since trashed/deleted resolves to nothing — drop it silently.
      try {
        views.push(await this.describeAccess(await this.toAccess(share)));
      } catch {
        // skip dead shares
      }
    }
    return views;
  }

  // Public-link surface (anonymous — the token is the credential).
  resolvePublic(token: string): Promise<SharedResourceView> {
    // Anonymous viewers see the owner's name/avatar but not their email (PII hardening).
    return this.resolveByToken(token).then((a) =>
      this.describeAccess(a, { publicView: true }),
    );
  }
  async publicListing(
    token: string,
    parentIdParam: string | null,
    cursor: string | null,
    limit: number,
    sort: ItemSortField,
    dir: SortDirection,
  ): Promise<Paginated<ItemDto>> {
    return this.listInScope(
      await this.resolveByToken(token),
      parentIdParam,
      cursor,
      limit,
      sort,
      dir,
    );
  }
  async publicItem(token: string, itemId: string): Promise<ItemDto> {
    return this.itemInScope(await this.resolveByToken(token), itemId);
  }
  async publicBreadcrumb(
    token: string,
    itemId: string,
  ): Promise<BreadcrumbDto[]> {
    return this.breadcrumbInScope(await this.resolveByToken(token), itemId);
  }
  async publicContent(
    token: string,
    itemId: string,
    disposition: 'inline' | 'attachment',
  ): Promise<ContentUrlDto> {
    return this.contentInScope(
      await this.resolveByToken(token),
      itemId,
      disposition,
    );
  }

  // Grantee surface (authenticated invited user — the grant is the credential).
  resolveGrantee(
    userId: string,
    email: string,
    shareId: string,
  ): Promise<SharedResourceView> {
    return this.resolveByGrant(userId, email, shareId).then((a) =>
      this.describeAccess(a),
    );
  }
  async granteeListing(
    userId: string,
    email: string,
    shareId: string,
    parentIdParam: string | null,
    cursor: string | null,
    limit: number,
    sort: ItemSortField,
    dir: SortDirection,
  ): Promise<Paginated<ItemDto>> {
    return this.listInScope(
      await this.resolveByGrant(userId, email, shareId),
      parentIdParam,
      cursor,
      limit,
      sort,
      dir,
    );
  }
  async granteeItem(
    userId: string,
    email: string,
    shareId: string,
    itemId: string,
  ): Promise<ItemDto> {
    return this.itemInScope(
      await this.resolveByGrant(userId, email, shareId),
      itemId,
    );
  }
  async granteeBreadcrumb(
    userId: string,
    email: string,
    shareId: string,
    itemId: string,
  ): Promise<BreadcrumbDto[]> {
    return this.breadcrumbInScope(
      await this.resolveByGrant(userId, email, shareId),
      itemId,
    );
  }
  async granteeContent(
    userId: string,
    email: string,
    shareId: string,
    itemId: string,
    disposition: 'inline' | 'attachment',
  ): Promise<ContentUrlDto> {
    return this.contentInScope(
      await this.resolveByGrant(userId, email, shareId),
      itemId,
      disposition,
    );
  }

  // ── internals ────────────────────────────────────────────────────────────────

  /** Resolve a PUBLIC share by its link token, or 404. */
  private async resolveByToken(token: string): Promise<SharedAccess> {
    const share = await this.prisma.share.findFirst({
      where: { publicToken: token, mode: 'PUBLIC', revokedAt: null },
    });
    if (!share) {
      throw new AppException('share.notFound');
    }
    return this.toAccess(share);
  }

  /**
   * Resolve a share the caller was invited to (by linked user id or by invited email), or 404.
   * Only RESTRICTED shares carry grants, so this never matches a public share — and a caller with no
   * matching grant gets a 404 (never a 403 that would confirm the share exists).
   */
  private async resolveByGrant(
    userId: string,
    email: string,
    shareId: string,
  ): Promise<SharedAccess> {
    const share = await this.prisma.share.findFirst({
      where: {
        id: shareId,
        revokedAt: null,
        grants: {
          some: {
            OR: [{ userId }, { invitedEmail: email.trim().toLowerCase() }],
          },
        },
      },
    });
    if (!share) {
      throw new AppException('share.notFound');
    }
    return this.toAccess(share);
  }

  /**
   * Turn a Share row into a resolved scope. Re-reads the target so a share whose resource was
   * trashed/deleted resolves to 404 (a trashed subtree is not ACTIVE, so it must not be readable).
   */
  private async toAccess(share: Share): Promise<SharedAccess> {
    const base = {
      shareId: share.id,
      resourceType: ShareResourceType[share.resourceType],
      mode: ShareMode[share.mode],
      role: ShareRole[share.role],
    };
    if (share.resourceType === 'ROOM') {
      const room = await this.prisma.dataRoom.findUnique({
        where: { id: share.resourceId },
        select: { id: true },
      });
      if (!room) {
        throw new AppException('share.resourceNotFound');
      }
      return { ...base, dataRoomId: room.id, rootItemId: null };
    }
    const item = await this.prisma.item.findFirst({
      where: { id: share.resourceId, status: 'ACTIVE' },
      select: { id: true, dataRoomId: true },
    });
    if (!item) {
      throw new AppException('share.resourceNotFound');
    }
    return { ...base, dataRoomId: item.dataRoomId, rootItemId: item.id };
  }

  /**
   * Header info for a resolved share: the shared root, the room name, and the owner. On the anonymous
   * public surface (`publicView`) the owner's email is withheld — anyone-with-the-link should not learn
   * the owner's contact address (an invited grantee, who was added by that owner, does see it).
   */
  private async describeAccess(
    access: SharedAccess,
    opts: { publicView?: boolean } = {},
  ): Promise<SharedResourceView> {
    const share = await this.prisma.share.findUniqueOrThrow({
      where: { id: access.shareId },
      select: { createdAt: true },
    });
    const room = await this.prisma.dataRoom.findUniqueOrThrow({
      where: { id: access.dataRoomId },
      select: {
        name: true,
        owner: { select: { name: true, email: true, avatarUrl: true } },
      },
    });
    const root =
      access.rootItemId !== null
        ? await this.items.getItemInRoom(access.dataRoomId, access.rootItemId)
        : null;
    return {
      shareId: access.shareId,
      mode: access.mode,
      resourceType: access.resourceType,
      role: access.role,
      root,
      roomName: room.name,
      owner: {
        name: room.owner.name,
        email: opts.publicView ? null : room.owner.email,
        avatarUrl: room.owner.avatarUrl,
      },
      sharedAt: share.createdAt.toISOString(),
    };
  }

  /** List one level within the shared scope, defaulting to (and confined within) the shared root. */
  private async listInScope(
    access: SharedAccess,
    parentIdParam: string | null,
    cursor: string | null,
    limit: number,
    sort: ItemSortField,
    dir: SortDirection,
  ): Promise<Paginated<ItemDto>> {
    const parentId = await this.resolveScopedParent(access, parentIdParam);
    return this.items.listChildrenInRoom(
      access.dataRoomId,
      parentId,
      cursor,
      limit,
      sort,
      dir,
    );
  }

  private async itemInScope(
    access: SharedAccess,
    itemId: string,
  ): Promise<ItemDto> {
    await this.assertInScope(access, itemId);
    return this.items.getItemInRoom(access.dataRoomId, itemId);
  }

  private async breadcrumbInScope(
    access: SharedAccess,
    itemId: string,
  ): Promise<BreadcrumbDto[]> {
    await this.assertInScope(access, itemId);
    const trail = await this.items.getBreadcrumbInRoom(
      access.dataRoomId,
      itemId,
    );
    if (access.rootItemId === null) {
      return trail; // ROOM share: full trail from the room root
    }
    // ITEM share: clamp the trail to start at the shared root — never reveal ancestor names above it.
    const idx = trail.findIndex((crumb) => crumb.id === access.rootItemId);
    return idx >= 0 ? trail.slice(idx) : trail;
  }

  private async contentInScope(
    access: SharedAccess,
    itemId: string,
    disposition: 'inline' | 'attachment',
  ): Promise<ContentUrlDto> {
    await this.assertInScope(access, itemId);
    return this.items.getContentUrlInRoom(
      access.dataRoomId,
      itemId,
      disposition,
    );
  }

  /**
   * Resolve the parent to list within a share. A ROOM share exposes the whole room (any folder in it,
   * or the room root when unset). An ITEM share defaults to the shared folder and rejects any parent
   * outside its subtree (→ 404, no leak) — the anti-escape guard. Room membership is re-checked by
   * `listChildrenInRoom`, so an id from another room is a 404 there.
   */
  private async resolveScopedParent(
    access: SharedAccess,
    parentIdParam: string | null,
  ): Promise<string | null> {
    if (access.rootItemId === null) {
      return parentIdParam;
    }
    if (parentIdParam === null) {
      return access.rootItemId;
    }
    if (!(await this.items.isWithinSubtree(access.rootItemId, parentIdParam))) {
      throw new AppException('items.notFound');
    }
    return parentIdParam;
  }

  /** Reject reads of an item outside the shared scope (→ 404). ROOM shares defer to room membership. */
  private async assertInScope(
    access: SharedAccess,
    itemId: string,
  ): Promise<void> {
    if (access.rootItemId === null) {
      return;
    }
    if (!(await this.items.isWithinSubtree(access.rootItemId, itemId))) {
      throw new AppException('items.notFound');
    }
  }

  /** The caller owns exactly one room; resolve its id (fail closed if somehow missing). */
  private async getRoomId(ownerId: string): Promise<string> {
    const room = await this.prisma.dataRoom.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (!room) {
      throw new AppException('room.notFound');
    }
    return room.id;
  }

  /**
   * Resolve (and authorize) the resource being shared. ROOM ⇒ the caller's own room. ITEM ⇒ an
   * ACTIVE item inside the caller's room; anything else reads as 404 (never 403 — no existence leak).
   */
  private async resolveOwnedResource(
    ownerId: string,
    roomId: string,
    dto: CreateShareDto,
  ): Promise<string> {
    if (dto.resourceType === ShareResourceType.ROOM) {
      return roomId;
    }
    const id = dto.resourceId?.trim();
    if (!id) {
      throw new AppException('share.resourceIdRequired');
    }
    const item = await this.prisma.item.findFirst({
      where: { id, dataRoomId: roomId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!item) {
      throw new AppException('items.notFound');
    }
    return item.id;
  }

  /** A share owned by the caller, or 404 (a foreign share id must not leak as 403). */
  private async getOwnedShareOrThrow(
    ownerId: string,
    shareId: string,
  ): Promise<ShareWithGrants> {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId, ownerId },
      include: { grants: true },
    });
    if (!share) {
      throw new AppException('share.notFound');
    }
    return share;
  }

  /** Upsert one grant per email, linking `userId` when that email already has an account. */
  private async upsertGrants(shareId: string, emails: string[]): Promise<void> {
    if (emails.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const userIdByEmail = new Map(
      users.map((u) => [u.email.toLowerCase(), u.id]),
    );
    await this.prisma.$transaction(
      emails.map((email) => {
        const userId = userIdByEmail.get(email) ?? null;
        return this.prisma.shareGrant.upsert({
          where: { shareId_invitedEmail: { shareId, invitedEmail: email } },
          create: { shareId, invitedEmail: email, userId },
          // Re-link if the invitee has since registered; never unset a known link.
          update: userId ? { userId } : {},
        });
      }),
    );
  }

  private async getShareWithGrants(shareId: string): Promise<ShareWithGrants> {
    return this.prisma.share.findUniqueOrThrow({
      where: { id: shareId },
      include: { grants: true },
    });
  }
}

/** A urlsafe random token embedded in a public share link. */
function generatePublicToken(): string {
  return randomBytes(PUBLIC_TOKEN_BYTES).toString('base64url');
}

/** Trim, lowercase, and de-dupe emails so grants match case-insensitively and never double up. */
function normalizeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (email.length > 0 && !seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}
