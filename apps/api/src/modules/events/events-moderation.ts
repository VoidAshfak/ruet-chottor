import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type ContentStatus, formatDateTime } from '@ruet-chottor/shared';
import {
  type ModeratableContent,
  ModeratableContentRegistry,
  type ModeratableItem,
} from '../../core/moderation/moderatable-content.registry.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

/** Lets members report an event and moderators hide, remove or restore it (ADR 0009). */
@Injectable()
export class EventsModeration implements ModeratableContent, OnModuleInit {
  readonly type = 'events.event' as const;
  readonly label = 'Event';

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ModeratableContentRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async canReport(_userId: string, eventId: string): Promise<boolean> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    return event?.status === 'visible';
  }

  async load(eventId: string): Promise<ModeratableItem | null> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return null;
    return {
      authorId: event.createdById,
      preview: `${event.title}\n${event.venue}\n\n${event.description}`,
      status: event.status,
      context: `Event · ${formatDateTime(event.startsAt)}`,
    };
  }

  async setStatus(eventId: string, status: ContentStatus): Promise<void> {
    await this.prisma.event.update({ where: { id: eventId }, data: { status } });
  }
}
