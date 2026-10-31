import { Module } from '@nestjs/common';
import { featureEnvVar } from '@ruet-chottor/shared';
import { AdminModule } from '../admin/admin.module.js';
import { NotificationsModule, notificationsOn } from '../notifications/notifications.module.js';
import { ClassRepsController } from './class-reps.controller.js';
import { ClassRepsService } from './class-reps.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/** Class rep reviews go to admin's moderation log, so they exist only with FEATURE_ADMIN on. */
const classRepsOn = () => process.env[featureEnvVar('admin')] === 'true';

/**
 * Profiles, contact privacy, first-visit guide state and class representative verification.
 * See docs/modules/users.md.
 */
@Module({
  imports: [
    ...(classRepsOn() ? [AdminModule] : []),
    ...(classRepsOn() && notificationsOn() ? [NotificationsModule] : []),
  ],
  // ClassRepsController first: its `/users/class-reps` must win over `/users/:id`.
  controllers: [...(classRepsOn() ? [ClassRepsController] : []), UsersController],
  providers: [UsersService, ...(classRepsOn() ? [ClassRepsService] : [])],
  exports: [UsersService],
})
export class UsersModule {}
