import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEmail } from 'class-validator';

/** Add invited emails to an existing RESTRICTED share. */
export class AddGrantsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsEmail({}, { each: true })
  emails!: string[];
}
