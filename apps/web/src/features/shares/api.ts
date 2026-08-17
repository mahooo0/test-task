import type {
  BreadcrumbDto,
  ContentUrlDto,
  CreateShareBody,
  ItemDto,
  Paginated,
  ShareDto,
  SharedResourceView,
} from '@dataroom/types';
import { api } from '@/lib/api-client';

/** Clerk bearer token, or null (anonymous public-link calls pass null). */
type Token = string | null;

function listQuery(parentId: string | null, cursor: string | null, limit: number): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (parentId) params.set('parentId', parentId);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

/**
 * Sharing endpoints. Owner-side management is Clerk-scoped; the "shared with me" (grantee) surface is
 * authorized by grant; the public-link surface is anonymous (token in the path, no bearer).
 */
export const sharesApi = {
  // ── owner: manage shares of your own items ──
  list: (token: Token, resourceId?: string) =>
    api.get<ShareDto[]>(
      `/api/shares${resourceId ? `?resourceId=${encodeURIComponent(resourceId)}` : ''}`,
      token,
    ),
  create: (token: Token, body: CreateShareBody) =>
    api.post<ShareDto>('/api/shares', body, token),
  addGrants: (token: Token, shareId: string, emails: string[]) =>
    api.post<ShareDto>(`/api/shares/${shareId}/grants`, { emails }, token),
  removeGrant: (token: Token, shareId: string, grantId: string) =>
    api.del<ShareDto>(`/api/shares/${shareId}/grants/${grantId}`, token),
  revoke: (token: Token, shareId: string) => api.del<void>(`/api/shares/${shareId}`, token),

  // ── grantee: "shared with me" (authenticated, authorized by grant) ──
  sharedWithMe: (token: Token) => api.get<SharedResourceView[]>('/api/shared', token),
  resolveGrantee: (token: Token, shareId: string) =>
    api.get<SharedResourceView>(`/api/shared/${shareId}`, token),
  granteeList: (
    token: Token,
    shareId: string,
    parentId: string | null,
    cursor: string | null,
    limit = 50,
  ) =>
    api.get<Paginated<ItemDto>>(
      `/api/shared/${shareId}/items?${listQuery(parentId, cursor, limit)}`,
      token,
    ),
  granteeBreadcrumb: (token: Token, shareId: string, itemId: string) =>
    api.get<BreadcrumbDto[]>(`/api/shared/${shareId}/items/${itemId}/breadcrumb`, token),
  granteePreviewUrl: (token: Token, shareId: string, itemId: string) =>
    api.get<ContentUrlDto>(`/api/shared/${shareId}/items/${itemId}/preview`, token),
  granteeDownloadUrl: (token: Token, shareId: string, itemId: string) =>
    api.get<ContentUrlDto>(`/api/shared/${shareId}/items/${itemId}/download`, token),

  // ── public link (anonymous — token is the path credential) ──
  resolvePublic: (linkToken: string) =>
    api.get<SharedResourceView>(`/api/public/shares/${linkToken}`, null),
  publicList: (linkToken: string, parentId: string | null, cursor: string | null, limit = 50) =>
    api.get<Paginated<ItemDto>>(
      `/api/public/shares/${linkToken}/items?${listQuery(parentId, cursor, limit)}`,
      null,
    ),
  publicBreadcrumb: (linkToken: string, itemId: string) =>
    api.get<BreadcrumbDto[]>(`/api/public/shares/${linkToken}/items/${itemId}/breadcrumb`, null),
  publicPreviewUrl: (linkToken: string, itemId: string) =>
    api.get<ContentUrlDto>(`/api/public/shares/${linkToken}/items/${itemId}/preview`, null),
  publicDownloadUrl: (linkToken: string, itemId: string) =>
    api.get<ContentUrlDto>(`/api/public/shares/${linkToken}/items/${itemId}/download`, null),
};
