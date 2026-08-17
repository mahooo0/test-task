import type { ItemSortField, SortDirection } from '@dataroom/types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListChildrenDto {
  /** Parent folder id, or the literal `root` for the room root. Defaults to the root. */
  @IsOptional()
  @IsString()
  parentId?: string;

  /** Opaque keyset cursor from the previous page's `nextCursor`. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Sort field — folders always group first; this orders within each group. Defaults to `name`. */
  @IsOptional()
  @IsIn(['name', 'modified', 'created', 'size'])
  sort?: ItemSortField;

  /** Sort direction. Defaults to `asc`. */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: SortDirection;
}
