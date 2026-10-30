import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ContentStatus } from '@ruet-chottor/shared';
import {
  type ModeratableContent,
  ModeratableContentRegistry,
  type ModeratableItem,
} from '../../core/moderation/moderatable-content.registry.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

const CATEGORY_LABEL: Record<string, string> = {
  announcement: 'Announcement',
  academic: 'Academic',
  event: 'Event',
  club: 'Club',
  general: 'General',
};

/** Lets members report published news and moderators hide, remove or restore it (ADR 0009). */
@Injectable()
export class NewsModeration implements ModeratableContent, OnModuleInit {
  readonly type = 'news.post' as const;
  readonly label = 'News post';

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ModeratableContentRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  /** Every member can see published posts, so every member may report them. */
  async canReport(_userId: string, postId: string): Promise<boolean> {
    const post = await this.prisma.newsPost.findUnique({ where: { id: postId } });
    return !!post && post.review === 'approved' && post.status === 'visible' && !post.deletedAt;
  }

  async load(postId: string): Promise<ModeratableItem | null> {
    const post = await this.prisma.newsPost.findUnique({ where: { id: postId } });
    if (!post) return null;
    return {
      authorId: post.createdById,
      preview: `${post.title}\n\n${post.body}`,
      status: post.status,
      context: `News · ${CATEGORY_LABEL[post.category] ?? post.category}`,
    };
  }

  async setStatus(postId: string, status: ContentStatus): Promise<void> {
    await this.prisma.newsPost.update({ where: { id: postId }, data: { status } });
  }
}
