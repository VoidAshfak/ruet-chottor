import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type AdminUserDetail,
  type AdminUserListQuery,
  adminUserListQuerySchema,
  type AdminUserPage,
  type ChangeRoleRequest,
  changeRoleRequestSchema,
  type CursorPageQuery,
  cursorPageQuerySchema,
  type ModerationLogPage,
  type ReasonRequest,
  reasonRequestSchema,
  type SuspendRequest,
  suspendRequestSchema,
  userIdParamSchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser, Roles } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { AdminService } from './admin.service.js';
import { ModerationLogService } from './moderation-log.service.js';

const idPipe = new ZodValidationPipe(userIdParamSchema);

/** Staff only. Role changes are admin-only; the service re-checks roles against the database. */
@Controller('admin')
@Roles('moderator', 'admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly log: ModerationLogService,
  ) {}

  @Get('users')
  users(
    @Query(new ZodValidationPipe(adminUserListQuerySchema)) query: AdminUserListQuery,
  ): Promise<AdminUserPage> {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  user(@Param('id', idPipe) id: string): Promise<AdminUserDetail> {
    return this.admin.getUser(id);
  }

  @Post('users/:id/warn')
  @HttpCode(HttpStatus.OK)
  warn(
    @CurrentUser() principal: Principal,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(reasonRequestSchema)) body: ReasonRequest,
  ): Promise<AdminUserDetail> {
    return this.admin.warn(principal.userId, id, body.reason);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(
    @CurrentUser() principal: Principal,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(suspendRequestSchema)) body: SuspendRequest,
  ): Promise<AdminUserDetail> {
    return this.admin.suspend(principal.userId, id, body.reason, body.days);
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  ban(
    @CurrentUser() principal: Principal,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(reasonRequestSchema)) body: ReasonRequest,
  ): Promise<AdminUserDetail> {
    return this.admin.ban(principal.userId, id, body.reason);
  }

  @Post('users/:id/reinstate')
  @HttpCode(HttpStatus.OK)
  reinstate(
    @CurrentUser() principal: Principal,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(reasonRequestSchema)) body: ReasonRequest,
  ): Promise<AdminUserDetail> {
    return this.admin.reinstate(principal.userId, id, body.reason);
  }

  @Patch('users/:id/role')
  @Roles('admin')
  changeRole(
    @CurrentUser() principal: Principal,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(changeRoleRequestSchema)) body: ChangeRoleRequest,
  ): Promise<AdminUserDetail> {
    return this.admin.changeRole(principal.userId, id, body.role, body.reason);
  }

  @Get('log')
  moderationLog(
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: CursorPageQuery,
  ): Promise<ModerationLogPage> {
    return this.log.list({ cursor: query.cursor, take: query.limit });
  }
}
