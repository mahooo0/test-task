import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Query for the flat, cross-folder search (⌘K palette + results page filters). */
export class SearchItemsDto {
  /**
   * The search term — matched case-insensitively as a substring of item names. Optional: an empty
   * term returns everything (name-ordered), which the results page uses to browse by filter alone.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  /** Max results to return (the controller supplies the default when omitted). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
