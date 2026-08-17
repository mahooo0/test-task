import type {
  BreadcrumbDto,
  ContentUrlDto,
  DataRoomDto,
  ItemDto,
  ItemSortField,
  Paginated,
  SortDirection,
  SubtreeStatsDto,
  UploadTicketDto,
} from '@dataroom/types';
import { api } from '@/lib/api-client';

/** Body for the presign step — one call per file about to be uploaded. */
export interface PresignBody {
  parentId: string | null;
  name: string;
  sizeBytes: number;
  mimeType: string;
}

/** Clerk bearer token, or null while the session is still hydrating. */
type Token = string | null;

/** Server-side rename/move payload. Omitted fields are left unchanged; `parentId: null` moves to root. */
export interface UpdateItemBody {
  name?: string;
  parentId?: string | null;
  starred?: boolean;
}

/**
 * Thin, typed wrapper over the drive endpoints (feature #3). Each call takes the
 * caller's Clerk token; the API scopes every route to the caller's single room.
 */
export const itemsApi = {
  getRoom: (token: Token) => api.get<DataRoomDto>('/api/me/room', token),

  getRoomStats: (token: Token) => api.get<SubtreeStatsDto>('/api/me/room/stats', token),

  listChildren: (
    token: Token,
    parentId: string | null,
    cursor: string | null,
    limit = 50,
    sort?: ItemSortField,
    dir?: SortDirection,
  ) => {
    const params = new URLSearchParams({ parentId: parentId ?? 'root', limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (sort) params.set('sort', sort);
    if (dir) params.set('dir', dir);
    return api.get<Paginated<ItemDto>>(`/api/items?${params.toString()}`, token);
  },

  /**
   * Flat name search across the whole room (⌘K palette + results page). An empty term returns the
   * whole room (name-ordered) so the results page can browse by filter alone; the enabling of that
   * call is decided by the caller (see {@link import('./hooks').useItemSearch}).
   */
  search: (token: Token, query: string, limit = 20) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return api.get<ItemDto[]>(`/api/items/search?${params.toString()}`, token);
  },

  getItem: (token: Token, id: string) => api.get<ItemDto>(`/api/items/${id}`, token),

  breadcrumb: (token: Token, id: string) =>
    api.get<BreadcrumbDto[]>(`/api/items/${id}/breadcrumb`, token),

  subtreeStats: (token: Token, id: string) =>
    api.get<SubtreeStatsDto>(`/api/items/${id}/stats`, token),

  /**
   * Create a folder. `onConflict` defaults to `'error'` (reject a name clash so the dialog can warn);
   * folder uploads pass `'suffix'` to auto-suffix (`Reports (1)`) instead of failing.
   */
  createFolder: (
    token: Token,
    parentId: string | null,
    name: string,
    onConflict: 'error' | 'suffix' = 'error',
  ) => api.post<ItemDto>('/api/folders', { parentId, name, onConflict }, token),

  updateItem: (token: Token, id: string, body: UpdateItemBody) =>
    api.patch<ItemDto>(`/api/items/${id}`, body, token),

  /** Move an item to the Trash (soft delete — reversible via {@link restoreItem}). */
  deleteItem: (token: Token, id: string) => api.del<void>(`/api/items/${id}`, token),

  /** The Trash — every trashed root in the caller's room. */
  listTrash: (token: Token) => api.get<ItemDto[]>('/api/trash', token),
  /** Restore a trashed item (and the subtree trashed with it) back to the drive. */
  restoreItem: (token: Token, id: string) =>
    api.post<ItemDto>(`/api/items/${id}/restore`, undefined, token),
  /** Permanently delete a single trashed item — irreversible. */
  deleteForever: (token: Token, id: string) => api.del<void>(`/api/trash/${id}`, token),
  /** Empty the Trash — permanently delete everything in it. */
  emptyTrash: (token: Token) => api.del<void>('/api/trash', token),

  /** The "Помеченные" view — every starred item in the room. (Star/unstar goes through updateItem.) */
  listStarred: (token: Token) => api.get<ItemDto[]>('/api/starred', token),

  // ── Uploads (per-file presign → direct R2 PUT → finalize) ──
  presignUpload: (token: Token, body: PresignBody) =>
    api.post<UploadTicketDto>('/api/uploads/presign', body, token),

  finalizeUpload: (token: Token, id: string) =>
    api.post<ItemDto>(`/api/items/${id}/finalize`, undefined, token),

  previewUrl: (token: Token, id: string) =>
    api.get<ContentUrlDto>(`/api/items/${id}/preview`, token),

  downloadUrl: (token: Token, id: string) =>
    api.get<ContentUrlDto>(`/api/items/${id}/download`, token),
};
