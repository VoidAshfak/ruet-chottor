import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

/** Every socket of a member joins this room, so all their tabs and devices get updates. */
export const userRoom = (userId: string) => `user:${userId}`;

/** Pushes to members' sockets. The gateway hands over its namespace on start-up. */
@Injectable()
export class NotificationsRealtime {
  private namespace: Namespace | null = null;

  attach(namespace: Namespace) {
    this.namespace = namespace;
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.namespace?.to(userRoom(userId)).emit(event, payload);
  }
}
