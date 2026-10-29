import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { DirectoryController } from './directory.controller.js';
import { DirectoryService } from './directory.service.js';

/** Search members by name, roll, department, series and role. See docs/modules/directory.md. */
@Module({
  imports: [UsersModule],
  controllers: [DirectoryController],
  providers: [DirectoryService],
})
export class DirectoryModule {}
