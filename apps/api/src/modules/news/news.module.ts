import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module.js';
import { NewsController } from './news.controller.js';
import { NewsModeration } from './news-moderation.js';
import { NewsService } from './news.service.js';

/**
 * Campus news with moderator review for unverified authors. Reviews go to admin's moderation
 * log, so this module needs FEATURE_ADMIN too. See docs/modules/news.md.
 */
@Module({
  imports: [AdminModule],
  controllers: [NewsController],
  providers: [NewsService, NewsModeration],
})
export class NewsModule {}
