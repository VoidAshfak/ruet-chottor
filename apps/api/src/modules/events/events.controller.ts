import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type CampusEvent,
  type EventAttendees,
  eventIdParamSchema,
  type EventInput,
  eventInputSchema,
  type EventList,
  type EventRangeQuery,
  eventRangeQuerySchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { EventsService } from './events.service.js';

/** Every route needs a login; who may organise and edit is checked in the service. */
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  range(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(eventRangeQuerySchema)) query: EventRangeQuery,
  ): Promise<EventList> {
    return this.events.range(principal.userId, query);
  }

  @Get(':id')
  get(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(eventIdParamSchema)) params: { id: string },
  ): Promise<CampusEvent> {
    return this.events.get(principal.userId, params.id);
  }

  @Post()
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(eventInputSchema)) body: EventInput,
  ): Promise<CampusEvent> {
    return this.events.create(principal.userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(eventIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(eventInputSchema)) body: EventInput,
  ): Promise<CampusEvent> {
    return this.events.update(principal.userId, params.id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(eventIdParamSchema)) params: { id: string },
  ): Promise<CampusEvent> {
    return this.events.cancel(principal.userId, params.id);
  }

  @Post(':id/rsvp')
  @HttpCode(200)
  going(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(eventIdParamSchema)) params: { id: string },
  ): Promise<CampusEvent> {
    return this.events.going(principal.userId, params.id);
  }

  @Delete(':id/rsvp')
  notGoing(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(eventIdParamSchema)) params: { id: string },
  ): Promise<CampusEvent> {
    return this.events.notGoing(principal.userId, params.id);
  }

  @Get(':id/attendees')
  attendees(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(eventIdParamSchema)) params: { id: string },
  ): Promise<EventAttendees> {
    return this.events.attendees(principal.userId, params.id);
  }
}
