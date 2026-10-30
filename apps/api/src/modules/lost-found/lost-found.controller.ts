import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type CursorPageQuery,
  cursorPageQuerySchema,
  type LostFoundBoardQuery,
  lostFoundBoardQuerySchema,
  lostFoundIdParamSchema,
  type LostFoundInput,
  lostFoundInputSchema,
  type LostFoundItem,
  type LostFoundPage,
  type LostFoundStateRequest,
  lostFoundStateRequestSchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { LostFoundService } from './lost-found.service.js';

/** Every route needs a login; posters change only their own posts (checked in the service). */
@Controller('lost-found/items')
export class LostFoundController {
  constructor(private readonly items: LostFoundService) {}

  @Get()
  board(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(lostFoundBoardQuerySchema)) query: LostFoundBoardQuery,
  ): Promise<LostFoundPage> {
    return this.items.board(principal.userId, query);
  }

  // Declared before `:id` so it never reaches it.
  @Get('mine')
  mine(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: CursorPageQuery,
  ): Promise<LostFoundPage> {
    return this.items.mine(principal.userId, query);
  }

  @Get(':id')
  get(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(lostFoundIdParamSchema)) params: { id: string },
  ): Promise<LostFoundItem> {
    return this.items.get(principal.userId, params.id);
  }

  @Post()
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(lostFoundInputSchema)) body: LostFoundInput,
  ): Promise<LostFoundItem> {
    return this.items.create(principal.userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(lostFoundIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(lostFoundInputSchema)) body: LostFoundInput,
  ): Promise<LostFoundItem> {
    return this.items.update(principal.userId, params.id, body);
  }

  @Post(':id/state')
  @HttpCode(200)
  setState(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(lostFoundIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(lostFoundStateRequestSchema)) body: LostFoundStateRequest,
  ): Promise<LostFoundItem> {
    return this.items.setState(principal.userId, params.id, body.state);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(lostFoundIdParamSchema)) params: { id: string },
  ): Promise<void> {
    return this.items.remove(principal.userId, params.id);
  }
}
