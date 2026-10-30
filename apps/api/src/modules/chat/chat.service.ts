import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AddMembersRequest,
  CHAT_LIMITS,
  type ChatMessage,
  type ChatMessagePage,
  ChatEvents,
  type ChatPerson,
  type Conversation,
  type ConversationPage,
  type CreateGroupRequest,
  type CursorPageQuery,
  ERROR_CODES,
  type MessagesQuery,
  type SendMessageRequest,
} from '@ruet-chottor/shared';
import type { Env } from '../../core/config/env.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { type RateLimitRule, RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import {
  type Conversation as ConversationRow,
  type ConversationMember as MemberRow,
  type Message as MessageRow,
  Prisma,
} from '../../generated/prisma/client.js';
import { ChatRealtime } from './chat-realtime.js';

const HOUR = 60 * 60;

export const CHAT_RATE_LIMITS = {
  startDirect: { name: 'chat:direct', limit: 30, windowSeconds: HOUR },
  createGroup: { name: 'chat:group', limit: 10, windowSeconds: HOUR },
  manageGroup: { name: 'chat:manage', limit: 60, windowSeconds: HOUR },
  // Typing events are throttled by the browser; this only stops a misbehaving client.
  typing: { name: 'chat:typing', limit: 60, windowSeconds: 60 },
} as const;

/** The key that makes two people share one 1:1 chat, whoever starts it. */
export function directKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

const notFound = () =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Conversation not found.' });

type UserRef = ChatPerson & { status: string };

