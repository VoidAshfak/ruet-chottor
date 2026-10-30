import { Module } from '@nestjs/common';
import { featureEnvVar } from '@ruet-chottor/shared';
import { ModerationModule } from '../moderation/moderation.module.js';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceModeration } from './marketplace-moderation.js';
import { MarketplaceService } from './marketplace.service.js';

// Holding listings that mention prohibited items needs moderators (moderation needs admin too).
const moderationOn = () =>
  process.env[featureEnvVar('moderation')] === 'true' &&
  process.env[featureEnvVar('admin')] === 'true';

/** Buying and selling between members; payment in person. See docs/modules/marketplace.md. */
@Module({
  imports: [...(moderationOn() ? [ModerationModule] : [])],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, MarketplaceModeration],
})
export class MarketplaceModule {}
