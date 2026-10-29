import { Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';
import { featureEnvVar, type ModuleKey } from '@ruet-chottor/shared';
import { CoreModule } from './core/core.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

const enabled = (key: ModuleKey) => (env: NodeJS.ProcessEnv) => env[featureEnvVar(key)] === 'true';

// Each feature module is registered only when its FEATURE_<MODULE> flag is "true".
// See the `add-feature-module` skill.
@Module({
  imports: [CoreModule, ConditionalModule.registerWhen(AuthModule, enabled('auth'))],
})
export class AppModule {}
