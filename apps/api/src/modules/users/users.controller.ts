import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import {
  type DismissedGuidesResponse,
  type DismissGuideRequest,
  dismissGuideRequestSchema,
  type MyProfile,
  type PublicProfile,
  type UpdateMyProfileRequest,
  updateMyProfileRequestSchema,
  userIdParamSchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

/** Every route needs a logged-in member (global AuthGuard). */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() principal: Principal): Promise<MyProfile> {
    return this.users.getMine(principal.userId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(updateMyProfileRequestSchema)) body: UpdateMyProfileRequest,
  ): Promise<MyProfile> {
    return this.users.updateMine(principal.userId, body);
  }

  @Patch('me/guides')
  async dismissGuide(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(dismissGuideRequestSchema)) body: DismissGuideRequest,
  ): Promise<DismissedGuidesResponse> {
    return { dismissedGuides: await this.users.dismissGuide(principal.userId, body.moduleKey) };
  }

  @Delete('me/guides')
  async resetGuides(@CurrentUser() principal: Principal): Promise<DismissedGuidesResponse> {
    return { dismissedGuides: await this.users.resetGuides(principal.userId) };
  }

  // Declared after the `me` routes so `/users/me` never reaches it.
  @Get(':id')
  profile(
    @Param('id', new ZodValidationPipe(userIdParamSchema)) id: string,
  ): Promise<PublicProfile> {
    return this.users.getPublic(id);
  }
}
