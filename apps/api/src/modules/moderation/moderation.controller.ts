import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  type ContentActionParams,
  contentActionParamsSchema,
  type ContentActionRequest,
  contentActionRequestSchema,
  type ContentItemParams,
  contentItemParamsSchema,
  type CreateReportRequest,
  createReportRequestSchema,
  type ModerationItemDetail,
  type ModerationQueuePage,
  type ModerationQueueQuery,
  moderationQueueQuerySchema,
  type MyReportsQuery,
  myReportsQuerySchema,
  type MyReportsResponse,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser, Roles } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { ModerationService } from './moderation.service.js';

/**
 * Reporting is open to every logged-in member; the queue and actions are for staff only
 * (`@Roles` here, and the role is checked again from the database in the service).
 */
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('reports')
  @HttpCode(204)
  report(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(createReportRequestSchema)) body: CreateReportRequest,
  ): Promise<void> {
    return this.moderation.report(principal.userId, body);
  }

  @Get('reports/mine')
  mine(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(myReportsQuerySchema)) query: MyReportsQuery,
  ): Promise<MyReportsResponse> {
    return this.moderation.mine(principal.userId, query);
  }

  @Get('queue')
  @Roles('moderator', 'admin')
  queue(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(moderationQueueQuerySchema)) query: ModerationQueueQuery,
  ): Promise<ModerationQueuePage> {
    return this.moderation.queue(principal.userId, query);
  }

  @Get('items/:contentType/:contentId')
  @Roles('moderator', 'admin')
  item(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(contentItemParamsSchema)) params: ContentItemParams,
  ): Promise<ModerationItemDetail> {
    return this.moderation.item(principal.userId, params.contentType, params.contentId);
  }

  @Post('items/:contentType/:contentId/:action')
  @HttpCode(200)
  @Roles('moderator', 'admin')
  act(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(contentActionParamsSchema)) params: ContentActionParams,
    @Body(new ZodValidationPipe(contentActionRequestSchema)) body: ContentActionRequest,
  ): Promise<ModerationItemDetail> {
    return this.moderation.act(
      principal.userId,
      params.contentType,
      params.contentId,
      params.action,
      body.reason,
    );
  }
}
