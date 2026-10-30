import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ContentStatus } from '@ruet-chottor/shared';
import {
  type ModeratableContent,
  ModeratableContentRegistry,
  type ModeratableItem,
} from '../../core/moderation/moderatable-content.registry.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

/** Lets members report a club page and moderators hide, remove or restore it (ADR 0009). */
@Injectable()
export class ClubsModeration implements ModeratableContent, OnModuleInit {
  readonly type = 'clubs.club' as const;
  readonly label = 'Club page';

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ModeratableContentRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async canReport(_userId: string, clubId: string): Promise<boolean> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    return club?.status === 'visible';
  }

  /** The author is the club's first manager, so staff can reach someone responsible. */
  async load(clubId: string): Promise<ModeratableItem | null> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) return null;
    const manager = await this.prisma.clubMembership.findFirst({
      where: { clubId, role: 'manager' },
      orderBy: [{ joinedAt: 'asc' }],
    });
    return {
      authorId: manager?.userId ?? club.createdById,
      preview: `${club.name}: ${club.tagline}\n\n${club.about}`,
      status: club.status,
      context: 'Club page',
      link: `/clubs/${club.slug}`,
    };
  }

  async setStatus(clubId: string, status: ContentStatus): Promise<void> {
    await this.prisma.club.update({ where: { id: clubId }, data: { status } });
  }
}
