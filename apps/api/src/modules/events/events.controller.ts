import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type CampusEvent,
  type CursorPageQuery,
  cursorPageQuerySchema,
  type EventAttendees,
  eventIdParamSchema,
  type EventInput,
  eventInputSchema,
  type EventList,
  type EventRangeQuery,
  type EventReviewPage,
  type ReasonRequest,
  reasonRequestSchema,
  eventRangeQuerySchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser, Roles } from '../../core/auth/decorators.js';
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

  // Declared before `:id` so "review" is never read as an event id.
  @Get('review')
  @Roles('moderator', 'admin')
  reviewQueue(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: CursorPageQuery,
  ): Promise<EventReviewPage> {
    return this.events.reviewQueue(principal.userId, query);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles('moderator', 'admin')
  approve(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(eventIdParamSchema)) params: { id: string },
  ): Promise<CampusEvent> {
    return this.events.approve(principal.userId, params.id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('moderator', 'admin')
  reject(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(eventIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(reasonRequestSchema)) body: ReasonRequest,
  ): Promise<CampusEvent> {
    return this.events.reject(principal.userId, params.id, body.reason);
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
