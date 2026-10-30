import { Module } from '@nestjs/common';
import { featureEnvVar } from '@ruet-chottor/shared';
import { AdminModule } from '../admin/admin.module.js';
import { ClubsModule } from '../clubs/clubs.module.js';
import { NotificationsModule, notificationsOn } from '../notifications/notifications.module.js';
import { NewsController } from './news.controller.js';
import { NewsModeration } from './news-moderation.js';
import { NewsService } from './news.service.js';

/**
 * Campus news with moderator review for unverified authors. Reviews go to admin's moderation
 * log, so this module needs FEATURE_ADMIN too. See docs/modules/news.md.
 */
// Posting "as a club" only exists when the clubs module is on (it needs admin too, see app.module.ts).
const clubsOn = () =>
  process.env[featureEnvVar('clubs')] === 'true' && process.env[featureEnvVar('admin')] === 'true';

@Module({
  imports: [
    AdminModule,
    ...(clubsOn() ? [ClubsModule] : []),
    ...(notificationsOn() ? [NotificationsModule] : []),
  ],
  controllers: [NewsController],
  providers: [NewsService, NewsModeration],
})
export class NewsModule {}
