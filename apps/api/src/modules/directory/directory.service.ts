import { Injectable } from '@nestjs/common';
import { type DirectoryPage, type DirectoryQuery, rollPrefixes } from '@ruet-chottor/shared';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';

export const DIRECTORY_RATE_LIMITS = {
  // Generous for typing-as-you-search, low enough to slow down scraping the whole list.
  search: { name: 'directory:search', limit: 120, windowSeconds: 60 },
} as const;

/** Turns directory filters into a member query. Privacy is applied by UsersService. */
export function directoryWhere(query: DirectoryQuery): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  if (query.q) {
    and.push(
      /^\d+$/.test(query.q)
        ? { roll: { startsWith: query.q } }
        : { name: { contains: query.q, mode: 'insensitive' } },
    );
  }

  const prefixes = rollPrefixes({ department: query.department, series: query.series });
  if (prefixes) {
    and.push({ OR: prefixes.map((prefix) => ({ roll: { startsWith: prefix } })) });
  }

  if (query.role) and.push({ role: query.role });
  return { AND: and };
}

@Injectable()
export class DirectoryService {
  constructor(
    private readonly users: UsersService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async search(viewerId: string, query: DirectoryQuery): Promise<DirectoryPage> {
    await this.rateLimit.consume(DIRECTORY_RATE_LIMITS.search, viewerId);
    return this.users.listPublic({
      where: directoryWhere(query),
      cursor: query.cursor,
      take: query.limit,
    });
  }
}
