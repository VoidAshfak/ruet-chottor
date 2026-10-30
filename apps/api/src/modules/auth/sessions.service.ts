import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_LIMITS, ERROR_CODES } from '@ruet-chottor/shared';
import { AccessTokenStore } from '../../core/auth/access-token.store.js';
import { hashToken, newToken } from '../../core/auth/tokens.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { User } from '../../generated/prisma/client.js';

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Two tabs refreshing at the same moment both send the old token. Within this window
// the loser just fails (and retries with the new cookie) instead of being treated as theft.
const ROTATION_GRACE_MS = 30_000;

const sessionEnded = () =>
  new UnauthorizedException({
    code: ERROR_CODES.UNAUTHORIZED,
    message: 'Your session has ended. Please log in again.',
  });

/** Device sessions with rotating refresh tokens (ADR 0005). Only token hashes are stored. */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokens: AccessTokenStore,
  ) {}

  async create(user: User, userAgent: string | undefined): Promise<IssuedSession> {
    const refreshToken = newToken();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: userAgent?.slice(0, 300),
        expiresAt: refreshExpiry(),
      },
    });
    const accessToken = await this.accessTokens.issue({
      userId: user.id,
      sessionId: session.id,
      role: user.role,
    });
    return { accessToken, refreshToken, user };
  }

  /** Swaps a refresh token for a new pair. Reusing an already-rotated token revokes the session. */
  async rotate(refreshToken: string): Promise<IssuedSession> {
    const presentedHash = hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: presentedHash },
      include: { user: true },
    });

    if (!session) {
      await this.handleUnknownToken(presentedHash);
      throw sessionEnded();
    }
    if (session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'active') {
      throw sessionEnded();
    }

    const nextToken = newToken();
    // Conditional update: if another request rotated this token first, count is 0.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: presentedHash, revokedAt: null },
      data: {
        refreshTokenHash: hashToken(nextToken),
        previousRefreshTokenHash: presentedHash,
        lastUsedAt: new Date(),
        expiresAt: refreshExpiry(),
      },
    });
    if (count === 0) throw sessionEnded();

    const accessToken = await this.accessTokens.issue({
      userId: session.userId,
      sessionId: session.id,
      role: session.user.role,
    });
    return { accessToken, refreshToken: nextToken, user: session.user };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.accessTokens.revokeSessions([sessionId]);
  }

  /** Logs a user out everywhere at once, e.g. when a moderator suspends them. */
  async revokeAllForUser(userId: string): Promise<void> {
    const open = await this.prisma.session.findMany({ where: { userId, revokedAt: null } });
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.accessTokens.revokeSessions(open.map((s) => s.id));
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
    });
    if (!session || session.revokedAt) return;
    await this.revoke(session.id);
  }

  private async handleUnknownToken(presentedHash: string) {
    const rotatedFrom = await this.prisma.session.findUnique({
      where: { previousRefreshTokenHash: presentedHash },
    });
    if (!rotatedFrom || rotatedFrom.revokedAt) return;
    const rotatedRecently = Date.now() - rotatedFrom.lastUsedAt.getTime() < ROTATION_GRACE_MS;
    if (rotatedRecently) return;
    // An old token came back long after rotation: someone else has a copy. End the session.
    await this.revoke(rotatedFrom.id);
  }
}

function refreshExpiry(): Date {
  return new Date(Date.now() + AUTH_LIMITS.refreshTokenDays * 24 * 60 * 60 * 1000);
}
