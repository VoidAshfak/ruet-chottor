import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ERROR_CODES, SOCKET_NAMESPACES } from '@ruet-chottor/shared';
import type { Namespace, Socket } from 'socket.io';
import { AccessTokenStore } from '../../core/auth/access-token.store.js';
import { authenticateSocket, type SocketSession } from '../../core/realtime/socket-auth.js';
import { NotificationsRealtime, userRoom } from './notifications-realtime.js';

const SESSION_CHECK_MS = 60_000;

type NotificationsSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  never,
  SocketSession
>;

/**
 * `/notifications` namespace: server -> client only. Sockets log in with the session cookie and
 * join their own `user:<id>` room. Reading and marking read happen over HTTP.
 */
@WebSocketGateway({ namespace: SOCKET_NAMESPACES.notifications })
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);
  /** Closes a socket soon after its session ends (logout, suspension); the browser reconnects. */
  private readonly sessionChecks = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly realtime: NotificationsRealtime,
    private readonly tokens: AccessTokenStore,
  ) {}

  afterInit(namespace: Namespace) {
    this.realtime.attach(namespace);
    namespace.use((socket, next) => {
      authenticateSocket(socket, this.tokens)
        .then((session) => {
          if (!session) {
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

  async handleConnection(socket: NotificationsSocket) {
    await socket.join(userRoom(socket.data.principal.userId));
    this.sessionChecks.set(
      socket.id,
      setInterval(() => {
        this.tokens
          .resolve(socket.data.token)
          .then((principal) => {
            if (principal?.userId !== socket.data.principal.userId) socket.disconnect(true);
          })
          .catch(() => socket.disconnect(true));
      }, SESSION_CHECK_MS),
    );
  }

  handleDisconnect(socket: NotificationsSocket) {
    clearInterval(this.sessionChecks.get(socket.id));
    this.sessionChecks.delete(socket.id);
  }
}
