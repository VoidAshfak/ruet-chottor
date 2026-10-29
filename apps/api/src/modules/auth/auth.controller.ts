import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ERROR_CODES,
  type LoginRequest,
  loginRequestSchema,
  type OtpChallenge,
  type ResendOtpRequest,
  resendOtpRequestSchema,
  type SessionResponse,
  type SignupRequest,
  signupRequestSchema,
  type SignupResponse,
  type VerifyOtpRequest,
  verifyOtpRequestSchema,
} from '@ruet-chottor/shared';
import type { Request, Response } from 'express';
import type { Principal } from '../../core/auth/access-token.store.js';
import { AccessTokenStore } from '../../core/auth/access-token.store.js';
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  REFRESH_COOKIE,
  setSessionCookies,
} from '../../core/auth/cookies.js';
import { CurrentUser, Public } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { AuthService, toSessionUser } from './auth.service.js';
import { SessionsService } from './sessions.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly accessTokens: AccessTokenStore,
  ) {}

  @Public()
  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(signupRequestSchema)) body: SignupRequest,
    @Req() req: Request,
  ): Promise<SignupResponse> {
    return { user: await this.auth.signup(body, clientIp(req)) };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() req: Request,
  ): Promise<OtpChallenge> {
    return this.auth.login(body, clientIp(req));
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpRequestSchema)) body: VerifyOtpRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const session = await this.auth.verifyOtp(
      body.challengeId,
      body.code,
      clientIp(req),
      req.get('user-agent'),
    );
    setSessionCookies(res, session.accessToken, session.refreshToken);
    return { user: toSessionUser(session.user) };
  }

  @Public()
  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  resendOtp(
    @Body(new ZodValidationPipe(resendOtpRequestSchema)) body: ResendOtpRequest,
    @Req() req: Request,
  ): Promise<OtpChallenge> {
    return this.auth.resendOtp(body.challengeId, clientIp(req));
  }

  /** Public: it is called exactly when the access token has expired. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const token = cookie(req, REFRESH_COOKIE);
    if (!token) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Please log in to continue.',
      });
    }
    try {
      const session = await this.sessions.rotate(token);
      setSessionCookies(res, session.accessToken, session.refreshToken);
      return { user: toSessionUser(session.user) };
    } catch (error) {
      clearSessionCookies(res);
      throw error;
    }
  }

  /** Public so a user with an expired access token can still log out cleanly. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const access = cookie(req, ACCESS_COOKIE);
    const refresh = cookie(req, REFRESH_COOKIE);
    if (access) {
      // The refresh cookie may be stale (rotated in another tab), so also end the session by id.
      const principal = await this.accessTokens.resolve(access);
      await this.accessTokens.revoke(access);
      if (principal) await this.sessions.revoke(principal.sessionId);
    }
    if (refresh) await this.sessions.revokeByRefreshToken(refresh);
    clearSessionCookies(res);
  }

  @Get('session')
  async session(@CurrentUser() principal: Principal): Promise<SessionResponse> {
    return { user: await this.auth.currentUser(principal.userId) };
  }
}

function cookie(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function clientIp(req: Request): string {
  return req.ip ?? 'unknown';
}
