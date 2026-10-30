import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

/** Every socket of a member joins this room, so all their tabs and devices get updates. */
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Pushes events to members' sockets. The gateway hands over its namespace on start-up; the
 * service calls this after saving, so HTTP and socket sends broadcast the same way.
 */
@Injectable()
export class ChatRealtime {
  private namespace: Namespace | null = null;

  attach(namespace: Namespace) {
    this.namespace = namespace;
  }

  toUsers(userIds: string[], event: string, payload: unknown) {
    if (!this.namespace || userIds.length === 0) return;
    this.namespace.to(userIds.map(userRoom)).emit(event, payload);
  }
}
