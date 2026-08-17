import { Controller, Get, Param, Query } from '@nestjs/common';
import type {
  BreadcrumbDto,
  ContentUrlDto,
  ItemDto,
  Paginated,
} from '@dataroom/types';
import { ListChildrenDto } from '../items/dto/list-children.dto';
import { SharesService, type SharedResourceView } from './shares.service';

const DEFAULT_PAGE_SIZE = 50;

/**
 * Anonymous public-link surface — the token in the URL is the only credential (NO auth guard).
 * Every read is confined to the shared resource's subtree by the service; ids outside it read as 404.
 */
@Controller('public/shares')
export class PublicSharesController {
  constructor(private readonly shares: SharesService) {}

  @Get(':token')
  resolve(@Param('token') token: string): Promise<SharedResourceView> {
    return this.shares.resolvePublic(token);
  }

  @Get(':token/items')
  list(
    @Param('token') token: string,
    @Query() query: ListChildrenDto,
  ): Promise<Paginated<ItemDto>> {
    return this.shares.publicListing(
      token,
      normalizeParent(query.parentId),
      query.cursor ?? null,
      query.limit ?? DEFAULT_PAGE_SIZE,
      query.sort ?? 'name',
      query.dir ?? 'asc',
    );
  }

  @Get(':token/items/:id')
  get(
    @Param('token') token: string,
    @Param('id') id: string,
  ): Promise<ItemDto> {
    return this.shares.publicItem(token, id);
  }

  @Get(':token/items/:id/breadcrumb')
  breadcrumb(
    @Param('token') token: string,
    @Param('id') id: string,
  ): Promise<BreadcrumbDto[]> {
    return this.shares.publicBreadcrumb(token, id);
  }

  @Get(':token/items/:id/preview')
  preview(
    @Param('token') token: string,
    @Param('id') id: string,
  ): Promise<ContentUrlDto> {
    return this.shares.publicContent(token, id, 'inline');
  }

  @Get(':token/items/:id/download')
  download(
    @Param('token') token: string,
    @Param('id') id: string,
  ): Promise<ContentUrlDto> {
    return this.shares.publicContent(token, id, 'attachment');
  }
}

/** `root`/absent ⇒ the shared root (null sentinel); any other value is a specific folder id. */
function normalizeParent(parentId?: string): string | null {
  return !parentId || parentId === 'root' ? null : parentId;
}
