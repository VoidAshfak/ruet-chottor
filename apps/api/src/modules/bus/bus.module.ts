import { Module } from '@nestjs/common';
import { BusController } from './bus.controller.js';
import { BusService } from './bus.service.js';

/** The campus bus timetable and notices, edited by admins. See docs/modules/bus.md. */
@Module({
  controllers: [BusController],
  providers: [BusService],
})
export class BusModule {}
