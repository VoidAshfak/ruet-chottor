import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  ChatEvents,
  type ChatSendAck,
  chatSendPayloadSchema,
  chatTypingPayloadSchema,
  ERROR_CODES,
  SOCKET_NAMESPACES,
} from '@ruet-chottor/shared';
import type { Namespace, Socket } from 'socket.io';
import { AccessTokenStore } from '../../core/auth/access-token.store.js';
import {
  authenticateSocket,
  type SocketSession,
  sessionExpiredAck,
  toAckError,
} from '../../core/realtime/socket-auth.js';
import { ChatRealtime, userRoom } from './chat-realtime.js';
import { ChatService } from './chat.service.js';

const SESSION_CHECK_MS = 60_000;

type ChatSocket = Socket<Record<string, never>, Record<string, never>, never, SocketSession>;

/**
 * `/chat` namespace. Sockets log in with the session cookie and join only their own
 * `user:<id>` room; every event re-checks the session and membership in ChatService.
 */
@WebSocketGateway({ namespace: SOCKET_NAMESPACES.chat })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  /**
   * Re-checks each socket's session every minute, so a socket closes soon after its access token
   * expires or the member logs out or is suspended. The browser refreshes and reconnects.
   */
  private readonly sessionChecks = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly chat: ChatService,
    private readonly realtime: ChatRealtime,
    private readonly tokens: AccessTokenStore,
  ) {}

  afterInit(namespace: Namespace) {
    this.realtime.attach(namespace);
    namespace.use((socket, next) => {
      authenticateSocket(socket, this.tokens)
        .then((session) => {
          if (!session) {
            // `data.code` reaches the browser's connect_error handler.
            return next(
              Object.assign(new Error('Your session has expired.'), {
                data: { code: ERROR_CODES.SESSION_EXPIRED },
              }),
            );
          }
          socket.data = session;
          next();
        })
        .catch((error: unknown) => {
          this.logger.error(error);
          next(new Error('Could not connect.'));
        });
    });
  }

  async handleConnection(socket: ChatSocket) {
    await socket.join(userRoom(socket.data.principal.userId));
    this.sessionChecks.set(
      socket.id,
      setInterval(
        () => void this.liveUserId(socket).catch(() => socket.disconnect(true)),
        SESSION_CHECK_MS,
      ),
    );
  }

  handleDisconnect(socket: ChatSocket) {
    clearInterval(this.sessionChecks.get(socket.id));
    this.sessionChecks.delete(socket.id);
  }

  @SubscribeMessage(ChatEvents.MessageSend)
  async send(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<ChatSendAck> {
    const userId = await this.liveUserId(socket);
    if (!userId) return sessionExpiredAck;

    const parsed = chatSendPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? 'Invalid message',
        },
      };
    }
    const { conversationId, ...message } = parsed.data;
    try {
      return { ok: true, message: await this.chat.send(userId, conversationId, message) };
    } catch (error) {
      return toAckError(error);
    }
  }

  @SubscribeMessage(ChatEvents.TypingStart)
  async typing(@ConnectedSocket() socket: ChatSocket, @MessageBody() payload: unknown) {
    const userId = await this.liveUserId(socket);
    const parsed = chatTypingPayloadSchema.safeParse(payload);
    if (!userId || !parsed.success) return;
    try {
      const { name, recipients } = await this.chat.typingAudience(
        userId,
        parsed.data.conversationId,
      );
      this.realtime.toUsers(recipients, ChatEvents.TypingUpdate, {
        conversationId: parsed.data.conversationId,
        userId,
        name,
      });
    } catch {
      // Typing hints are best effort: a non-member or rate-limited client just gets nothing.
    }
  }

  /** The socket's session, checked again so a logout or ban takes effect on open sockets. */
  private async liveUserId(socket: ChatSocket): Promise<string | null> {
    const principal = await this.tokens.resolve(socket.data.token);
    if (principal?.userId !== socket.data.principal.userId) {
      // After the acknowledgement has gone out, so the browser learns why.
      setImmediate(() => socket.disconnect(true));
      return null;
    }
    return principal.userId;
  }
}
