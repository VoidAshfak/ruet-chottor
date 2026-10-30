import { Module } from '@nestjs/common';
import { featureEnvVar } from '@ruet-chottor/shared';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationsRealtime } from './notifications-realtime.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Notifications are on when their flag is (they need auth). Other modules import this module only
 * when `notificationsOn()` and inject `NotificationsService` as optional, so they work without it.
 */
export const notificationsOn = () =>
  process.env[featureEnvVar('notifications')] === 'true' &&
  process.env[featureEnvVar('auth')] === 'true';

/** The in-app inbox: bell, list, live updates. See docs/modules/notifications.md. */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, NotificationsRealtime],
  exports: [NotificationsService],
})
export class NotificationsModule {}
