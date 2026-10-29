import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AUTH_LIMITS,
  ERROR_CODES,
  type LoginRequest,
  type OtpChallenge,
  type SessionUser,
  type SignupRequest,
} from '@ruet-chottor/shared';
import argon2 from 'argon2';
import { MailService } from '../../core/mail/mail.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import { Prisma, type User } from '../../generated/prisma/client.js';
import { OtpService } from './otp.service.js';
import { type IssuedSession, SessionsService } from './sessions.service.js';

const FIFTEEN_MINUTES = 15 * 60;

export const AUTH_RATE_LIMITS = {
  signupPerIp: { name: 'auth:signup:ip', limit: 5, windowSeconds: 60 * 60 },
  signupPerRoll: { name: 'auth:signup:roll', limit: 5, windowSeconds: 60 * 60 },
  loginPerIp: { name: 'auth:login:ip', limit: 20, windowSeconds: FIFTEEN_MINUTES },
  loginPerRoll: { name: 'auth:login:roll', limit: 10, windowSeconds: FIFTEEN_MINUTES },
  otpPerIp: { name: 'auth:otp:ip', limit: 30, windowSeconds: FIFTEEN_MINUTES },
} as const;

const UNIQUE_FIELDS = ['roll', 'registrationNo', 'email', 'phone'] as const;
type UniqueField = (typeof UNIQUE_FIELDS)[number];

const TAKEN_MESSAGE: Record<UniqueField, string> = {
  roll: 'An account with this roll already exists. Try logging in instead.',
  registrationNo: 'This registration number is already used by another account.',
  email: 'This email is already used by another account.',
  phone: 'This phone number is already used by another account.',
};

export function toSessionUser(user: User): SessionUser {
  return { id: user.id, name: user.name, roll: user.roll, role: user.role };
}

/** a.student@example.com -> a•••@example.com */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}•••@${domain}`;
}

@Injectable()
export class AuthService {
  // Compared against when the roll does not exist, so both cases take the same time.
  private readonly dummyHash = argon2.hash('timing-equaliser-not-a-password');

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionsService,
    private readonly mail: MailService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async signup(input: SignupRequest, ip: string): Promise<SessionUser> {
    await this.rateLimit.consume(AUTH_RATE_LIMITS.signupPerIp, ip);
    await this.rateLimit.consume(AUTH_RATE_LIMITS.signupPerRoll, input.roll);

    const existing = await this.prisma.user.findFirst({
      where: { OR: UNIQUE_FIELDS.map((field) => ({ [field]: input[field] })) },
      select: { roll: true, registrationNo: true, email: true, phone: true },
    });
    if (existing) {
      const field = UNIQUE_FIELDS.find((key) => existing[key] === input[key]) ?? 'roll';
      throw takenError(field);
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          name: input.name,
          roll: input.roll,
          registrationNo: input.registrationNo,
          email: input.email,
          phone: input.phone,
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`),
          passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
        },
      });
      return toSessionUser(user);
    } catch (error) {
      // Two sign-ups with the same details at once: the database constraint decides.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw takenError('roll');
      }
      throw error;
    }
  }

  /** Step 1: check roll + password, then email a one-time code. */
  async login(input: LoginRequest, ip: string): Promise<OtpChallenge> {
    await this.rateLimit.consume(AUTH_RATE_LIMITS.loginPerIp, ip);
    await this.rateLimit.consume(AUTH_RATE_LIMITS.loginPerRoll, input.roll);

    const user = await this.prisma.user.findUnique({ where: { roll: input.roll } });
    const passwordOk = await argon2.verify(
      user?.passwordHash ?? (await this.dummyHash),
      input.password,
    );
    if (!user || !passwordOk) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Roll or password is incorrect.',
      });
    }
    assertActive(user);

    const { challengeId, code } = await this.otp.issue(user.id);
    await this.sendCode(user, code);
    return {
      challengeId,
      channel: 'email',
      destination: maskEmail(user.email),
      expiresInSeconds: AUTH_LIMITS.otpSeconds,
      resendInSeconds: AUTH_LIMITS.otpResendCooldownSeconds,
    };
  }

  /** Step 2: a correct code starts a session. */
  async verifyOtp(
    challengeId: string,
    code: string,
    ip: string,
    userAgent: string | undefined,
  ): Promise<IssuedSession> {
    await this.rateLimit.consume(AUTH_RATE_LIMITS.otpPerIp, ip);
    const userId = await this.otp.verify(challengeId, code);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    assertActive(user);
    await this.rateLimit.reset(AUTH_RATE_LIMITS.loginPerRoll, user.roll);
    return this.sessions.create(user, userAgent);
  }

  async resendOtp(challengeId: string, ip: string): Promise<OtpChallenge> {
    await this.rateLimit.consume(AUTH_RATE_LIMITS.otpPerIp, ip);
    const { code, userId } = await this.otp.resend(challengeId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    await this.sendCode(user, code);
    return {
      challengeId,
      channel: 'email',
      destination: maskEmail(user.email),
      // The expiry is unchanged by a resend; the client keeps its own countdown.
      expiresInSeconds: AUTH_LIMITS.otpSeconds,
      resendInSeconds: AUTH_LIMITS.otpResendCooldownSeconds,
    };
  }

  async currentUser(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Please log in to continue.',
      });
    }
    return toSessionUser(user);
  }

  private async sendCode(user: User, code: string) {
    const minutes = AUTH_LIMITS.otpSeconds / 60;
    await this.mail.send({
      to: user.email,
      subject: `${code} is your RUET Chottor login code`,
      text: [
        `Hi ${user.name},`,
        '',
        `Your RUET Chottor login code is ${code}. It expires in ${minutes} minutes.`,
        '',
        'If you did not try to log in, someone may know your password. Change it after you log in.',
      ].join('\n'),
    });
  }
}

function takenError(field: UniqueField) {
  return new ConflictException({ code: ERROR_CODES.CONFLICT, message: TAKEN_MESSAGE[field] });
}

function assertActive(user: User) {
  if (user.status !== 'active') {
    throw new ForbiddenException({
      code: ERROR_CODES.ACCOUNT_SUSPENDED,
      message:
        user.status === 'banned'
          ? 'This account has been banned.'
          : 'This account is suspended. Contact a moderator.',
    });
  }
}
