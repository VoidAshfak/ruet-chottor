import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  type ClassRepApplyRequest,
  classRepApplyRequestSchema,
  classRepIdParamSchema,
  type ClassRepRequest,
  type ClassRepReviewPage,
  type ClassRepReviewQuery,
  classRepReviewQuerySchema,
  type MyClassRep,
  type ReasonRequest,
  reasonRequestSchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser, Roles } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { ClassRepsService } from './class-reps.service.js';

const idPipe = new ZodValidationPipe(classRepIdParamSchema);

/**
 * Class representative verification. Members manage their own request under `me/`; review routes
 * are for staff (`@Roles`, re-checked in the service). Registered before UsersController so
 * `/users/class-reps` never reaches its `/users/:id` route.
 */
@Controller('users')
export class ClassRepsController {
  constructor(private readonly classReps: ClassRepsService) {}

  @Get('me/class-rep')
  mine(@CurrentUser() principal: Principal): Promise<MyClassRep> {
    return this.classReps.mine(principal.userId);
  }

  @Post('me/class-rep')
  apply(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(classRepApplyRequestSchema)) body: ClassRepApplyRequest,
  ): Promise<MyClassRep> {
    return this.classReps.apply(principal.userId, body);
  }

  @Delete('me/class-rep')
  withdraw(@CurrentUser() principal: Principal): Promise<MyClassRep> {
    return this.classReps.withdraw(principal.userId);
  }

  @Get('class-reps')
  @Roles('moderator', 'admin')
  list(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(classRepReviewQuerySchema)) query: ClassRepReviewQuery,
  ): Promise<ClassRepReviewPage> {
    return this.classReps.list(principal.userId, query);
  }

  @Post('class-reps/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles('moderator', 'admin')
  approve(
    @CurrentUser() principal: Principal,
    @Param('id', idPipe) id: string,
  ): Promise<ClassRepRequest> {
    return this.classReps.approve(principal.userId, id);
  }

  @Post('class-reps/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles('moderator', 'admin')
  reject(
    @CurrentUser() principal: Principal,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(reasonRequestSchema)) body: ReasonRequest,
  ): Promise<ClassRepRequest> {
    return this.classReps.reject(principal.userId, id, body.reason);
  }

  @Post('class-reps/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @Roles('moderator', 'admin')
  revoke(
    @CurrentUser() principal: Principal,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(reasonRequestSchema)) body: ReasonRequest,
  ): Promise<ClassRepRequest> {
    return this.classReps.revoke(principal.userId, id, body.reason);
  }
}
