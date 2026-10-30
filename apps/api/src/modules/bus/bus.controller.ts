import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  type BusListQuery,
  busListQuerySchema,
  busIdParamSchema,
  type BusNotice,
  type BusNoticeInput,
  busNoticeInputSchema,
  type BusNoticeList,
  type BusRoute,
  type BusRouteInput,
  busRouteInputSchema,
  type BusRouteList,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser, Roles } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { BusService } from './bus.service.js';

/**
 * Reading needs a login; editing is for admins (`@Roles('admin')`, re-checked in the service from
 * the database).
 */
@Controller('bus')
export class BusController {
  constructor(private readonly bus: BusService) {}

  @Get('routes')
  routes(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(busListQuerySchema)) query: BusListQuery,
  ): Promise<BusRouteList> {
    return this.bus.routes(principal.userId, query.all);
  }

  @Get('routes/:id')
  route(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(busIdParamSchema)) params: { id: string },
  ): Promise<BusRoute> {
    return this.bus.route(principal.userId, params.id);
  }

  @Post('routes')
  @Roles('admin')
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(busRouteInputSchema)) body: BusRouteInput,
  ): Promise<BusRoute> {
    return this.bus.create(principal.userId, body);
  }

  @Put('routes/:id')
  @Roles('admin')
  replace(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(busIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(busRouteInputSchema)) body: BusRouteInput,
  ): Promise<BusRoute> {
    return this.bus.replace(principal.userId, params.id, body);
  }

  @Delete('routes/:id')
  @Roles('admin')
  @HttpCode(204)
  remove(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(busIdParamSchema)) params: { id: string },
  ): Promise<void> {
    return this.bus.remove(principal.userId, params.id);
  }

  @Get('notices')
  notices(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(busListQuerySchema)) query: BusListQuery,
  ): Promise<BusNoticeList> {
    return this.bus.notices(principal.userId, query.all);
  }

  @Post('notices')
  @Roles('admin')
  createNotice(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(busNoticeInputSchema)) body: BusNoticeInput,
  ): Promise<BusNotice> {
    return this.bus.createNotice(principal.userId, body);
  }

  @Delete('notices/:id')
  @Roles('admin')
  @HttpCode(204)
  removeNotice(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(busIdParamSchema)) params: { id: string },
  ): Promise<void> {
    return this.bus.removeNotice(principal.userId, params.id);
  }
}
