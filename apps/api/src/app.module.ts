import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module.js';

// Feature modules are registered here behind their FEATURE_<MODULE> flag.
// See the `add-feature-module` skill.
@Module({
  imports: [CoreModule],
})
export class AppModule {}
