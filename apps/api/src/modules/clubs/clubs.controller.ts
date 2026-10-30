import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  type ClubDetail,
  clubIdParamSchema,
  type ClubListQuery,
  clubListQuerySchema,
  clubMemberParamSchema,
  type ClubMemberPage,
  type ClubMembersQuery,
  clubMembersQuerySchema,
  type ClubPage,
  clubSlugParamSchema,
  type ClubSummary,
  type CreateClubRequest,
  createClubRequestSchema,
  type SetManagersRequest,
  setManagersRequestSchema,
  type UpdateClubRequest,
  updateClubRequestSchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser, Roles } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { ClubsService } from './clubs.service.js';

/**
 * Every route needs a login. Admin routes use `@Roles('admin')`; manager rights are per club and
 * checked in the service.
 */
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Get()
  list(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(clubListQuerySchema)) query: ClubListQuery,
  ): Promise<ClubPage> {
    return this.clubs.list(principal.userId, query);
  }

  // Declared before `:slug` so it never reaches it.
  @Get('mine')
  mine(@CurrentUser() principal: Principal): Promise<ClubSummary[]> {
    return this.clubs.mine(principal.userId);
  }

  @Get(':slug')
  get(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(clubSlugParamSchema)) params: { slug: string },
  ): Promise<ClubDetail> {
    return this.clubs.getBySlug(principal.userId, params.slug);
  }

  @Post()
  @Roles('admin')
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(createClubRequestSchema)) body: CreateClubRequest,
  ): Promise<ClubDetail> {
    return this.clubs.create(principal.userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(clubIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateClubRequestSchema)) body: UpdateClubRequest,
  ): Promise<ClubDetail> {
    return this.clubs.update(principal.userId, params.id, body);
  }

  @Put(':id/managers')
  @Roles('admin')
  setManagers(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(clubIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(setManagersRequestSchema)) body: SetManagersRequest,
  ): Promise<ClubDetail> {
    return this.clubs.setManagers(principal.userId, params.id, body.userIds);
  }

  @Post(':id/membership')
  join(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(clubIdParamSchema)) params: { id: string },
  ): Promise<ClubDetail> {
    return this.clubs.join(principal.userId, params.id);
  }

  @Delete(':id/membership')
  @HttpCode(204)
  leave(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(clubIdParamSchema)) params: { id: string },
  ): Promise<void> {
    return this.clubs.leave(principal.userId, params.id);
  }

  @Get(':id/members')
  members(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(clubIdParamSchema)) params: { id: string },
    @Query(new ZodValidationPipe(clubMembersQuerySchema)) query: ClubMembersQuery,
  ): Promise<ClubMemberPage> {
    return this.clubs.members(principal.userId, params.id, query);
  }

  @Post(':id/members/:userId/approve')
  @HttpCode(204)
  approve(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(clubMemberParamSchema)) params: { id: string; userId: string },
  ): Promise<void> {
    return this.clubs.approve(principal.userId, params.id, params.userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(clubMemberParamSchema)) params: { id: string; userId: string },
  ): Promise<void> {
    return this.clubs.removeMember(principal.userId, params.id, params.userId);
  }
}
