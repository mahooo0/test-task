import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Rename, move, and/or (un)star in one PATCH. Every field is optional and independent.
 * - `name` omitted → name unchanged.
 * - `parentId` omitted → parent unchanged; `null` → move to the room root; id → move there.
 * - `starred` omitted → star state unchanged.
 */
export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  // Validate as a string only when a non-null value is present, so an explicit
  // `null` (move to root) is accepted while a stray number/object is rejected.
  @ValidateIf(
    (o: UpdateItemDto) => o.parentId !== undefined && o.parentId !== null,
  )
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsBoolean()
  starred?: boolean;
}
