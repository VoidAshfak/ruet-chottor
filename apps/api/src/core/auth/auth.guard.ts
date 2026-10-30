import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES, type Role } from '@ruet-chottor/shared';
import { AccessTokenStore } from './access-token.store.js';
import { ACCESS_COOKIE } from './cookies.js';
import { type AuthedRequest, IS_PUBLIC, ROLES_KEY } from './decorators.js';

/**
 * Global guard: every route needs a valid access cookie unless marked @Public(),
 * and @Roles(...) narrows it further. HTTP only: sockets are checked by their gateway.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Socket gateways authenticate the handshake themselves (core/realtime/socket-auth.ts).
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[ACCESS_COOKIE];
    if (typeof token !== 'string' || token === '') {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Please log in to continue.',
      });
    }

    const principal = await this.tokens.resolve(token);
    if (!principal) {
      // The web app refreshes the session when it sees this code, then retries.
      throw new UnauthorizedException({
        code: ERROR_CODES.SESSION_EXPIRED,
        message: 'Your session has expired. Please log in again.',
      });
    }
    req.user = principal;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(principal.role)) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have permission to do this.',
      });
    }
    return true;
  }
}
