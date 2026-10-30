import { io, type Socket } from 'socket.io-client';
import { API_URL, refreshSession } from './api-client';

const sockets = new Map<string, Socket>();

/**
 * One shared Socket.IO client per namespace (e.g. `/chat`), created on first use and not
 * connected until `socket.connect()`. It logs in with the session cookie, like `apiRequest()`.
 * When the server says the session expired, the session is refreshed and the socket reconnects.
 */
export function getSocket(namespace: string): Socket {
  const existing = sockets.get(namespace);
  if (existing) return existing;

  const socket = io(`${new URL(API_URL).origin}${namespace}`, {
    withCredentials: true,
    autoConnect: false,
  });

  const refreshAndReconnect = async () => {
    if (await refreshSession()) socket.connect();
  };
  socket.on('connect_error', (error: Error & { data?: { code?: string } }) => {
    if (error.data?.code === 'SESSION_EXPIRED') void refreshAndReconnect();
  });
  // The server closes a socket when its access token expires (and on logout or suspension).
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') void refreshAndReconnect();
  });

  sockets.set(namespace, socket);
  return socket;
}
