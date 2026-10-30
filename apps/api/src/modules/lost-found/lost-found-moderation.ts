import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ContentStatus } from '@ruet-chottor/shared';
import {
  type ModeratableContent,
  ModeratableContentRegistry,
  type ModeratableItem,
} from '../../core/moderation/moderatable-content.registry.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

/** Lets members report a lost & found post and moderators hide, remove or restore it (ADR 0009). */
@Injectable()
export class LostFoundModeration implements ModeratableContent, OnModuleInit {
  readonly type = 'lost-found.item' as const;
  readonly label = 'Lost & found post';

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ModeratableContentRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async canReport(_userId: string, itemId: string): Promise<boolean> {
    const item = await this.prisma.lostFoundItem.findUnique({ where: { id: itemId } });
    return item?.status === 'visible';
  }

  async load(itemId: string): Promise<ModeratableItem | null> {
    const item = await this.prisma.lostFoundItem.findUnique({ where: { id: itemId } });
    if (!item) return null;
    return {
      authorId: item.createdById,
      preview: `${item.kind === 'lost' ? 'Lost' : 'Found'}: ${item.title}\n\n${item.description}`,
      status: item.status,
      context: 'Lost & found',
      link: `/lost-found/${item.id}`,
    };
  }

  async setStatus(itemId: string, status: ContentStatus): Promise<void> {
    await this.prisma.lostFoundItem.update({ where: { id: itemId }, data: { status } });
  }
}
