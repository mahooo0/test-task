import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type {
  BreadcrumbDto,
  ContentUrlDto,
  ItemDto,
  Paginated,
} from '@dataroom/types';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { ListChildrenDto } from '../items/dto/list-children.dto';
import { SharesService, type SharedResourceView } from './shares.service';

const DEFAULT_PAGE_SIZE = 50;

/**
 * "Shared with me" surface — an authenticated non-owner reading a RESTRICTED share they were invited
 * to. Access is authorized by grant (linked user id or invited email), and every read is confined to
 * the shared subtree by the service. A share the caller has no grant on reads as 404 (no 403 leak).
 */
@Controller('shared')
@UseGuards(ClerkAuthGuard)
export class SharedController {
  constructor(private readonly shares: SharesService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser): Promise<SharedResourceView[]> {
    return this.shares.listSharedWithMe(user.id, user.email);
  }

  @Get(':shareId')
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('shareId') shareId: string,
  ): Promise<SharedResourceView> {
    return this.shares.resolveGrantee(user.id, user.email, shareId);
  }

  @Get(':shareId/items')
  list(
    @CurrentUser() user: AuthUser,
    @Param('shareId') shareId: string,
    @Query() query: ListChildrenDto,
  ): Promise<Paginated<ItemDto>> {
    return this.shares.granteeListing(
      user.id,
      user.email,
      shareId,
      normalizeParent(query.parentId),
      query.cursor ?? null,
      query.limit ?? DEFAULT_PAGE_SIZE,
      query.sort ?? 'name',
      query.dir ?? 'asc',
    );
  }

  @Get(':shareId/items/:id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('shareId') shareId: string,
    @Param('id') id: string,
  ): Promise<ItemDto> {
    return this.shares.granteeItem(user.id, user.email, shareId, id);
  }

  @Get(':shareId/items/:id/breadcrumb')
  breadcrumb(
    @CurrentUser() user: AuthUser,
    @Param('shareId') shareId: string,
    @Param('id') id: string,
  ): Promise<BreadcrumbDto[]> {
    return this.shares.granteeBreadcrumb(user.id, user.email, shareId, id);
  }

  @Get(':shareId/items/:id/preview')
  preview(
    @CurrentUser() user: AuthUser,
    @Param('shareId') shareId: string,
    @Param('id') id: string,
  ): Promise<ContentUrlDto> {
    return this.shares.granteeContent(
      user.id,
      user.email,
      shareId,
      id,
      'inline',
    );
  }

  @Get(':shareId/items/:id/download')
  download(
    @CurrentUser() user: AuthUser,
    @Param('shareId') shareId: string,
    @Param('id') id: string,
  ): Promise<ContentUrlDto> {
    return this.shares.granteeContent(
      user.id,
      user.email,
      shareId,
      id,
      'attachment',
    );
  }
}

/** `root`/absent ⇒ the shared root (null sentinel); any other value is a specific folder id. */
function normalizeParent(parentId?: string): string | null {
  return !parentId || parentId === 'root' ? null : parentId;
}
