import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module.js';
import { NotificationsModule, notificationsOn } from '../notifications/notifications.module.js';
import { ClubsController } from './clubs.controller.js';
import { ClubsModeration } from './clubs-moderation.js';
import { ClubsService } from './clubs.service.js';

/**
 * Clubs, their managers and members. Appointing a manager changes their role, which is written
 * to admin's moderation log, so this module needs FEATURE_ADMIN too. ClubsService is exported for
 * news (posting as a club). See docs/modules/clubs.md.
 */
@Module({
  imports: [AdminModule, ...(notificationsOn() ? [NotificationsModule] : [])],
  controllers: [ClubsController],
  providers: [ClubsService, ClubsModeration],
  exports: [ClubsService],
})
export class ClubsModule {}
