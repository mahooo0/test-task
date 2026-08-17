import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ShareResourceType } from '@dataroom/types';

/** Optional filter for listing the caller's shares by the resource they point at. */
export class ListSharesDto {
  @IsOptional()
  @IsEnum(ShareResourceType)
  resourceType?: ShareResourceType;

  @IsOptional()
  @IsString()
  resourceId?: string;
}
