import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type CursorPageQuery,
  cursorPageQuerySchema,
  type Listing,
  type ListingBrowseQuery,
  listingBrowseQuerySchema,
  listingIdParamSchema,
  type ListingInput,
  listingInputSchema,
  type ListingPage,
  type ListingStateRequest,
  listingStateRequestSchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { MarketplaceService } from './marketplace.service.js';

/** Every route needs a login; sellers change only their own listings (checked in the service). */
@Controller('marketplace/listings')
export class MarketplaceController {
  constructor(private readonly listings: MarketplaceService) {}

  @Get()
  browse(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(listingBrowseQuerySchema)) query: ListingBrowseQuery,
  ): Promise<ListingPage> {
    return this.listings.browse(principal.userId, query);
  }

  // Declared before `:id` so it never reaches it.
  @Get('mine')
  mine(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: CursorPageQuery,
  ): Promise<ListingPage> {
    return this.listings.mine(principal.userId, query);
  }

  @Get(':id')
  get(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(listingIdParamSchema)) params: { id: string },
  ): Promise<Listing> {
    return this.listings.get(principal.userId, params.id);
  }

  @Post()
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(listingInputSchema)) body: ListingInput,
  ): Promise<Listing> {
    return this.listings.create(principal.userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(listingIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(listingInputSchema)) body: ListingInput,
  ): Promise<Listing> {
    return this.listings.update(principal.userId, params.id, body);
  }

  @Post(':id/state')
  @HttpCode(200)
  setState(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(listingIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(listingStateRequestSchema)) body: ListingStateRequest,
  ): Promise<Listing> {
    return this.listings.setState(principal.userId, params.id, body.state);
  }

  @Post(':id/renew')
  @HttpCode(200)
  renew(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(listingIdParamSchema)) params: { id: string },
  ): Promise<Listing> {
    return this.listings.renew(principal.userId, params.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(listingIdParamSchema)) params: { id: string },
  ): Promise<void> {
    return this.listings.remove(principal.userId, params.id);
  }
}
