import { Module } from '@nestjs/common';
import { featureEnvVar } from '@ruet-chottor/shared';
import { AdminModule } from '../admin/admin.module.js';
import { ClubsModule } from '../clubs/clubs.module.js';
import { NotificationsModule, notificationsOn } from '../notifications/notifications.module.js';
import { UsersModule } from '../users/users.module.js';
import { EventsController } from './events.controller.js';
import { EventsModeration } from './events-moderation.js';
import { EventsService } from './events.service.js';

// Club events only exist when the clubs module is on (it needs admin too, see app.module.ts);
// without it, staff still organise campus-wide events.
const clubsOn = () =>
  process.env[featureEnvVar('clubs')] === 'true' && process.env[featureEnvVar('admin')] === 'true';

// Class events by class representatives need CR verification (users) and reviews that go to
// admin's moderation log; without both, nobody can create one.
const classEventsOn = () =>
  process.env[featureEnvVar('users')] === 'true' && process.env[featureEnvVar('admin')] === 'true';

/**
 * Campus events with RSVPs, organised by club managers, staff and (with review) class
 * representatives. See docs/modules/events.md.
 */
@Module({
  imports: [
    ...(clubsOn() ? [ClubsModule] : []),
    ...(classEventsOn() ? [UsersModule, AdminModule] : []),
    ...(notificationsOn() ? [NotificationsModule] : []),
  ],
  controllers: [EventsController],
  providers: [EventsService, EventsModeration],
})
export class EventsModule {}
