import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  BreadcrumbDto,
  ContentUrlDto,
  ItemDto,
  Paginated,
  SubtreeStatsDto,
  UploadTicketDto,
} from '@dataroom/types';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DEFAULT_PAGE_SIZE, normalizeParent } from '../common/listing';
import type { AuthUser } from '../common/types/auth-user';
import { ItemsService } from './items.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { ListChildrenDto } from './dto/list-children.dto';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { SearchItemsDto } from './dto/search-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';

const DEFAULT_SEARCH_LIMIT = 20;

/**
 * The owner's drive surface. Every route is scoped to the caller's single Data Room
 * (resolved in the service); items outside it read as `404`, never `403` — no leak.
 */
@Controller()
@UseGuards(ClerkAuthGuard)
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get('items')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListChildrenDto,
  ): Promise<Paginated<ItemDto>> {
    const parentId = normalizeParent(query.parentId);
    return this.items.listChildren(
      user.id,
      parentId,
      query.cursor ?? null,
      query.limit ?? DEFAULT_PAGE_SIZE,
      query.sort ?? 'name',
      query.dir ?? 'asc',
    );
  }

  /**
   * Flat name search across the whole room for the ⌘K palette. Declared before `items/:id` so a GET
   * to `/api/items/search` routes here instead of being read as an item with id `search`.
   */
  @Get('items/search')
  search(
    @CurrentUser() user: AuthUser,
    @Query() query: SearchItemsDto,
  ): Promise<ItemDto[]> {
    return this.items.searchItems(
      user.id,
      query.q ?? '',
      query.limit ?? DEFAULT_SEARCH_LIMIT,
    );
  }

  @Post('folders')
  createFolder(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFolderDto,
  ): Promise<ItemDto> {
    return this.items.createFolder(
      user.id,
      dto.parentId ?? null,
      dto.name,
      dto.onConflict ?? 'error',
    );
  }

  @Get('items/:id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ItemDto> {
    return this.items.getItem(user.id, id);
  }

  @Get('items/:id/breadcrumb')
  breadcrumb(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<BreadcrumbDto[]> {
    return this.items.getBreadcrumb(user.id, id);
  }

  @Get('items/:id/stats')
  stats(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<SubtreeStatsDto> {
    return this.items.getStats(user.id, id);
  }

  /** Step 1 of an upload: reserve a PENDING file row + get a presigned PUT URL. */
  @Post('uploads/presign')
  presignUpload(
    @CurrentUser() user: AuthUser,
    @Body() dto: PresignUploadDto,
  ): Promise<UploadTicketDto> {
    return this.items.presignUpload(user.id, dto);
  }

  /** Step 2 of an upload: confirm the R2 PUT, flip the row PENDING→ACTIVE. */
  @Post('items/:id/finalize')
  @HttpCode(200)
  finalizeUpload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ItemDto> {
    return this.items.finalizeUpload(user.id, id);
  }

  @Get('items/:id/preview')
  preview(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ContentUrlDto> {
    return this.items.getContentUrl(user.id, id, 'inline');
  }

  @Get('items/:id/download')
  download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ContentUrlDto> {
    return this.items.getContentUrl(user.id, id, 'attachment');
  }

  @Patch('items/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ): Promise<ItemDto> {
    return this.items.updateItem(user.id, id, dto);
  }

  /** Move an item to the Trash (soft delete — reversible via restore). */
  @Delete('items/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.items.trashItem(user.id, id);
  }

  /** The Trash — every trashed root in the caller's room. */
  @Get('trash')
  trash(@CurrentUser() user: AuthUser): Promise<ItemDto[]> {
    return this.items.listTrash(user.id);
  }

  /** The "Помеченные" view — every starred item in the room. */
  @Get('starred')
  starred(@CurrentUser() user: AuthUser): Promise<ItemDto[]> {
    return this.items.listStarred(user.id);
  }

  /** Restore a trashed item (and the subtree trashed with it) back to the drive. */
  @Post('items/:id/restore')
  @HttpCode(200)
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ItemDto> {
    return this.items.restoreItem(user.id, id);
  }

  /** Permanently delete a single trashed item (+ its subtree) — irreversible. */
  @Delete('trash/:id')
  @HttpCode(204)
  deleteForever(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.items.deleteForever(user.id, id);
  }

  /** Empty the Trash — permanently delete everything in it. */
  @Delete('trash')
  @HttpCode(204)
  emptyTrash(@CurrentUser() user: AuthUser): Promise<void> {
    return this.items.emptyTrash(user.id);
  }
}
