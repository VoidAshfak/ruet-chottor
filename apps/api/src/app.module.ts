import { Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';
import { featureEnvVar, type ModuleKey } from '@ruet-chottor/shared';
import { CoreModule } from './core/core.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { DirectoryModule } from './modules/directory/directory.module.js';
import { ModerationModule } from './modules/moderation/moderation.module.js';
import { UsersModule } from './modules/users/users.module.js';

const enabled = (key: ModuleKey) => (env: NodeJS.ProcessEnv) => env[featureEnvVar(key)] === 'true';

// Each feature module is registered only when its FEATURE_<MODULE> flag is "true".
// See the `add-feature-module` skill.
@Module({
  imports: [
    CoreModule,
    ConditionalModule.registerWhen(AuthModule, enabled('auth')),
    ConditionalModule.registerWhen(UsersModule, enabled('users')),
    ConditionalModule.registerWhen(DirectoryModule, enabled('directory')),
    ConditionalModule.registerWhen(AdminModule, enabled('admin')),
    ConditionalModule.registerWhen(ChatModule, enabled('chat')),
    // Moderation writes to admin's moderation log, so it needs both flags.
    ConditionalModule.registerWhen(
      ModerationModule,
      (env) => enabled('moderation')(env) && enabled('admin')(env),
    ),
  ],
})
export class AppModule {}
