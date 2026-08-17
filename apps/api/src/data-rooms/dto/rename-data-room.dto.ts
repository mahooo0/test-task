import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameDataRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
