import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFolderDto {
  /** Parent folder id. `null` or omitted creates the folder at the room root. */
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /**
   * How to handle a sibling-name clash. `'error'` (default) rejects with 409 — the "New folder"
   * action. `'suffix'` auto-suffixes (`Reports (1)`) — used by folder uploads so they never fail.
   */
  @IsOptional()
  @IsIn(['error', 'suffix'])
  onConflict?: 'error' | 'suffix';
}
