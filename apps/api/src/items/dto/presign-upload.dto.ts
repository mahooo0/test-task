import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/** Body of `POST /uploads/presign` — one call per file the client wants to upload. */
export class PresignUploadDto {
  /** Destination folder id. `null` or omitted uploads to the room root. */
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /**
   * Client-reported byte size — used only for the pre-sign size-cap check.
   * Finalize reads the authoritative size from R2 and never trusts this value.
   */
  @IsInt()
  @IsPositive()
  sizeBytes!: number;

  /** Browser-reported MIME type; signed into the PUT so the upload's Content-Type must match. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mimeType!: string;
}
