import { Module } from '@nestjs/common';
import { LostFoundController } from './lost-found.controller.js';
import { LostFoundModeration } from './lost-found-moderation.js';
import { LostFoundService } from './lost-found.service.js';

/** Lost and found board. Contact happens in chat (web only). See docs/modules/lost-found.md. */
@Module({
  controllers: [LostFoundController],
  providers: [LostFoundService, LostFoundModeration],
})
export class LostFoundModule {}