@Injectable()
export class ChatService {
  private readonly sendRule: RateLimitRule;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
    private readonly realtime: ChatRealtime,
    config: ConfigService<Env, true>,
  ) {
    this.sendRule = {
      name: 'chat:send',
      limit: config.get('CHAT_SEND_LIMIT_PER_MINUTE', { infer: true }),
      windowSeconds: 60,
    };
  }

  // ----- conversations -----

  async list(userId: string, query: CursorPageQuery): Promise<ConversationPage> {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId, leftAt: null },
    });
    const rows = await this.prisma.conversation.findMany({
      where: { id: { in: memberships.map((m) => m.conversationId) } },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: await this.present(page, userId),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, conversationId: string): Promise<Conversation> {
    await this.requireMember(userId, conversationId);
    return this.presentOne(conversationId, userId);
  }

  /** Opens the 1:1 chat with `otherId`, creating it the first time. */
  async startDirect(userId: string, otherId: string): Promise<Conversation> {
    await this.requireActive(userId);
    if (otherId === userId) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'You cannot start a chat with yourself.',
      });
    }
    const other = await this.prisma.user.findUnique({ where: { id: otherId } });
    if (!other || other.status !== 'active') {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'User not found.' });
    }

    const key = directKey(userId, otherId);
    const existing = await this.prisma.conversation.findUnique({ where: { directKey: key } });
    if (existing) return this.presentOne(existing.id, userId);

    await this.rateLimit.consume(CHAT_RATE_LIMITS.startDirect, userId);
    try {
      const created = await this.prisma.conversation.create({
        data: {
          type: 'direct',
          createdById: userId,
          directKey: key,
          members: {
            create: [
              { userId, role: 'member' },
              { userId: otherId, role: 'member' },
            ],
          },
        },
      });
      return this.presentOne(created.id, userId);
    } catch (error) {
      // Both people pressed "Message" at the same moment: use the chat the other request made.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.conversation.findUnique({ where: { directKey: key } });
        if (winner) return this.presentOne(winner.id, userId);
      }
      throw error;
    }
  }

  async createGroup(userId: string, input: CreateGroupRequest): Promise<Conversation> {
    await this.requireActive(userId);
    await this.rateLimit.consume(CHAT_RATE_LIMITS.createGroup, userId);
    const memberIds = input.memberIds.filter((id) => id !== userId);
    await this.requireActiveUsers(memberIds);

    const created = await this.prisma.conversation.create({
      data: {
        type: 'group',
        name: input.name,
        createdById: userId,
        members: {
          create: [
            { userId, role: 'owner' },
            ...memberIds.map((id) => ({ userId: id, role: 'member' as const })),
          ],
        },
      },
    });
    this.realtime.toUsers(memberIds, ChatEvents.ConversationUpdated, {
      conversationId: created.id,
    });
    return this.presentOne(created.id, userId);
  }

  async rename(userId: string, conversationId: string, name: string): Promise<Conversation> {
    await this.requireActive(userId);
    await this.requireOwner(userId, conversationId);
    await this.rateLimit.consume(CHAT_RATE_LIMITS.manageGroup, userId);
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { name } });
    await this.notifyMembers(conversationId);
    return this.presentOne(conversationId, userId);
  }

  async addMembers(
    userId: string,
    conversationId: string,
    input: AddMembersRequest,
  ): Promise<Conversation> {
    await this.requireActive(userId);
    await this.requireOwner(userId, conversationId);
    await this.rateLimit.consume(CHAT_RATE_LIMITS.manageGroup, userId);
    const current = await this.activeMembers(conversationId);
    const currentIds = new Set(current.map((m) => m.userId));
    const newIds = input.userIds.filter((id) => !currentIds.has(id));
    if (currentIds.size + newIds.length > CHAT_LIMITS.groupMaxMembers) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: `A group has at most ${CHAT_LIMITS.groupMaxMembers} members.`,
      });
    }
    await this.requireActiveUsers(newIds);

    const now = new Date();
    const formerMembers = await this.prisma.conversationMember.findMany({
      where: { conversationId, userId: { in: newIds } },
    });
    const formerIds = new Set(formerMembers.map((m) => m.userId));
    await this.prisma.$transaction([
      // Someone who left and is added back starts fresh, like a new member.
      ...[...formerIds].map((id) =>
        this.prisma.conversationMember.update({
          where: { conversationId_userId: { conversationId, userId: id } },
          data: { leftAt: null, role: 'member', joinedAt: now, lastReadAt: now },
        }),
      ),
      this.prisma.conversationMember.createMany({
        data: newIds
          .filter((id) => !formerIds.has(id))
          .map((id) => ({ conversationId, userId: id, joinedAt: now, lastReadAt: now })),
      }),
    ]);
    await this.notifyMembers(conversationId);
    return this.presentOne(conversationId, userId);
  }

  /** The owner removes someone, or a member removes themselves (leaves). */
  async removeMember(userId: string, conversationId: string, targetId: string): Promise<void> {
    const me = await this.requireMember(userId, conversationId);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (conversation?.type !== 'group') {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'People cannot be removed from a 1:1 chat.',
      });
    }
    // Leaving is always allowed; managing others is not while suspended.
    if (targetId !== userId) await this.requireActive(userId);
    if (targetId !== userId && me.role !== 'owner') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only the group owner can remove members.',
      });
    }
    const target = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId: targetId, leftAt: null },
    });
    if (!target) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'This person is not in the group.',
      });
    }
    await this.rateLimit.consume(CHAT_RATE_LIMITS.manageGroup, userId);
    const wasOwner = target.role === 'owner';

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: targetId } },
        data: { leftAt: new Date(), role: 'member' },
      }),
    ];
    // An owner who leaves hands the group to the longest-standing member.
    if (wasOwner) {
      const heir = (await this.activeMembers(conversationId))
        .filter((m) => m.userId !== targetId)
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
      if (heir) {
        operations.push(
          this.prisma.conversationMember.update({
            where: { conversationId_userId: { conversationId, userId: heir.userId } },
            data: { role: 'owner' },
          }),
        );
      }
    }
    await this.prisma.$transaction(operations);
    this.realtime.toUsers([targetId], ChatEvents.ConversationUpdated, { conversationId });
    await this.notifyMembers(conversationId);
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    await this.requireMember(userId, conversationId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
    // The member's other tabs update their unread badge.
    this.realtime.toUsers([userId], ChatEvents.ConversationUpdated, { conversationId });
  }

  // ----- messages -----

  async messages(
    userId: string,
    conversationId: string,
    query: MessagesQuery,
  ): Promise<ChatMessagePage> {
    const me = await this.requireMember(userId, conversationId);
    // Members only see what was sent after they joined. Moderated messages are served only to
    // their sender, without the text, so they know a moderator acted (the add-moderation skill).
    const base = {
      conversationId,
      createdAt: { gte: me.joinedAt },
      OR: [{ status: 'visible' as const }, { senderId: userId }],
    };

    if (query.after) {
      const anchor = await this.prisma.message.findFirst({
        where: { id: query.after, conversationId },
      });
      if (!anchor) throw notFound();
      const rows = await this.prisma.message.findMany({
        where: {
          ...base,
          createdAt: { gte: anchor.createdAt > me.joinedAt ? anchor.createdAt : me.joinedAt },
          id: { not: anchor.id },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: query.limit + 1,
      });
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      return {
        items: await this.presentMessages(page),
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
      };
    }

    const rows = await this.prisma.message.findMany({
      where: base,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: await this.presentMessages(page),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /** Saves the message, then pushes it to every member's sockets (CLAUDE.md §10). */
  async send(
    userId: string,
    conversationId: string,
    input: SendMessageRequest,
  ): Promise<ChatMessage> {
    await this.requireActive(userId);
    await this.requireMember(userId, conversationId);
    await this.rateLimit.consume(this.sendRule, userId);

    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: userId, body: input.body, createdAt: now },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      }),
      this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: now },
      }),
    ]);

    const [presented] = await this.presentMessages([message]);
    const recipients = (await this.activeMembers(conversationId)).map((m) => m.userId);
    this.realtime.toUsers(recipients, ChatEvents.MessageNew, { message: presented });
    return { ...presented!, ...(input.clientId ? { clientId: input.clientId } : {}) };
  }

  /** The sender deletes their own message. The text is kept for moderators, never served. */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.status !== 'visible') {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Message not found.' });
    }
    await this.requireMember(userId, message.conversationId);
    if (message.senderId !== userId) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You can only delete your own messages.',
      });
    }
    if (message.deletedAt) return;

    await this.prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
    const recipients = (await this.activeMembers(message.conversationId)).map((m) => m.userId);
    this.realtime.toUsers(recipients, ChatEvents.MessageDeleted, {
      conversationId: message.conversationId,
      messageId,
    });
  }

  /** Who should see "<name> is typing". Throws if the sender may not post here. */
  async typingAudience(
    userId: string,
    conversationId: string,
  ): Promise<{ name: string; recipients: string[] }> {
    await this.requireMember(userId, conversationId);
    await this.rateLimit.consume(CHAT_RATE_LIMITS.typing, userId);
    const user = await this.requireActive(userId);
    const recipients = (await this.activeMembers(conversationId))
      .map((m) => m.userId)
      .filter((id) => id !== userId);
    return { name: user.name, recipients };
  }

  // ----- rules -----

  /** Suspended and banned members cannot write (CLAUDE.md §7), even with a live access token. */
  private async requireActive(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account is suspended, so you cannot send messages or change groups.',
      });
    }
    return user;
  }

  private async requireActiveUsers(ids: string[]) {
    if (ids.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, status: 'active' },
    });
    if (users.length !== new Set(ids).size) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'One of these people cannot be added.',
      });
    }
  }

  /** Non-members get 404, so they cannot even tell that the conversation exists. */
  private async requireMember(userId: string, conversationId: string): Promise<MemberRow> {
    const member = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId, leftAt: null },
    });
    if (!member) throw notFound();
    return member;
  }

  private async requireOwner(userId: string, conversationId: string): Promise<MemberRow> {
    const member = await this.requireMember(userId, conversationId);
    if (member.role !== 'owner') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only the group owner can change the group.',
      });
    }
    return member;
  }

  private activeMembers(conversationId: string): Promise<MemberRow[]> {
    return this.prisma.conversationMember.findMany({ where: { conversationId, leftAt: null } });
  }

  private async notifyMembers(conversationId: string) {
    const ids = (await this.activeMembers(conversationId)).map((m) => m.userId);
    this.realtime.toUsers(ids, ChatEvents.ConversationUpdated, { conversationId });
  }

  // ----- presentation -----

  private async users(ids: string[]): Promise<Map<string, UserRef>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true, role: true, status: true },
    });
    return new Map(
      rows.map((u) => [u.id, { id: u.id, name: u.name, role: u.role, status: u.status }]),
    );
  }

  private async presentMessages(rows: MessageRow[]): Promise<ChatMessage[]> {
    const people = await this.users(rows.map((m) => m.senderId));
    return rows.map((m) => {
      const sender = people.get(m.senderId);
      return {
        id: m.id,
        conversationId: m.conversationId,
        sender: sender ? { id: sender.id, name: sender.name, role: sender.role } : null,
        body: m.deletedAt || m.status !== 'visible' ? null : m.body,
        deleted: m.deletedAt !== null,
        moderated: m.status !== 'visible',
        createdAt: m.createdAt.toISOString(),
      };
    });
  }

  private async presentOne(conversationId: string, viewerId: string): Promise<Conversation> {
    const row = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!row) throw notFound();
    const [presented] = await this.present([row], viewerId);
    return presented!;
  }

  private async present(rows: ConversationRow[], viewerId: string): Promise<Conversation[]> {
    if (rows.length === 0) return [];
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: { in: rows.map((c) => c.id) }, leftAt: null },
    });
    const people = await this.users(members.map((m) => m.userId));

    return Promise.all(
      rows.map(async (conversation) => {
        const mine = members.filter((m) => m.conversationId === conversation.id);
        const me = mine.find((m) => m.userId === viewerId);
        const visible = {
          conversationId: conversation.id,
          status: 'visible' as const,
          ...(me ? { createdAt: { gte: me.joinedAt } } : {}),
        };
        const [last, unreadCount] = await Promise.all([
          this.prisma.message.findFirst({
            where: visible,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }),
          me
            ? this.prisma.message.count({
                where: {
                  conversationId: conversation.id,
                  status: 'visible',
                  deletedAt: null,
                  senderId: { not: viewerId },
                  createdAt: { gt: me.lastReadAt },
                },
              })
            : 0,
        ]);
        return {
          id: conversation.id,
          type: conversation.type,
          name: conversation.name,
          members: mine.flatMap((m) => {
            const person = people.get(m.userId);
            return person
              ? [{ id: person.id, name: person.name, role: person.role, conversationRole: m.role }]
              : [];
          }),
          myRole: me?.role ?? 'member',
          lastMessage: last ? ((await this.presentMessages([last]))[0] ?? null) : null,
          lastMessageAt: conversation.lastMessageAt.toISOString(),
          unreadCount,
        };
      }),
    );
  }
}
