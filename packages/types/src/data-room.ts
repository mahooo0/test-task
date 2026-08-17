export interface DataRoomDto {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/** Aggregated stats for a Data Room or folder, computed over its whole subtree. */
export interface SubtreeStatsDto {
  totalSizeBytes: number;
  fileCount: number;
  folderCount: number;
}
