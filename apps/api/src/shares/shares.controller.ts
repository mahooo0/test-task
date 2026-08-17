import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ShareDto } from '@dataroom/types';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { SharesService } from './shares.service';
import { AddGrantsDto } from './dto/add-grants.dto';
import { CreateShareDto } from './dto/create-share.dto';
import { ListSharesDto } from './dto/list-shares.dto';

/**
 * Owner-side share management. Every route is scoped to the caller — a share/resource they don't
 * own reads as `404`, never `403`. The anonymous public-link surface and grantee reads live
 * elsewhere (the shared-read controller), not here.
 */
@Controller('shares')
@UseGuards(ClerkAuthGuard)
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateShareDto,
  ): Promise<ShareDto> {
    return this.shares.createShare(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListSharesDto,
  ): Promise<ShareDto[]> {
    return this.shares.listShares(user.id, query);
  }

  @Post(':id/grants')
  addGrants(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddGrantsDto,
  ): Promise<ShareDto> {
    return this.shares.addGrants(user.id, id, dto.emails);
  }

  @Delete(':id/grants/:grantId')
  removeGrant(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('grantId') grantId: string,
  ): Promise<ShareDto> {
    return this.shares.removeGrant(user.id, id, grantId);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.shares.revokeShare(user.id, id);
  }
}
