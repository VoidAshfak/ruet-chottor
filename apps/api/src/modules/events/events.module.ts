import { Module } from '@nestjs/common';
import { featureEnvVar } from '@ruet-chottor/shared';
import { ClubsModule } from '../clubs/clubs.module.js';
import { NotificationsModule, notificationsOn } from '../notifications/notifications.module.js';
import { EventsController } from './events.controller.js';
import { EventsModeration } from './events-moderation.js';
import { EventsService } from './events.service.js';

// Club events only exist when the clubs module is on (it needs admin too, see app.module.ts);
// without it, staff still organise campus-wide events.
const clubsOn = () =>
  process.env[featureEnvVar('clubs')] === 'true' && process.env[featureEnvVar('admin')] === 'true';

/** Campus events with RSVPs, organised by club managers and staff. See docs/modules/events.md. */
@Module({
  imports: [
    ...(clubsOn() ? [ClubsModule] : []),
    ...(notificationsOn() ? [NotificationsModule] : []),
  ],
  controllers: [EventsController],
  providers: [EventsService, EventsModeration],
})
export class EventsModule {}
