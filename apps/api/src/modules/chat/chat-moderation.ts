import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ChatEvents, type ContentStatus } from '@ruet-chottor/shared';
import {
  type ModeratableContent,
  ModeratableContentRegistry,
  type ModeratableItem,
} from '../../core/moderation/moderatable-content.registry.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ChatRealtime } from './chat-realtime.js';

/** Lets members report chat messages and moderators hide, remove or restore them. */
@Injectable()
export class ChatModeration implements ModeratableContent, OnModuleInit {
  readonly type = 'chat.message' as const;
  readonly label = 'Chat message';

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: ChatRealtime,
    private readonly registry: ModeratableContentRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  /** Only members who can see the message: in the chat, and joined before it was sent. */
  async canReport(userId: string, messageId: string): Promise<boolean> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.status !== 'visible' || message.deletedAt) return false;
    const member = await this.prisma.conversationMember.findFirst({
      where: { conversationId: message.conversationId, userId, leftAt: null },
    });
    return !!member && member.joinedAt <= message.createdAt;
  }

  async load(messageId: string): Promise<ModeratableItem | null> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return null;
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: message.conversationId },
    });
    return {
      authorId: message.senderId,
      preview: message.body,
      status: message.status,
      context: conversation?.type === 'group' ? 'Group chat' : '1:1 chat',
    };
  }

  async setStatus(messageId: string, status: ContentStatus): Promise<void> {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { status },
    });
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: message.conversationId, leftAt: null },
    });
    this.realtime.toUsers(
      members.map((m) => m.userId),
      ChatEvents.MessageModerated,
      { conversationId: message.conversationId, messageId },
    );
  }
}
