import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  type CursorPageQuery,
  cursorPageQuerySchema,
  type Notification,
  notificationIdParamSchema,
  type NotificationPage,
  type UnreadCount,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { NotificationsService } from './notifications.service.js';

/** A member's own notifications. Every route needs a login (global AuthGuard). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: CursorPageQuery,
  ): Promise<NotificationPage> {
    return this.notifications.list(principal.userId, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() principal: Principal): Promise<UnreadCount> {
    return this.notifications.unreadCount(principal.userId);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() principal: Principal): Promise<void> {
    await this.notifications.markAllRead(principal.userId);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(notificationIdParamSchema)) params: { id: string },
  ): Promise<Notification> {
    return this.notifications.markRead(principal.userId, params.id);
  }
}
