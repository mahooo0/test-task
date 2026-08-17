import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ShareMode, ShareResourceType } from '@dataroom/types';

/** Create (or reuse) a share of the caller's whole room or one of its items. */
export class CreateShareDto {
  /** ROOM shares the caller's whole drive; ITEM shares a single folder/file (and its subtree). */
  @IsEnum(ShareResourceType)
  resourceType!: ShareResourceType;

  /** The item id for an ITEM share; ignored for a ROOM share (the caller's own room is used). */
  @IsOptional()
  @IsString()
  resourceId?: string;

  /** PUBLIC → anyone with the generated link; RESTRICTED → only the invited emails. */
  @IsEnum(ShareMode)
  mode!: ShareMode;

  /** Emails to invite (RESTRICTED only). Ignored for PUBLIC shares. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsEmail({}, { each: true })
  invitedEmails?: string[];
}
