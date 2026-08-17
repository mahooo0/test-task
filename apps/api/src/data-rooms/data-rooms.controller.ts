import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { DataRoomDto, SubtreeStatsDto } from '@dataroom/types';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { DataRoomsService } from './data-rooms.service';
import { toDataRoomDto } from './data-rooms.mapper';
import { RenameDataRoomDto } from './dto/rename-data-room.dto';

@Controller('me/room')
@UseGuards(ClerkAuthGuard)
export class DataRoomsController {
  constructor(private readonly dataRooms: DataRoomsService) {}

  @Get()
  async getRoom(@CurrentUser() user: AuthUser): Promise<DataRoomDto> {
    return toDataRoomDto(await this.dataRooms.getRoomForUser(user.id));
  }

  @Patch()
  async rename(
    @CurrentUser() user: AuthUser,
    @Body() dto: RenameDataRoomDto,
  ): Promise<DataRoomDto> {
    return toDataRoomDto(await this.dataRooms.renameRoom(user.id, dto.name));
  }

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser): Promise<SubtreeStatsDto> {
    return this.dataRooms.getRoomStats(user.id);
  }
}
