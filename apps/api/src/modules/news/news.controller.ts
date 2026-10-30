import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type ContentActionRequest,
  contentActionRequestSchema,
  type CursorPageQuery,
  cursorPageQuerySchema,
  type NewsApproveRequest,
  newsApproveRequestSchema,
  type NewsFeedQuery,
  newsFeedQuerySchema,
  newsIdParamSchema,
  type NewsPage,
  type NewsPost,
  type NewsPostInput,
  newsPostInputSchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser, Roles } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { NewsService } from './news.service.js';

/** Every route needs a login. Review routes are for staff (`@Roles`, re-checked in the service). */
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  feed(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(newsFeedQuerySchema)) query: NewsFeedQuery,
  ): Promise<NewsPage> {
    return this.news.feed(principal.userId, query);
  }

  // Declared before `:id` so these paths never reach it.
  @Get('mine')
  mine(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: CursorPageQuery,
  ): Promise<NewsPage> {
    return this.news.mine(principal.userId, query);
  }

  @Get('review')
  @Roles('moderator', 'admin')
  reviewQueue(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: CursorPageQuery,
  ): Promise<NewsPage> {
    return this.news.reviewQueue(principal.userId, query);
  }

  @Get(':id')
  get(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(newsIdParamSchema)) params: { id: string },
  ): Promise<NewsPost> {
    return this.news.get(principal.userId, params.id);
  }

  @Post()
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(newsPostInputSchema)) body: NewsPostInput,
  ): Promise<NewsPost> {
    return this.news.create(principal.userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(newsIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(newsPostInputSchema)) body: NewsPostInput,
  ): Promise<NewsPost> {
    return this.news.update(principal.userId, params.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(newsIdParamSchema)) params: { id: string },
  ): Promise<void> {
    return this.news.remove(principal.userId, params.id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles('moderator', 'admin')
  approve(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(newsIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(newsApproveRequestSchema)) body: NewsApproveRequest,
  ): Promise<NewsPost> {
    return this.news.approve(principal.userId, params.id, body.note);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('moderator', 'admin')
  reject(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(newsIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(contentActionRequestSchema)) body: ContentActionRequest,
  ): Promise<NewsPost> {
    return this.news.reject(principal.userId, params.id, body.reason);
  }
}
