import type { ShareMode, ShareResourceType, ShareRole } from './enums';
import type { ItemDto } from './item';

/** A single invited user for a RESTRICTED share. */
export interface ShareGrantDto {
  id: string;
  invitedEmail: string;
  userId: string | null;
  role: ShareRole;
}

/** A share of a Data Room or Item, in public-link or restricted mode. */
export interface ShareDto {
  id: string;
  resourceType: ShareResourceType;
  resourceId: string;
  mode: ShareMode;
  role: ShareRole;
  /** Present only for PUBLIC shares — the token embedded in the shareable link. */
  publicToken: string | null;
  /** Invited users, present only for RESTRICTED shares. */
  grants: ShareGrantDto[];
  createdAt: string;
  revokedAt: string | null;
}

/** Owner display info attached to a shared resource; `email` is withheld on the anonymous public surface. */
export interface ShareOwnerDto {
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * What a non-owner sees when they open a share (public link or "shared with me") — enough to render
 * the shared page header + a shared-with-me row. Reads within the share stay confined to `root`'s
 * subtree (or the whole room for a ROOM share, where `root` is null).
 */
export interface SharedResourceView {
  shareId: string;
  mode: ShareMode;
  resourceType: ShareResourceType;
  role: ShareRole;
  /** The shared root item (folder/file); null for a ROOM share (root = the room itself). */
  root: ItemDto | null;
  roomName: string;
  owner: ShareOwnerDto;
  /** ISO timestamp the share was created (the "shared with me" date). */
  sharedAt: string;
}

/** Request body to create (or reuse) a share of the caller's room or one of its items. */
export interface CreateShareBody {
  resourceType: ShareResourceType;
  /** The item id for an ITEM share; omitted for a ROOM share. */
  resourceId?: string;
  mode: ShareMode;
  /** Emails to invite (RESTRICTED only). */
  invitedEmails?: string[];
}
