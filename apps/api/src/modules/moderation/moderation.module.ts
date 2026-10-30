import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module.js';
import { ModerationController } from './moderation.controller.js';
import { ModerationService } from './moderation.service.js';

/**
 * Reports on user-generated content and the staff queue. Content types plug in through
 * ModeratableContentRegistry (core); actions go to admin's ModerationLogService.
 * See docs/modules/moderation.md.
 */
@Module({
  imports: [AdminModule],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
