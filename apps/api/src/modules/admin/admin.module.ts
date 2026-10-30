import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { ModerationLogService } from './moderation-log.service.js';

/**
 * Admin panel base: manage members (warn, suspend, ban, reinstate, change role) and read the
 * moderation log. ModerationLogService is exported for every module that moderates content.
 * See docs/modules/admin.md.
 */
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, ModerationLogService],
  exports: [ModerationLogService],
})
export class AdminModule {}
