import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@ruet-chottor/shared';
import type { Request } from 'express';
import type { Principal } from './access-token.store.js';

export const IS_PUBLIC = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** Routes are private by default; mark the exceptions. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Only these roles may call the route (checked on the server, CLAUDE.md §6). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type AuthedRequest = Request & { user?: Principal };

/** The logged-in principal. Only use on routes that are not @Public(). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
